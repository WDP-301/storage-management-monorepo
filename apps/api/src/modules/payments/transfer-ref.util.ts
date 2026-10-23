import type { EntityManager } from 'typeorm';

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

/**
 * Serialises everyone recording one bank reference — a hand-recorded payment and the SePay
 * delivery of the same transfer — until the caller's transaction ends. `ref` must be normalized.
 */
export async function lockTransferRef(em: EntityManager, ref: string): Promise<void> {
  await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`payment-ref:${ref}`]);
}
