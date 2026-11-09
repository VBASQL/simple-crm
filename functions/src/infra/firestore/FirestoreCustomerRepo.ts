import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { CustomerRepo } from '../../domain/ports/CustomerRepo.js';
import type { Customer, CustomerSource } from '../../domain/customers/types.js';
import { optString, requireDate } from './mappers.js';

export class FirestoreCustomerRepo implements CustomerRepo {
  constructor(private readonly db: Firestore) {}

  async getById(id: string): Promise<Customer | null> {
    const doc = await this.db.collection('customers').doc(id).get();
    const data = doc.data();
    return data === undefined ? null : this.map(doc.id, data);
  }

  async findByPhone(companyId: string, phoneE164: string): Promise<Customer | null> {
    const snap = await this.db
      .collection('customers')
      .where('companyId', '==', companyId)
      .where('phones', 'array-contains', phoneE164)
      .limit(1)
      .get();
    const doc = snap.docs[0];
    return doc ? this.map(doc.id, doc.data()) : null;
  }

  async findByEmail(companyId: string, email: string): Promise<Customer | null> {
    const snap = await this.db
      .collection('customers')
      .where('companyId', '==', companyId)
      .where('emails', 'array-contains', email.toLowerCase())
      .limit(1)
      .get();
    const doc = snap.docs[0];
    return doc ? this.map(doc.id, doc.data()) : null;
  }

  async create(customer: Customer): Promise<Customer> {
    await this.db.collection('customers').doc(customer.id).set(this.toDoc(customer));
    return customer;
  }

  async save(customer: Customer): Promise<void> {
    await this.db.collection('customers').doc(customer.id).set(this.toDoc(customer), { merge: true });
  }

  private toDoc(c: Customer): DocumentData {
    return {
      companyId: c.companyId,
      phones: [...c.phones],
      emails: [...c.emails],
      source: c.source,
      createdAt: c.createdAt,
      lastContactAt: c.lastContactAt,
      tags: [...c.tags],
      ...(c.name !== undefined ? { name: c.name } : {}),
      ...(c.mergedInto !== undefined ? { mergedInto: c.mergedInto } : {}),
    };
  }

  private map(id: string, data: DocumentData): Customer {
    const source = data.source as CustomerSource;
    return {
      id,
      companyId: optString(data.companyId) ?? '',
      phones: Array.isArray(data.phones) ? (data.phones as string[]) : [],
      emails: Array.isArray(data.emails) ? (data.emails as string[]) : [],
      source: source === 'email' || source === 'manual' ? source : 'phone',
      createdAt: requireDate(data.createdAt, 'createdAt'),
      lastContactAt: requireDate(data.lastContactAt, 'lastContactAt'),
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      ...(optString(data.name) !== undefined ? { name: optString(data.name) as string } : {}),
      ...(optString(data.mergedInto) !== undefined ? { mergedInto: optString(data.mergedInto) as string } : {}),
    };
  }
}
