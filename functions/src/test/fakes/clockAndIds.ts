import type { Clock } from '../../domain/ports/Clock.js';
import type { IdGen } from '../../domain/ports/IdGen.js';
import type { Logger } from '../../domain/ports/Logger.js';

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  set(date: Date): void {
    this.current = date;
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SeqIdGen implements IdGen {
  private n = 0;
  constructor(private readonly prefix = 'id') {}
  next(): string {
    this.n += 1;
    return `${this.prefix}-${this.n}`;
  }
}

export class NoopLogger implements Logger {
  child(): Logger {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export interface LogLine {
  level: 'debug' | 'info' | 'warn' | 'error';
  obj: Record<string, unknown>;
  msg: string;
}

export class CapturingLogger implements Logger {
  readonly lines: LogLine[];
  constructor(lines: LogLine[] = []) {
    this.lines = lines;
  }

  child(): Logger {
    // Share the same sink so assertions see every line from child loggers too.
    return new CapturingLogger(this.lines);
  }
  debug(obj: Record<string, unknown>, msg: string): void {
    this.lines.push({ level: 'debug', obj, msg });
  }
  info(obj: Record<string, unknown>, msg: string): void {
    this.lines.push({ level: 'info', obj, msg });
  }
  warn(obj: Record<string, unknown>, msg: string): void {
    this.lines.push({ level: 'warn', obj, msg });
  }
  error(obj: Record<string, unknown>, msg: string): void {
    this.lines.push({ level: 'error', obj, msg });
  }
}
