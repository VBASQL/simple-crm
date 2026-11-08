/**
 * Cloud Functions entrypoint. Each export here is one deployed function.
 * Handlers are thin composition roots under app/; all logic is in domain/.
 */
export { globalexWebhook } from './http/globalexWebhook.js';

// Phase 2+: emailIntake, copyRecordings, autoCloseTickets, sweepRinging.
