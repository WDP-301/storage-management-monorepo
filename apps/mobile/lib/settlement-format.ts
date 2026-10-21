import type {
  ContractSettlementStatus,
  ReturnRequestSource,
  SettlementLine,
  SettlementSummaryRecord,
} from '@storage/types';
import type { ApiInvoice } from '../src/types/invoice-api';
import { formatIsoDate, formatMoney } from './format-vi';

/**
 * Labels for return requests, invoices and deposit settlements. Every amount comes from the
 * server as is — nothing here computes money — and day comparisons use the Vietnam calendar the
 * API bills on, not the device's timezone.
 */

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Account holder the way Vietnamese banks print it: no diacritics (đ → D), upper case. */
export function toAccountHolderName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Calendar day in Vietnam (UTC+7, no daylight saving) of an instant; null when unreadable. */
export function vietnamDayIso(instant: string | Date): string | null {
  const time = new Date(instant).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` moved by whole days. */
export function addDaysIso(dayIso: string, days: number): string {
  return new Date(Date.parse(`${dayIso}T00:00:00.000Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00.000Z`) - Date.parse(`${fromIso}T00:00:00.000Z`)) / MS_PER_DAY,
  );
}

/** Last day of the term: the day before the exclusive term end the server sends. */
export function lastDayIso(termEndAt: string): string | null {
  const termEndDay = vietnamDayIso(termEndAt);
  return termEndDay ? addDaysIso(termEndDay, -1) : null;
}

/**
 * A rental invoice for a period starting on or after the return day is voided when the unit is
 * returned that day — the same Vietnam-day rule the server applies.
 */
export function willBeVoidedOnReturn(startAt: string | null, scheduledAt: string | null): boolean {
  if (!startAt || !scheduledAt) return false;
  const startDay = vietnamDayIso(startAt);
  const returnDay = vietnamDayIso(scheduledAt);
  return startDay !== null && returnDay !== null && startDay >= returnDay;
}

/** Issued (or part-paid) with money still owed — the invoices the customer has to act on. */
export function isInvoiceDue(invoice: Pick<ApiInvoice, 'status' | 'amountDue'>): boolean {
  return (
    (invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID') && invoice.amountDue > 0
  );
}

export function invoiceTitle(invoice: Pick<ApiInvoice, 'kind' | 'periodNo'>): string {
  return invoice.kind === 'SETTLEMENT' ? 'Phí quyết toán cọc' : `Tiền thuê kỳ ${invoice.periodNo}`;
}

type Badge = { label: string; tone: 'accent' | 'success' };

export function settlementBadge(status: ContractSettlementStatus): Badge {
  if (status === 'COMPLETED') return { label: 'Hoàn tất', tone: 'success' };
  if (status === 'AWAITING_REFUND') return { label: 'Đang hoàn tiền', tone: 'accent' };
  return { label: 'Đang xử lý', tone: 'accent' };
}

/** One sentence on where the deposit stands, built only from the server's figures. */
export function settlementHeadline(summary: SettlementSummaryRecord): string {
  const refund = summary.totals?.refund_amount ?? 0;
  const account = summary.refund_account;
  if (summary.status === 'PENDING') return 'Đang quyết toán cọc';
  if (summary.status === 'AWAITING_REFUND') {
    if (refund <= 0) return 'Đã duyệt quyết toán cọc';
    return account
      ? `Đang chuyển ${formatMoney(refund)} về ${account.bank_name} ${account.account_no_masked}`
      : `Đang chuyển ${formatMoney(refund)} tiền cọc hoàn lại`;
  }
  const day = summary.completed_at ? vietnamDayIso(summary.completed_at) : null;
  const on = day ? ` ngày ${formatIsoDate(day)}` : '';
  return refund > 0 ? `Đã hoàn ${formatMoney(refund)}${on}` : `Đã quyết toán cọc${on}`;
}

/** `+ 1.000.000 ₫` for a credit, `− 500.000 ₫` for a deduction, `Miễn` when waived. */
export function settlementLineAmount(
  line: Pick<SettlementLine, 'direction' | 'amount' | 'waived'>,
) {
  if (line.waived) return 'Miễn';
  return `${line.direction === 'CREDIT' ? '+' : '−'} ${formatMoney(line.amount)}`;
}

/** "Kho của tôi" hint for an ENDED contract; null when the API sends no settlement. */
export function endedContractHint(settlement: SettlementSummaryRecord | null): string | null {
  if (!settlement) return null;
  if (settlement.status === 'COMPLETED') return 'Đã quyết toán cọc';
  if (settlement.status === 'AWAITING_REFUND') return 'Đang hoàn tiền cọc';
  return 'Đang quyết toán cọc';
}

const SOURCE_NOTES: Partial<Record<ReturnRequestSource, string>> = {
  HOTLINE: 'Yêu cầu do chi nhánh tạo (qua hotline)',
  ABANDONED: 'Yêu cầu do chi nhánh tạo (bỏ kho)',
};

/** Shown on a return the branch opened for the customer; null for the customer's own. */
export function returnSourceNote(source: ReturnRequestSource | null | undefined): string | null {
  return source ? (SOURCE_NOTES[source] ?? null) : null;
}
