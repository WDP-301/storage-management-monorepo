import { randomBytes } from 'node:crypto';
import { startOfVietnamDay, vietnamToday } from '@shared/utils/calendar.util';
import {
  ContractStatus,
  type DropOffBlockReason,
  type PickUpBlockReason,
  type PickupRequestBlockReason,
  type ShelfReceiptType,
} from '@storage/types';

/** How long a scanned pass keeps the counter session open. */
export const COUNTER_SESSION_MINUTES = 30;
/** A pick-up request may be made for a time at most this many days ahead. */
export const PICKUP_REQUEST_MAX_DAYS_AHEAD = 30;

/** Trims and collapses inner whitespace, so "  Thùng   sách " and "Thùng sách" are one name. */
export const normalizeItemName = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

/** The case-insensitive identity of an item name within a contract. */
export const itemNameKey = (name: string): string =>
  normalizeItemName(name).toLocaleLowerCase('vi');

const RECEIPT_PREFIX: Record<ShelfReceiptType, string> = { DROP_OFF: 'PG', PICK_UP: 'PL' };

/** `PG-20261107-1A2B3C4D` (drop-off) or `PL-…` (pick-up): Vietnam date plus 8 random hex digits. */
export function receiptCode(
  type: ShelfReceiptType,
  now: Date,
  random: () => string = () => randomBytes(4).toString('hex'),
): string {
  const day = vietnamToday(now).replace(/-/g, '');
  return `${RECEIPT_PREFIX[type]}-${day}-${random().toUpperCase()}`;
}

/**
 * Why goods cannot be dropped off now, or null. The term opens at 00:00 Vietnam time on the
 * start day, as it does for pass issuing. A return in progress does not matter: the customer
 * may still bring more things, but an overdue invoice always blocks.
 */
export function dropOffBlock(
  contract: { effectiveAt: Date },
  overdue: boolean,
  now: Date,
): DropOffBlockReason | null {
  if (startOfVietnamDay(contract.effectiveAt).getTime() > now.getTime()) {
    return 'CONTRACT_NOT_STARTED';
  }
  return overdue ? 'INVOICE_OVERDUE' : null;
}

/** Debt never keeps goods from a customer who is already returning the shelf. */
export function pickUpBlock(
  stockTotal: number,
  overdue: boolean,
  returnOpen: boolean,
): PickUpBlockReason | null {
  if (stockTotal <= 0) return 'NO_STOCK';
  return overdue && !returnOpen ? 'INVOICE_OVERDUE' : null;
}

export function pickupRequestBlock(input: {
  status: ContractStatus;
  stockTotal: number;
  hasOpenRequest: boolean;
  overdue: boolean;
  returnOpen: boolean;
}): PickupRequestBlockReason | null {
  if (input.status !== ContractStatus.ACTIVE) return 'CONTRACT_NOT_ACTIVE';
  if (input.hasOpenRequest) return 'OPEN_REQUEST_EXISTS';
  if (input.stockTotal <= 0) return 'NO_STOCK';
  return input.overdue && !input.returnOpen ? 'INVOICE_OVERDUE' : null;
}

/** "Sách ×2, Chăn ×1 và 3 món khác" for notification bodies. */
export function linesSummary(
  lines: readonly { name: string; quantity: number }[],
  max = 3,
): string {
  const shown = lines.slice(0, max).map((line) => `${line.name} ×${line.quantity}`);
  const rest = lines.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} và ${rest} món khác` : shown.join(', ');
}
