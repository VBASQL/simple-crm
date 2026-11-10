import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  CompanySettings,
  Note,
  Call,
  CallDirection,
  CallStatus,
  Customer,
  RingingDoc,
  Ticket,
  TicketStatus,
  TimelineEvent,
  EventType,
} from '../types.js';

export type Unsubscribe = () => void;

/** The read API the SPA depends on. Injected via context so screens are testable. */
export interface Services {
  subscribeRinging(companyId: string, cb: (docs: RingingDoc[]) => void): Unsubscribe;
  subscribeRecentCalls(companyId: string, cb: (calls: Call[]) => void): Unsubscribe;
  subscribeCustomers(companyId: string, cb: (customers: Customer[]) => void): Unsubscribe;
  subscribeTickets(companyId: string, cb: (tickets: Ticket[]) => void): Unsubscribe;
  /**
   * The companies an email may access; null → not on the allow-list. A member
   * can belong to several companies (the user switches between them).
   */
  getMembership(email: string): Promise<{ companyIds: string[]; name?: string } | null>;
  /** A company's display info (its name), for the switcher and headers. */
  getCompany(id: string): Promise<{ id: string; name?: string }>;
  /** Provision a new company (the caller becomes a member). Returns its id. */
  createCompany(name: string): Promise<{ id: string; name: string }>;
  /** Live company configuration, and a patch to update it (the Settings screen). */
  subscribeCompanySettings(companyId: string, cb: (s: CompanySettings) => void): Unsubscribe;
  updateCompanySettings(companyId: string, patch: Partial<Omit<CompanySettings, 'id'>>): Promise<void>;
  getCustomer(id: string): Promise<Customer | null>;
  subscribeCustomerCalls(companyId: string, customerId: string, cb: (calls: Call[]) => void): Unsubscribe;
  subscribeCustomerTickets(companyId: string, customerId: string, cb: (t: Ticket[]) => void): Unsubscribe;
  subscribeCustomerEvents(companyId: string, customerId: string, cb: (e: TimelineEvent[]) => void): Unsubscribe;
  // Manage the allow-list (any allow-listed user; enforced by security rules).
  subscribeAllowlist(companyId: string, cb: (entries: AllowlistEntry[]) => void): Unsubscribe;
  addUser(email: string, companyId: string): Promise<void>;
  /** Remove a user from one company (the doc is deleted only when none remain). */
  removeUser(email: string, companyId: string): Promise<void>;
  /** Seal a one-time secret; returns its id (used to build the reveal link). */
  createSecret(secret: string, ttlDays?: number): Promise<string>;
  // DIDs: list is read live from Firestore; writes go through the manageDid
  // callable so numbers are normalised to E.164 server-side.
  subscribeDids(companyId: string, cb: (dids: Did[]) => void): Unsubscribe;
  addDid(number: string, companyId: string, label?: string): Promise<void>;
  removeDid(number: string, companyId: string): Promise<void>;
  // A single ticket and its own slice of the timeline, for the ticket detail
  // view. Live so one agent's change (close, note) shows for another at once.
  subscribeTicket(ticketId: string, cb: (ticket: Ticket | null) => void): Unsubscribe;
  subscribeTicketEvents(companyId: string, ticketId: string, cb: (e: TimelineEvent[]) => void): Unsubscribe;
  /** One call, live — the call detail page (and taking notes during a call). */
  subscribeCall(callId: string, cb: (call: Call | null) => void): Unsubscribe;
  // Agent CRM actions. These are user-initiated edits (not call-engine writes),
  // so they go straight to Firestore guarded by security rules, with server
  // timestamps. The engine keeps its own Admin-SDK write path.
  setTicketStatus(ticketId: string, status: TicketStatus): Promise<void>;
  setTicketSubject(ticketId: string, subject: string): Promise<void>;
  /** Pin / unpin so a record sorts to the top of its list. */
  setTicketPinned(ticketId: string, pinned: boolean): Promise<void>;
  setCustomerPinned(customerId: string, pinned: boolean): Promise<void>;
  /**
   * Log a manual INTERACTION not captured automatically — a call on another
   * phone, an email, or an in-person meeting. Writes an interaction event on a
   * ticket (source 'manual', never confused with an engine-captured event).
   */
  logInteraction(input: {
    companyId: string;
    customerId: string;
    ticketId: string;
    type: InteractionType;
    text: string;
    author?: string;
  }): Promise<void>;
  /** Move an interaction event to a different ticket of the same customer. */
  moveEvent(eventId: string, toTicketId: string): Promise<void>;

