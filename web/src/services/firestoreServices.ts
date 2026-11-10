import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/client.js';
import type {
  AllowlistEntry,
  Did,
  Call,
  CallDirection,
  CallStatus,
  Customer,
  RingingDoc,
  Ticket,
  TicketStatus,
  TimelineEvent,
  EventType,
  UserProfile,
} from '../types.js';

export type Unsubscribe = () => void;

/** The read API the SPA depends on. Injected via context so screens are testable. */
export interface Services {
  subscribeRinging(companyId: string, cb: (docs: RingingDoc[]) => void): Unsubscribe;
  subscribeRecentCalls(companyId: string, cb: (calls: Call[]) => void): Unsubscribe;
  subscribeCustomers(companyId: string, cb: (customers: Customer[]) => void): Unsubscribe;
  subscribeTickets(companyId: string, cb: (tickets: Ticket[]) => void): Unsubscribe;
  /** Resolve an allow-listed profile by email; null → not on the allow-list. */
  getProfileByEmail(email: string): Promise<UserProfile | null>;
  getCustomer(id: string): Promise<Customer | null>;
  subscribeCustomerCalls(companyId: string, customerId: string, cb: (calls: Call[]) => void): Unsubscribe;
  subscribeCustomerTickets(companyId: string, customerId: string, cb: (t: Ticket[]) => void): Unsubscribe;
  subscribeCustomerEvents(companyId: string, customerId: string, cb: (e: TimelineEvent[]) => void): Unsubscribe;
  // Manage the allow-list (any allow-listed user; enforced by security rules).
  subscribeAllowlist(companyId: string, cb: (entries: AllowlistEntry[]) => void): Unsubscribe;
  addUser(email: string, companyId: string): Promise<void>;
  removeUser(email: string): Promise<void>;
  /** Seal a one-time secret; returns its id (used to build the reveal link). */
  createSecret(secret: string, ttlDays?: number): Promise<string>;
  // DIDs: list is read live from Firestore; writes go through the manageDid
  // callable so numbers are normalised to E.164 server-side.
  subscribeDids(companyId: string, cb: (dids: Did[]) => void): Unsubscribe;
  addDid(number: string, label?: string): Promise<void>;
  removeDid(number: string): Promise<void>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const date = (v: unknown): Date | undefined => (v instanceof Timestamp ? v.toDate() : undefined);
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : []);

function mapRinging(id: string, d: DocumentData): RingingDoc {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    callerNumber: str(d.callerNumber),
    didNumber: str(d.didNumber),
    extension: str(d.extension),
    startedAt: date(d.startedAt),
  };
}

function mapCall(id: string, d: DocumentData): Call {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    direction: (str(d.direction) as CallDirection) ?? 'inbound',
    status: (str(d.status) as CallStatus) ?? 'ringing',
    callerNumber: str(d.callerNumber),
    didNumber: str(d.didNumber),
    answeringExtension: str(d.answeringExtension),
    startTime: date(d.startTime),
    duration: num(d.duration),
    recordingUrl: str(d.recordingUrl),
    ticketId: str(d.ticketId),
  };
}

function mapCustomer(id: string, d: DocumentData): Customer {
  const source = str(d.source);
  return {
    id,
    companyId: str(d.companyId) ?? '',
    name: str(d.name),
    phones: arr(d.phones),
    emails: arr(d.emails),
    source: source === 'email' || source === 'manual' ? source : 'phone',
    tags: arr(d.tags),
    createdAt: date(d.createdAt),
    lastContactAt: date(d.lastContactAt),
  };
}

function mapTicket(id: string, d: DocumentData): Ticket {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    status: (str(d.status) as TicketStatus) ?? 'open',
    subject: str(d.subject),
    lastActivityAt: date(d.lastActivityAt),
  };
}

function mapEvent(id: string, d: DocumentData): TimelineEvent {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    ticketId: str(d.ticketId),
    type: (str(d.type) as EventType) ?? 'note',
    summary: str(d.summary) ?? '',
    at: date(d.at),
  };
}

