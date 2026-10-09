/** Neutralises LIKE wildcards so a literal `%` or `_` in a search term is matched as text. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
