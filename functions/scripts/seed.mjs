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
const COMPANY2 = 'co-2';
const CUSTOMER = 'cust-1';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.length > 0);

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const now = Date.now();

// A tiny self-contained WAV (a short 440 Hz beep) as a data URI, so a seeded
// recording actually plays in the browser offline. In production, recordingUrl
// is Globalex's real play.php URL — this is only to demo the inline player.
function demoRecording() {
  const rate = 8000;
  const secs = 0.4;
  const n = Math.floor(rate * secs);
  const data = Buffer.alloc(n);
  for (let i = 0; i < n; i += 1) {
    data[i] = 128 + Math.round(70 * Math.sin((2 * Math.PI * 440 * i) / rate) * (1 - i / n));
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + n, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34); // 8-bit
  header.write('data', 36);
  header.writeUInt32LE(n, 40);
  return `data:audio/wav;base64,${Buffer.concat([header, data]).toString('base64')}`;
}
const RECORDING = demoRecording();

await db.doc(`companies/${COMPANY}`).set({
  name: 'Acme Ltd',
  timezone: 'Asia/Jerusalem',
  language: 'he',
  ticketAutoCloseDays: 14,
  retentionMonths: 12,
});
// A second company, to exercise the company switcher. Its data is isolated.
await db.doc(`companies/${COMPANY2}`).set({
  name: 'Globex',
  timezone: 'Asia/Jerusalem',
  language: 'he',
  ticketAutoCloseDays: 14,
  retentionMonths: 12,
});
await db.doc('dids/d1').set({ number: '+97237654321', companyId: COMPANY, label: 'Main line' });
await db.doc('dids/d2').set({ number: '+97239998888', companyId: COMPANY2, label: 'Globex line' });
await db.doc('customers/cust-2').set({
  companyId: COMPANY2,
  name: 'Dana Levi',
  phones: ['+972547776655'],
  emails: [],
  source: 'phone',
  createdAt: new Date(now - 86_400_000),
  lastContactAt: new Date(now - 3_600_000),
  tags: [],
});

// Allow-list: each email may sign in with Google and belongs to BOTH companies
// (companyIds), so the switcher has something to switch between.
for (const email of ALLOWED_EMAILS) {
  await db.doc(`allowlist/${email}`).set({ companyIds: [COMPANY, COMPANY2], name: email.split('@')[0] });
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
// A second ticket, so a call/interaction can be moved between tickets.
await db.doc(`tickets/tk-2`).set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  status: 'open',
  subject: 'Billing follow-up',
  openedBy: 'manual',
  openedAt: new Date(now - 600_000),
  lastActivityAt: new Date(now - 600_000),
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
  recordingUrl: RECORDING,
  lastEventAt: new Date(now - 3_600_000),
});
// A voicemail left on the same ticket, with its message as a recording.
await db.doc('calls/seed-vm').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  direction: 'inbound',
  status: 'voicemail',
  callerNumber: '+972521234567',
  didNumber: '+97237654321',
  startTime: new Date(now - 1_800_000),
  duration: 18,
  ticketId: 'tk-1',
  recordingUrl: RECORDING,
  lastEventAt: new Date(now - 1_800_000),
});
// The engine's own call event carries payload.callId (points at its call doc),
// so the ticket timeline shows the call once (from the calls collection) and
// filters this out — matching real engine data.
await db.doc('events/ev-1').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  ticketId: 'tk-1',
  type: 'call',
  summary: 'inbound call (answered)',
  payload: { callId: 'seed-1' },
  at: new Date(now - 3_600_000),
  source: 'globalex',
});
// A manual interaction (email) on the ticket, to show a non-call timeline item.
await db.doc('events/ev-2').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  ticketId: 'tk-1',
  type: 'email',
  summary: 'Sent delivery schedule by email',
  payload: {},
  at: new Date(now - 2_400_000),
  source: 'manual',
});

// A live ring to trigger the pop-up. The engine always writes a calls/{id}
// doc alongside the ringing/{id} doc (same id = call_id), so seed both — this
// is what makes "Open call" from the pop-up land on a real live call page.
await db.doc('calls/seed-ring').set({
  companyId: COMPANY,
  customerId: CUSTOMER,
  direction: 'inbound',
  status: 'ringing',
  callerNumber: '+972521234567',
  didNumber: '+97237654321',
  startTime: new Date(now),
  ticketId: 'tk-1',
  lastEventAt: new Date(now),
});
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
