/** Result of a one-time-secret reveal attempt. */
export type RevealResult =
  | { readonly kind: 'revealed'; readonly secret: string; readonly claimToken: string }
  | { readonly kind: 'gone' };