const byTimeDesc = <T extends { startTime?: Date; at?: Date; lastActivityAt?: Date; startedAt?: Date }>(
  a: T,
  b: T,
): number => {
  const ta = (a.startTime ?? a.at ?? a.lastActivityAt ?? a.startedAt)?.getTime() ?? 0;
  const tb = (b.startTime ?? b.at ?? b.lastActivityAt ?? b.startedAt)?.getTime() ?? 0;
  return tb - ta;
};

export function createFirestoreServices(db: Firestore): Services {
  return {
    subscribeRinging(companyId, cb) {
      const q = query(collection(db, 'ringing'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((s) => mapRinging(s.id, s.data())).sort(byTimeDesc));
      });
    },

    subscribeRecentCalls(companyId, cb) {
      const q = query(
        collection(db, 'calls'),
        where('companyId', '==', companyId),
        orderBy('startTime', 'desc'),
        limit(100),
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((s) => mapCall(s.id, s.data()))));
    },

    async getProfileByEmail(email) {
      const snap = await getDoc(doc(db, 'allowlist', email));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        email,
        companyId: str(d.companyId) ?? '',
        name: str(d.name),
      };
    },

    subscribeCustomers(companyId, cb) {
      const q = query(collection(db, 'customers'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) =>
        cb(
          snap.docs
            .map((s) => mapCustomer(s.id, s.data()))
            .sort((a, b) => (b.lastContactAt?.getTime() ?? 0) - (a.lastContactAt?.getTime() ?? 0)),
        ),
      );
    },

    subscribeTickets(companyId, cb) {
      const q = query(collection(db, 'tickets'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) =>
        cb(snap.docs.map((s) => mapTicket(s.id, s.data())).sort(byTimeDesc)),
      );
    },

    async getCustomer(id) {
      const snap = await getDoc(doc(db, 'customers', id));
      return snap.exists() ? mapCustomer(snap.id, snap.data()) : null;
    },

    subscribeCustomerCalls(companyId, customerId, cb) {
      const q = query(
        collection(db, 'calls'),
        where('companyId', '==', companyId),
        where('customerId', '==', customerId),
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((s) => mapCall(s.id, s.data())).sort(byTimeDesc)));
    },

    subscribeCustomerTickets(companyId, customerId, cb) {
      const q = query(
        collection(db, 'tickets'),
        where('companyId', '==', companyId),
        where('customerId', '==', customerId),
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((s) => mapTicket(s.id, s.data()))));
    },

    subscribeCustomerEvents(companyId, customerId, cb) {
      const q = query(
        collection(db, 'events'),
        where('companyId', '==', companyId),
        where('customerId', '==', customerId),
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((s) => mapEvent(s.id, s.data())).sort(byTimeDesc)));
    },

    subscribeAllowlist(companyId, cb) {
      const q = query(collection(db, 'allowlist'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) =>
        cb(
          snap.docs
            .map((s) => ({ email: s.id, companyId: str(s.data().companyId) ?? '' }))
            .sort((a, b) => a.email.localeCompare(b.email)),
        ),
      );
    },

    async addUser(email, companyId) {
      await setDoc(doc(db, 'allowlist', email.trim().toLowerCase()), { companyId });
    },

    async removeUser(email) {
      await deleteDoc(doc(db, 'allowlist', email));
    },

    async createSecret(secret, ttlDays = 7) {
      const ref = doc(collection(db, 'secrets'));
      await setDoc(ref, {
        secret,
        status: 'sealed',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      });
      return ref.id;
    },

    subscribeDids(companyId, cb) {
      const q = query(collection(db, 'dids'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) =>
        cb(
          snap.docs
            .map((s) => ({ number: str(s.data().number) ?? '', ...(str(s.data().label) !== undefined ? { label: str(s.data().label) } : {}) }))
            .filter((d) => d.number.length > 0)
            .sort((a, b) => a.number.localeCompare(b.number)),
        ),
      );
    },

    async addDid(number, label) {
      await httpsCallable(functions, 'manageDid')({ action: 'add', number, ...(label ? { label } : {}) });
    },

    async removeDid(number) {
      await httpsCallable(functions, 'manageDid')({ action: 'remove', number });
    },
  };
}
