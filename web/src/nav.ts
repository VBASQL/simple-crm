import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Back navigation that always returns to where you came from. Every link into a
 * detail page carries the current location as `?back=…`; the detail page reads
 * it and its Back button returns there (falling back to a sensible default).
 * This chains: call → view ticket → back lands on the call, not a fixed list.
 */
export function withBack(to: string, from: string): string {
  const sep = to.includes('?') ? '&' : '?';
  return `${to}${sep}back=${encodeURIComponent(from)}`;
}

/** A helper bound to the current location: linkTo(path) adds the back param. */
export function useLinkTo(): (to: string) => string {
  const loc = useLocation();
  const here = loc.pathname + loc.search;
  return (to: string) => withBack(to, here);
}

/** The Back target for a detail page: the `back` param, else a fallback. */
export function useBackTarget(fallback: string): string {
  const [params] = useSearchParams();
  return params.get('back') ?? fallback;
}
