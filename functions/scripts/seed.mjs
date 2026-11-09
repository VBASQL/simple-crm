// Seed a company, an allow-list (the Google emails permitted to sign in), a
// customer, a few calls and one live "ringing" doc so the SPA has data.
//
// Sign-in is Google (allow-list by email). Set which emails get access:
//   ALLOWED_EMAILS="you@gmail.com,teammate@gmail.com" npm run seed
//
// Emulator (default):  firebase emulators:exec ... "npm run seed"
// Real project:        FIREBASE_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS set.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Target the emulator by default; target a real project when FIREBASE_PROJECT_ID
// is set (CD provides GOOGLE_APPLICATION_CREDENTIALS for the Admin SDK).
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-simple-crm';
const isDemo = PROJECT_ID === 'demo-simple-crm';
if (isDemo) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
}

const COMPANY = 'co-1';
const CUSTOMER = 'cust-1';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.length > 0);

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const now = Date.now();

await db.doc(`companies/${COMPANY}`).set({
  name: 'Acme Ltd',
  timezone: 'Asia/Jerusalem',
  language: 'he',
  ticketAutoCloseDays: 14,
  retentionMonths: 12,
});
await db.doc('dids/d1').set({ number: '+97237654321', companyId: COMPANY, label: 'Main line' });

// Allow-list: each email may sign in with Google and gets this company + role.
for (const email of ALLOWED_EMAILS) {
  await db.doc(`allowlist/${email}`).set({ companyId: COMPANY, role: 'admin', name: email.split('@')[0] });
}

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

console.log('Seeded project', PROJECT_ID);
if (ALLOWED_EMAILS.length === 0) {
  console.log('WARNING: no ALLOWED_EMAILS set — no one can sign in.');
  console.log('Re-run with:  ALLOWED_EMAILS="you@gmail.com" npm run seed');
} else {
  console.log('Allow-listed Google accounts (sign in with these):');
  for (const email of ALLOWED_EMAILS) console.log('  -', email);
}
