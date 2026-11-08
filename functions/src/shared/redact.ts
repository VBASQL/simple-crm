/**
 * Masking helpers for anything that must never reach a log line: API keys,
 * recording URLs with tokens, email bodies. See CLAUDE.md §5.
 */

/** Keep the last `visible` characters, mask the rest. */
export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}

/** Strip the query string (which may carry a fileid/token) from a URL. */
export function redactUrl(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : `${url.slice(0, q)}?[redacted]`;
}

/** A phone number shown in logs as +9725…1234 (middle masked). */
export function redactPhone(e164: string): string {
  if (e164.length <= 6) return '*'.repeat(e164.length);
  return `${e164.slice(0, 4)}${'*'.repeat(e164.length - 8)}${e164.slice(-4)}`;
}
