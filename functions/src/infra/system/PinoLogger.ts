import pino from 'pino';
import type { Logger } from '../../domain/ports/Logger.js';

/** Pino-backed Logger port. The `err` serializer prints nested `cause` chains. */
export class PinoLogger implements Logger {
  private readonly logger: pino.Logger;

  constructor(levelOrLogger: string | pino.Logger = 'info') {
    this.logger =
      typeof levelOrLogger === 'string'
        ? pino({ level: levelOrLogger, serializers: { err: pino.stdSerializers.err } })
        : levelOrLogger;
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.logger.child(bindings));
  }

  debug(obj: Record<string, unknown>, msg: string): void {
    this.logger.debug(obj, msg);
  }

  info(obj: Record<string, unknown>, msg: string): void {
    this.logger.info(obj, msg);
  }

  warn(obj: Record<string, unknown>, msg: string): void {
    this.logger.warn(obj, msg);
  }

  error(obj: Record<string, unknown>, msg: string): void {
    this.logger.error(obj, msg);
  }
}