  // Notes — free-text commentary, separate from interaction events. A note
  // hangs off a customer and may be narrowed to a ticket, call or event.
  subscribeNotes(companyId: string, customerId: string, cb: (notes: Note[]) => void): Unsubscribe;
  addNote(input: {
    companyId: string;
    customerId: string;
    ticketId?: string;
    callId?: string;
    eventId?: string;
    text: string;
    author?: string;
  }): Promise<void>;
  deleteNote(noteId: string): Promise<void>;
}

/** The interaction kinds an agent may log by hand (notes are separate). */
export type InteractionType = 'call' | 'email' | 'meeting';

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** The companies on an allow-list entry, in either the list or legacy form. */
const entryCompaniesOf = (d: DocumentData): string[] => {
  if (Array.isArray(d.companyIds)) return d.companyIds.filter((x): x is string => typeof x === 'string');
  return typeof d.companyId === 'string' ? [d.companyId] : [];
};
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
    ...(d.pinned === true ? { pinned: true } : {}),
  };
}

function mapTicket(id: string, d: DocumentData): Ticket {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    status: (str(d.status) as TicketStatus) ?? 'open',
    subject: str(d.subject),
    openedAt: date(d.openedAt),
    lastActivityAt: date(d.lastActivityAt),
    ...(d.pinned === true ? { pinned: true } : {}),
  };
}

/** Pinned first, then fall back to the caller's ordering (recency). */
const pinnedFirst = <T extends { pinned?: boolean }>(rest: (a: T, b: T) => number) => (a: T, b: T): number =>
  (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || rest(a, b);

function mapEvent(id: string, d: DocumentData): TimelineEvent {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    ticketId: str(d.ticketId),
    type: (str(d.type) as EventType) ?? 'note',
    summary: str(d.summary) ?? '',
    ...(typeof d.payload === 'object' && d.payload !== null ? { payload: d.payload as Record<string, unknown> } : {}),
    at: date(d.at),
  };
}

