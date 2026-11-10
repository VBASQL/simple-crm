import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { TicketRepo } from '../../domain/ports/TicketRepo.js';
import type { Ticket, TicketOpenedBy, TicketStatus } from '../../domain/tickets/types.js';
import { optString, requireDate, toDate } from './mappers.js';

export class FirestoreTicketRepo implements TicketRepo {
  constructor(private readonly db: Firestore) {}

  async findOpen(companyId: string, customerId: string): Promise<Ticket | null> {
    // A client may have several open tickets; a call routes to the most
    // recently active one. We fetch the client's open/pending tickets (there
    // are few) and pick the most recent in code — deterministic, and no
    // composite index needed (two equality filters + an `in`).
    const snap = await this.db
      .collection('tickets')
      .where('companyId', '==', companyId)
      .where('customerId', '==', customerId)
      .where('status', 'in', ['open', 'pending'])
      .get();
    const open = snap.docs
      .map((d) => this.map(d.id, d.data()))
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    return open[0] ?? null;
  }

  async create(ticket: Ticket): Promise<Ticket> {
    await this.db.collection('tickets').doc(ticket.id).set(this.toDoc(ticket));
    return ticket;
  }

  async save(ticket: Ticket): Promise<void> {
    await this.db.collection('tickets').doc(ticket.id).set(this.toDoc(ticket), { merge: true });
  }

  private toDoc(t: Ticket): DocumentData {
    return {
      companyId: t.companyId,
      customerId: t.customerId,
      status: t.status,
      openedBy: t.openedBy,
      openedAt: t.openedAt,
      lastActivityAt: t.lastActivityAt,
      ...(t.subject !== undefined ? { subject: t.subject } : {}),
      ...(t.closedAt !== undefined ? { closedAt: t.closedAt } : {}),
      ...(t.assignedTo !== undefined ? { assignedTo: t.assignedTo } : {}),
    };
  }

  private map(id: string, data: DocumentData): Ticket {
    const status = (['open', 'pending', 'closed'] as TicketStatus[]).includes(data.status as TicketStatus)
      ? (data.status as TicketStatus)
      : 'open';
    const openedBy = (['call', 'email', 'manual'] as TicketOpenedBy[]).includes(data.openedBy as TicketOpenedBy)
      ? (data.openedBy as TicketOpenedBy)
      : 'manual';
    return {
      id,
      companyId: optString(data.companyId) ?? '',
      customerId: optString(data.customerId) ?? '',
      status,
      openedBy,
      openedAt: requireDate(data.openedAt, 'openedAt'),
      lastActivityAt: requireDate(data.lastActivityAt, 'lastActivityAt'),
      ...(optString(data.subject) !== undefined ? { subject: optString(data.subject) as string } : {}),
      ...(toDate(data.closedAt) !== undefined ? { closedAt: toDate(data.closedAt) as Date } : {}),
      ...(optString(data.assignedTo) !== undefined ? { assignedTo: optString(data.assignedTo) as string } : {}),
    };
  }
}
