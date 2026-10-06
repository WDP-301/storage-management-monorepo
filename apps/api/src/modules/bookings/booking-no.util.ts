/**
 * Booking number format: `BK-<13-digit epoch ms>-<4 uppercase hex chars>`.
 * Generation and parsing live together so the format contract has a single source of truth.
 */

const BOOKING_NO_PREFIX = 'BK';

/**
 * Matches a booking number inside free text. Banks often strip or replace the `-`
 * separators in transfer content (e.g. `BK17907608046096618`, `BK 1790760804609 6618`,
 * `BK.1790760804609.6618`), so separators are optional and may be whitespace, `-`, `_` or `.`.
 */
const BOOKING_NO_IN_TEXT = /BK[\s\-_.]*(\d{13})[\s\-_.]*([0-9A-F]{4})/gi;

export function generateBookingNo(): string {
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `${BOOKING_NO_PREFIX}-${Date.now()}-${rand}`;
}

/**
 * Extracts canonical booking numbers from bank transfer content. Customers are instructed to put
 * their booking number in the content, so this is the only source used for matching.
 * Returns unique candidates in order of appearance; empty when none found.
 */
export function extractBookingNos(content: string | null | undefined): string[] {
  if (!content) return [];
  const found = new Set<string>();
  for (const match of content.matchAll(BOOKING_NO_IN_TEXT)) {
    found.add(`${BOOKING_NO_PREFIX}-${match[1]}-${match[2].toUpperCase()}`);
  }
  return [...found];
}
