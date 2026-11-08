import { describe, it, expect } from 'vitest';
import { CallStateMachine } from './CallStateMachine.js';
import type { CallStatus } from './types.js';

const sm = new CallStateMachine();

describe('CallStateMachine', () => {
  it('ring on a new call → ringing', () => {
    expect(sm.transition(undefined, 'ring')).toEqual({ applied: true, status: 'ringing' });
  });

  it('answer → answered from ringing', () => {
    expect(sm.transition('ringing', 'answer')).toEqual({ applied: true, status: 'answered' });
  });

  it('hangup without answer → missed', () => {
    expect(sm.transition('ringing', 'hangup')).toEqual({ applied: true, status: 'missed' });
  });

  it('hangup after answer stays answered', () => {
    expect(sm.transition('answered', 'hangup')).toEqual({ applied: true, status: 'answered' });
  });

  it('ignores a late ring after the call progressed', () => {
    const r = sm.transition('answered', 'ring');
    expect(r.applied).toBe(false);
  });

  it('ignores answer/hangup after a terminal voicemail', () => {
    expect(sm.transition('voicemail', 'answer').applied).toBe(false);
    expect(sm.transition('voicemail', 'hangup').applied).toBe(false);
  });

  it('is idempotent on repeated ring', () => {
    const states: (CallStatus | undefined)[] = [undefined, 'ringing'];
    for (const s of states) {
      expect(sm.transition(s, 'ring')).toEqual({ applied: true, status: 'ringing' });
    }
  });
});
