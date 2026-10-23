/**
 * Bank references are compared without case or whitespace: staff retype them from a banking app
 * or a screenshot, so "ft 123" and "FT123" are the same transfer.
 */
export function normalizeTransferRef(ref: string): string {
  return ref.replace(/\s+/g, '').toUpperCase();
}

/** SQL twin of `normalizeTransferRef` for a jsonb text expression. */
export const normalizedRefSql = (expression: string): string =>
  `upper(regexp_replace(${expression}, '\\s', '', 'g'))`;
