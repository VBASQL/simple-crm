import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { Logger } from '../domain/ports/Logger.js';
import type { Clock } from '../domain/ports/Clock.js';
import type { IdGen } from '../domain/ports/IdGen.js';
import type { RawEventStore } from '../domain/ports/RawEventStore.js';
import { CallService } from '../domain/calls/CallService.js';
import { CustomerService } from '../domain/customers/CustomerService.js';
import { TicketService } from '../domain/tickets/TicketService.js';
import { TicketPolicy } from '../domain/tickets/TicketPolicy.js';
import { PhoneNormalizer } from '../domain/customers/PhoneNormalizer.js';

import { SystemClock } from '../infra/system/SystemClock.js';
import { UuidGen } from '../infra/system/UuidGen.js';
import { PinoLogger } from '../infra/system/PinoLogger.js';
import { FirestoreCompanyRepo } from '../infra/firestore/FirestoreCompanyRepo.js';
import { FirestoreCustomerRepo } from '../infra/firestore/FirestoreCustomerRepo.js';
import { FirestoreCallRepo } from '../infra/firestore/FirestoreCallRepo.js';
import { FirestoreTicketRepo } from '../infra/firestore/FirestoreTicketRepo.js';
import { FirestoreEventRepo } from '../infra/firestore/FirestoreEventRepo.js';
import { FirestoreRingingRepo } from '../infra/firestore/FirestoreRingingRepo.js';
import { FirestoreRawEventStore } from '../infra/firestore/FirestoreRawEventStore.js';

import { ApiKeyAuth } from './http/ApiKeyAuth.js';
import { loadConfig, type Config } from './config.js';

/** The object graph, built once per cold start (CLAUDE.md §3). */
export interface Container {
  readonly config: Config;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly ids: IdGen;
  readonly auth: ApiKeyAuth;
  readonly callService: CallService;
  readonly rawEvents: RawEventStore;
}

export function buildContainer(cfg: Config): Container {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const logger = new PinoLogger(cfg.logLevel);
  const clock = new SystemClock();
  const ids = new UuidGen();
  const phones = new PhoneNormalizer();

  const companyRepo = new FirestoreCompanyRepo(db);
  const customerRepo = new FirestoreCustomerRepo(db);
  const callRepo = new FirestoreCallRepo(db);
  const ticketRepo = new FirestoreTicketRepo(db);
  const eventRepo = new FirestoreEventRepo(db);
  const ringingRepo = new FirestoreRingingRepo(db);

  const customerService = new CustomerService(customerRepo, clock, ids);
  const ticketService = new TicketService(
    ticketRepo,
    clock,
    ids,
    new TicketPolicy(14), // default; per-company override is resolved per call in a follow-up
  );

  const callService = new CallService(
    companyRepo,
    customerService,
    ticketService,
    callRepo,
    eventRepo,
    ringingRepo,
    clock,
    ids,
    phones,
  );

  return {
    config: cfg,
    logger,
    clock,
    ids,
    auth: new ApiKeyAuth(cfg.apiKeys),
    callService,
    rawEvents: new FirestoreRawEventStore(db),
  };
}

let instance: Container | undefined;

/** Lazily built and reused across invocations within a warm instance. */
export function getContainer(): Container {
  if (instance === undefined) instance = buildContainer(loadConfig());
  return instance;
}
