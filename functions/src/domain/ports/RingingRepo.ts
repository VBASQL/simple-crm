import type { RingingDoc } from '../calls/types.js';

export interface RingingRepo {
  set(doc: RingingDoc): Promise<void>;
  delete(callId: string): Promise<void>;
}
