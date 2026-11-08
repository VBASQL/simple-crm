// Seed the emulators with a company, an agent sign-in, a customer, a few calls
// and one live "ringing" doc so the SPA has something to show.
//
// Run with the emulators up:
//   firebase emulators:start --only functions,firestore,auth   (in one shell)
//   npm run seed                                                 (in another)
//
// Then sign in to the web app with the printed credentials.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

const PROJECT_ID = 'demo-simple-crm';
const COMPANY = 'co-1';
const EMAIL = 'agent@example.com';
const PASSWORD = 'password123';
const CUSTOMER = 'cust-1';

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

async function ensureAgent() {
  try {
    const existing = await auth.getUserByEmail(EMAIL);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email: EMAIL, password: PASSWORD });
    return created.uid;
  }
}

const now = Date.now();

await db.doc(`companies/${COMPANY}`).set({
  name: 'Acme Ltd',
  timezone: 'Asia/Jerusalem',
  language: 'he',
  ticketAutoCloseDays: 14,
  retentionMonths: 12,
});
await db.doc('dids/d1').set({ number: '+97237654321', companyId: COMPANY, label: 'Main line' });

const uid = await ensureAgent();
await db.doc(`users/${uid}`).set({ companyId: COMPANY, role: 'agent', name: 'Dana', extension: '201' });

await db.doc(`customers/${CUSTOMER}`).set({
  companyId: COMPANY,
  name: 'Yossi Cohen',
  phones: ['+972521234567'],
  emails: [],
  source: 'phone',
  createdAt: new Date(now - 86_400_000),
  lastContactAt: new Date(now),
  tags: [],
});

await db.doc(`tickets/tk-1`).set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  status: 'open',
  subject: 'Delivery question',
  openedBy: 'call',
  openedAt: new Date(now - 7_200_000),
  lastActivityAt: new Date(now - 3_600_000),
});

await db.doc('calls/seed-1').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  direction: 'inbound',
  status: 'answered',
  callerNumber: '+972521234567',
  didNumber: '+97237654321',
  answeringExtension: '201',
  startTime: new Date(now - 3_600_000),
  duration: 42,
  ticketId: 'tk-1',
  lastEventAt: new Date(now - 3_600_000),
});
await db.doc('events/ev-1').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  ticketId: 'tk-1',
  type: 'call',
  summary: 'inbound call (answered)',
  at: new Date(now - 3_600_000),
  source: 'globalex',
});

// A live ring to trigger the pop-up.
await db.doc('ringing/seed-ring').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  callerNumber: '+972521234567',
  didNumber: '+97237654321',
  extension: '201',
  startedAt: new Date(now),
  expiresAt: new Date(now + 120_000),
});

console.log('Seeded emulator project', PROJECT_ID);
console.log('Sign in at the web app with:');
console.log('  email:   ', EMAIL);
console.log('  password:', PASSWORD);
