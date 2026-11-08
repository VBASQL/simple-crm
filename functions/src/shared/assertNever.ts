/**
 * Compile-time exhaustiveness guard. Put it in the `default:` of every switch
 * over a union (event, disposition, direction, rule action). If a new variant
 * is added and a branch is missed, this fails to type-check. See CLAUDE.md §6.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled union variant: ${JSON.stringify(value)}`);
}
