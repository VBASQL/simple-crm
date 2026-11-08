/**
 * Structured logger port. Domain services receive it only to emit `info`/`warn`
 * decisions; they never log errors (those are thrown and logged once at the
 * composition root). See CLAUDE.md §5.
 */
export interface Logger {
  child(bindings: Record<string, unknown>): Logger;
  debug(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}
