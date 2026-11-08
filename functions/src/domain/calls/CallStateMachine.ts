import { assertNever } from '../../shared/assertNever.js';
import type { CallStatus } from './types.js';

/** The lifecycle events that drive status; CDR finalisation is computed apart. */
export type LifecycleEvent = 'ring' | 'answer' | 'hangup';

export type Transition =
  | { readonly applied: true; readonly status: CallStatus }
  | { readonly applied: false; readonly reason: string };

const apply = (status: CallStatus): Transition => ({ applied: true, status });
const ignore = (reason: string): Transition => ({ applied: false, reason });

/**
 * Pure status transitions for a call. Illegal / out-of-lifecycle transitions
 * return `{ applied: false }` so the root can log a `warn` and drop them —
 * never a silent throw (CLAUDE.md §6). `voicemail` is set only by CDR.
 */
export class CallStateMachine {
  transition(current: CallStatus | undefined, event: LifecycleEvent): Transition {
    switch (event) {
      case 'ring':
        if (current === undefined || current === 'ringing') return apply('ringing');
        return ignore(`ring after ${current}`);
      case 'answer':
        if (current === 'missed' || current === 'voicemail') return ignore(`answer after ${current}`);
        return apply('answered');
      case 'hangup':
        if (current === 'answered') return apply('answered');
        if (current === 'voicemail') return ignore('hangup after voicemail');
        return apply('missed');
      default:
        return assertNever(event);
    }
  }
}
