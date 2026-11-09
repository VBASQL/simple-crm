import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';

import type {
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
  /** Resolve an allow-listed profile by email; null → not on the allow-list. */
  getProfileByEmail(email: string): Promise<UserProfile | null>;
  getCustomer(id: string): Promise<Customer | null>;
  subscribeCustomerCalls(companyId: string, customerId: string, cb: (calls: Call[]) => void): Unsubscribe;
  subscribeCustomerTickets(companyId: string, customerId: string, cb: (t: Ticket[]) => void): Unsubscribe;
  subscribeCustomerEvents(companyId: string, customerId: string, cb: (e: TimelineEvent[]) => void): Unsubscribe;
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
      const role = str(d.role) === 'admin' ? 'admin' : 'agent';
      return {
        email,
        companyId: str(d.companyId) ?? '',
        name: str(d.name),
        role,
      };
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
  };
}
