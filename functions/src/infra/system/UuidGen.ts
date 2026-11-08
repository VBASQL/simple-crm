import { randomUUID } from 'node:crypto';
import type { IdGen } from '../../domain/ports/IdGen.js';

export class UuidGen implements IdGen {
  next(): string {
    return randomUUID();
  }
}