function mapNote(id: string, d: DocumentData): Note {
  return {
    id,
    companyId: str(d.companyId) ?? '',
    customerId: str(d.customerId) ?? '',
    ...(str(d.ticketId) !== undefined ? { ticketId: str(d.ticketId) } : {}),
    ...(str(d.callId) !== undefined ? { callId: str(d.callId) } : {}),
    ...(str(d.eventId) !== undefined ? { eventId: str(d.eventId) } : {}),
    text: str(d.text) ?? '',
    ...(str(d.author) !== undefined ? { author: str(d.author) } : {}),
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

    async getMembership(email) {
      const snap = await getDoc(doc(db, 'allowlist', email));
      if (!snap.exists()) return null;
      const d = snap.data();
      const companyIds = entryCompaniesOf(d);
      return { companyIds, ...(str(d.name) !== undefined ? { name: str(d.name) as string } : {}) };
    },

    async getCompany(id) {
      const snap = await getDoc(doc(db, 'companies', id));
      return { id, ...(snap.exists() && str(snap.data().name) !== undefined ? { name: str(snap.data().name) as string } : {}) };
    },

    async createCompany(name) {
      const res = await httpsCallable(functions, 'manageCompany')({ action: 'create', name });
      const company = (res.data as { company?: { id?: string; name?: string } }).company ?? {};
      return { id: company.id ?? '', name: company.name ?? name };
    },

    subscribeCompanySettings(companyId, cb) {
      return onSnapshot(doc(db, 'companies', companyId), (snap) => {
        const d = snap.data() ?? {};
        const lang = str(d.language);
        cb({
          id: companyId,
          ...(str(d.name) !== undefined ? { name: str(d.name) as string } : {}),
          ...(lang === 'he' || lang === 'en' ? { language: lang } : {}),
          ...(str(d.timezone) !== undefined ? { timezone: str(d.timezone) as string } : {}),
          ...(num(d.ticketAutoCloseDays) !== undefined ? { ticketAutoCloseDays: num(d.ticketAutoCloseDays) as number } : {}),
          ...(num(d.retentionMonths) !== undefined ? { retentionMonths: num(d.retentionMonths) as number } : {}),
        });
      });
    },

    async updateCompanySettings(companyId, patch) {
      await updateDoc(doc(db, 'companies', companyId), patch);
    },

    subscribeCustomers(companyId, cb) {
      const q = query(collection(db, 'customers'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) =>
        cb(
          snap.docs
            .map((s) => mapCustomer(s.id, s.data()))
            .sort(pinnedFirst((a, b) => (b.lastContactAt?.getTime() ?? 0) - (a.lastContactAt?.getTime() ?? 0))),
        ),
      );
    },

    subscribeTickets(companyId, cb) {
      const q = query(collection(db, 'tickets'), where('companyId', '==', companyId));
      return onSnapshot(q, (snap) =>
        cb(snap.docs.map((s) => mapTicket(s.id, s.data())).sort(pinnedFirst(byTimeDesc))),
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
      // Members of this company come in two shapes: new entries carry a
      // companyIds array; legacy entries a single companyId. Watch both and
      // merge by email so neither form is missed during the transition.
      let listForm: AllowlistEntry[] = [];
      let legacyForm: AllowlistEntry[] = [];
      const emit = () => {
        const byEmail = new Map<string, AllowlistEntry>();
        for (const e of [...legacyForm, ...listForm]) byEmail.set(e.email, e);
        cb([...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email)));
      };
      const toEntry = (id: string): AllowlistEntry => ({ email: id, companyId });
      const u1 = onSnapshot(query(collection(db, 'allowlist'), where('companyIds', 'array-contains', companyId)), (snap) => {
        listForm = snap.docs.map((s) => toEntry(s.id));
        emit();
      });
      const u2 = onSnapshot(query(collection(db, 'allowlist'), where('companyId', '==', companyId)), (snap) => {
        legacyForm = snap.docs.map((s) => toEntry(s.id));
        emit();
      });
      return () => {
        u1();
        u2();
      };
    },

    async addUser(email, companyId) {
      const ref = doc(db, 'allowlist', email.trim().toLowerCase());
      // Read-modify-write (not arrayUnion) so a legacy single companyId is
      // carried into the list instead of being dropped when we migrate the doc.
      const snap = await getDoc(ref);
      const existing = snap.exists() ? entryCompaniesOf(snap.data()) : [];
      const companyIds = Array.from(new Set([...existing, companyId]));
      await setDoc(ref, { companyIds, companyId: deleteField() }, { merge: true });
    },

    async removeUser(email, companyId) {
      const ref = doc(db, 'allowlist', email);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const remaining = entryCompaniesOf(snap.data()).filter((c) => c !== companyId);
      // Drop the whole entry only when the user has no companies left.
      if (remaining.length === 0) await deleteDoc(ref);
      else await setDoc(ref, { companyIds: remaining, companyId: deleteField() }, { merge: true });
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

    async addDid(number, companyId, label) {
      await httpsCallable(functions, 'manageDid')({ action: 'add', number, companyId, ...(label ? { label } : {}) });
    },

    async removeDid(number, companyId) {
      await httpsCallable(functions, 'manageDid')({ action: 'remove', number, companyId });
    },

    subscribeTicket(ticketId, cb) {
      return onSnapshot(doc(db, 'tickets', ticketId), (snap) =>
        cb(snap.exists() ? mapTicket(snap.id, snap.data()) : null),
      );
    },

    subscribeCall(callId, cb) {
      return onSnapshot(doc(db, 'calls', callId), (snap) =>
        cb(snap.exists() ? mapCall(snap.id, snap.data()) : null),
      );
    },

    subscribeTicketEvents(companyId, ticketId, cb) {
      // Two equality filters, no orderBy — Firestore serves this with a zig-zag
      // merge and needs no composite index (same as subscribeCustomerCalls).
      const q = query(
        collection(db, 'events'),
        where('companyId', '==', companyId),
        where('ticketId', '==', ticketId),
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((s) => mapEvent(s.id, s.data())).sort(byTimeDesc)));
    },

    async setTicketStatus(ticketId, status) {
      // closedAt drives "closed 3d ago" and the retention job; clear it on
      // reopen so a resumed ticket is never mistaken for a closed one.
      await updateDoc(doc(db, 'tickets', ticketId), {
        status,
        lastActivityAt: serverTimestamp(),
        closedAt: status === 'closed' ? serverTimestamp() : deleteField(),
      });
    },

    async setTicketSubject(ticketId, subject) {
      await updateDoc(doc(db, 'tickets', ticketId), { subject, lastActivityAt: serverTimestamp() });
    },

    async setTicketPinned(ticketId, pinned) {
      // Clear the field when unpinning so it never lingers as pinned:false.
      await updateDoc(doc(db, 'tickets', ticketId), { pinned: pinned ? true : deleteField() });
    },

    async setCustomerPinned(customerId, pinned) {
      await updateDoc(doc(db, 'customers', customerId), { pinned: pinned ? true : deleteField() });
    },

    async logInteraction({ companyId, customerId, ticketId, type, text, author }) {
      // An interaction is a first-class timeline event — same shape the engine
      // writes — so it threads into the ticket next to captured calls. source
      // 'manual' keeps it distinct from engine events.
      await addDoc(collection(db, 'events'), {
        companyId,
        customerId,
        ticketId,
        type,
        summary: text,
        payload: author !== undefined ? { author } : {},
        at: serverTimestamp(),
        source: 'manual',
      });
      // Logging activity bumps the ticket so it sorts up and stays off the
      // auto-close path.
      await updateDoc(doc(db, 'tickets', ticketId), { lastActivityAt: serverTimestamp() });
    },

    async moveEvent(eventId, toTicketId) {
      // Only ticketId changes (rules enforce it); the event's content is intact.
      await updateDoc(doc(db, 'events', eventId), { ticketId: toTicketId });
    },

    subscribeNotes(companyId, customerId, cb) {
      const q = query(
        collection(db, 'notes'),
        where('companyId', '==', companyId),
        where('customerId', '==', customerId),
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((s) => mapNote(s.id, s.data())).sort(byTimeDesc)));
    },

    async addNote({ companyId, customerId, ticketId, callId, eventId, text, author }) {
      await addDoc(collection(db, 'notes'), {
        companyId,
        customerId,
        ...(ticketId !== undefined ? { ticketId } : {}),
        ...(callId !== undefined ? { callId } : {}),
        ...(eventId !== undefined ? { eventId } : {}),
        text,
        ...(author !== undefined ? { author } : {}),
        at: serverTimestamp(),
      });
      // A note on a ticket counts as activity too.
      if (ticketId !== undefined) {
        await updateDoc(doc(db, 'tickets', ticketId), { lastActivityAt: serverTimestamp() });
      }
    },

    async deleteNote(noteId) {
      await deleteDoc(doc(db, 'notes', noteId));
    },
  };
}
