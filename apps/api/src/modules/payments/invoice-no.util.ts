/**
 * Invoice number format: `INV-<13-digit epoch ms>-<4 uppercase hex chars>` — mirrors booking
 * numbers. Generation and parsing live together so the format has a single source of truth.
 */

const INVOICE_NO_PREFIX = 'INV';

/** Same tolerance as booking numbers: banks strip or replace the `-` separators. */
const INVOICE_NO_IN_TEXT = /INV[\s\-_.]*(\d{13})[\s\-_.]*([0-9A-F]{4})/gi;

export function generateInvoiceNo(): string {
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `${INVOICE_NO_PREFIX}-${Date.now()}-${rand}`;
}

/** Canonical invoice numbers found in bank transfer content, unique, in order of appearance. */
export function extractInvoiceNos(content: string | null | undefined): string[] {
  if (!content) return [];
  const found = new Set<string>();
  for (const match of content.matchAll(INVOICE_NO_IN_TEXT)) {
    found.add(`${INVOICE_NO_PREFIX}-${match[1]}-${match[2].toUpperCase()}`);
  }
  return [...found];
}
