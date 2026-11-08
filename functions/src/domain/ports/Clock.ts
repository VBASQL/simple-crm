/** The only source of "now" in domain code; never call Date.now() directly. */
export interface Clock {
  now(): Date;
}
