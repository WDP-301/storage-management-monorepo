import { randomBytes } from 'node:crypto';
import { fieldValidationError } from '@shared/exceptions/domain.exception';
import {
  addVietnamDays,
  fromVietnamDate,
  startOfVietnamDay,
  vietnamToday,
} from '@shared/utils/calendar.util';
import {
  ContractStatus,
  type DropOffBlockReason,
  type DropOffRequestBlockReason,
  MAX_OPEN_DROP_OFF_REQUESTS,
  type PickUpBlockReason,
  type PickupRequestBlockReason,
  SHELF_ITEM_UNIT_LABEL,
  type ShelfItemUnit,
  type ShelfReceiptType,
} from '@storage/types';

/** Setting: how long (minutes) a scanned pass keeps the counter session open. */
export const COUNTER_SESSION_MINUTES_KEY = 'shelf.counter_session_minutes';

/** A request time this little in the past still passes: the form was filled a moment ago. */
const PAST_GRACE_MS = 5 * 60 * 1000;

/**
 * 400 unless a drop-off or pick-up request lands from just now to the end of the Vietnam day
 * `maxDaysAhead` days from today (the whole last allowed day is open).
 */
export function assertRequestedForInRange(requestedFor: Date, now: Date, maxDaysAhead: number) {
  const lastDayEnd = fromVietnamDate(addVietnamDays(vietnamToday(now), maxDaysAhead + 1));
  if (
    requestedFor.getTime() < now.getTime() - PAST_GRACE_MS ||
    requestedFor.getTime() >= lastDayEnd.getTime()
  ) {
    throw fieldValidationError(
      'requestedFor',
      'outOfRange',
      `requestedFor must be within the next ${maxDaysAhead} days`,
    );
  }
}

/**
 * Trims, collapses inner whitespace and composes to NFC, so "  Thùng   sách " and "Thùng sách" —
 * and a precomposed vs decomposed "ú" — are one name.
 */
export const normalizeItemName = (raw: string): string =>
  raw.normalize('NFC').trim().replace(/\s+/g, ' ');

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

/**
 * Why the customer cannot announce a drop-off now, or null. A return in progress does not matter.
 * Several may be open at once (one visit on Monday, another on Thursday): bringing more goods can
 * never overdraw the shelf, so only a cap keeps the list manageable.
 */
export function dropOffRequestBlock(input: {
  status: ContractStatus;
  openRequestCount: number;
  overdue: boolean;
}): DropOffRequestBlockReason | null {
  if (input.status !== ContractStatus.ACTIVE) return 'CONTRACT_NOT_ACTIVE';
  if (input.openRequestCount >= MAX_OPEN_DROP_OFF_REQUESTS) return 'TOO_MANY_OPEN_REQUESTS';
  return input.overdue ? 'INVOICE_OVERDUE' : null;
}

/** "Sách ×2 thùng, Chăn ×1 cái và 3 món khác" for notification bodies. */
export function linesSummary(
  lines: readonly { name: string; quantity: number; unit: ShelfItemUnit }[],
  max = 3,
): string {
  const shown = lines
    .slice(0, max)
    .map((line) => `${line.name} ×${line.quantity} ${SHELF_ITEM_UNIT_LABEL[line.unit]}`);
  const rest = lines.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} và ${rest} món khác` : shown.join(', ');
}

/** ` · giao cho Lan` on a branch notice about an assigned request; empty when unassigned. */
export const assigneeSuffix = (assignedTo: { fullName: string } | null): string =>
  assignedTo ? ` · giao cho ${assignedTo.fullName}` : '';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `09:30 10/11` in Vietnam time, without Intl so the output is fixed across runtimes. */
export function timeVi(at: Date): string {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())} ${pad(vn.getUTCDate())}/${pad(
    vn.getUTCMonth() + 1,
  )}`;
}
