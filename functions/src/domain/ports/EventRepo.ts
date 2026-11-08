import type { TimelineEvent } from '../events/types.js';

export interface EventRepo {
  append(event: TimelineEvent): Promise<void>;
}
