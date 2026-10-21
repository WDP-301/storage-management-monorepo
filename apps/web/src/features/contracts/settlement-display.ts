import type { ApiError } from '../../lib/api';
import type {
  ContractSettlementStatus,
  ReturnRequestSource,
  SettlementLine,
  SettlementStatusFilter,
  SettlementTotals,
} from '../../types/settlement';
import { formatVnd } from '../warehouses/warehouse-display';

type Variant = 'warning' | 'primary' | 'success';

export const SETTLEMENT_STATUS_LABEL: Record<
  ContractSettlementStatus,
  { label: string; variant: Variant }
> = {
  PENDING: { label: 'Chờ quyết toán', variant: 'warning' },
  AWAITING_REFUND: { label: 'Chờ hoàn tiền', variant: 'primary' },
  COMPLETED: { label: 'Đã quyết toán', variant: 'success' },
};

export const SETTLEMENT_FILTER_OPTIONS: { value: SettlementStatusFilter; label: string }[] = [
  { value: 'pending', label: 'Chờ quyết toán' },
  { value: 'awaiting_refund', label: 'Chờ hoàn tiền' },
  { value: 'completed', label: 'Hoàn tất' },
];

export const LINE_TYPE_LABEL: Record<SettlementLine['type'], string> = {
  UNPAID_INVOICE: 'Tiền thuê còn nợ',
  EARLY_RETURN_SHORT_NOTICE: 'Trả sớm, báo trước không đủ',
  OVERSTAY: 'Quá hạn trả kho',
  DAMAGE: 'Hư hỏng',
  UNUSED_PERIOD_CREDIT: 'Hoàn tiền thuê kỳ không dùng',
  REVIEW_PAYMENT_CREDIT: 'Khoản tiền cần kiểm tra',
};

export const REQUEST_SOURCE_LABEL: Record<ReturnRequestSource, string> = {
  CUSTOMER: 'Khách yêu cầu',
  HOTLINE: 'Chi nhánh tạo thay — khách gọi hotline',
  ABANDONED: 'Chi nhánh tạo thay — khách bỏ kho',
};

/** A deposit that cannot be determined is never shown as 0. */
export const formatDepositAmount = (deposit: number | string | null | undefined): string =>
  deposit === null || deposit === undefined ? 'Chưa xác định' : formatVnd(deposit);

/** Signed amount of a line: deductions come off the deposit, credits are added back. */
export const formatLineAmount = (line: SettlementLine): string =>
  `${line.direction === 'CREDIT' ? '+' : '−'}${formatVnd(line.amount)}`;

/** The outcome the reviewer confirms, from the server totals. */
export function approvalOutcome(totals: SettlementTotals): string {
  if (totals.refund_amount > 0) return `Hoàn cho khách ${formatVnd(totals.refund_amount)}.`;
  if (totals.shortfall_amount > 0) {
    return `Cọc không đủ: khách còn thiếu ${formatVnd(totals.shortfall_amount)} — hệ thống tạo hoá đơn quyết toán (hạn 7 ngày).`;
  }
  return 'Cọc vừa đủ cấn trừ, không có tiền hoàn.';
}

const CODE_MESSAGE: Record<string, string> = {
  SETTLEMENT_NOT_READY: 'Hợp đồng chưa chốt biên trả kho — chưa thể quyết toán cọc.',
  SETTLEMENT_ALREADY_APPROVED: 'Quyết toán cọc đã được duyệt — đã tải lại thông tin mới nhất.',
  SETTLEMENT_CHANGED:
    'Số liệu quyết toán vừa thay đổi — đã tải lại số mới, kiểm tra lại rồi duyệt.',
  DEPOSIT_MISSING: 'Không xác định được tiền cọc đã nộp — cần bổ sung cọc trước khi duyệt.',
  DECISION_REQUIRED:
    'Cần quyết định cho mọi hư hỏng và mọi khoản tiền cần kiểm tra trước khi duyệt.',
  REFUND_ACCOUNT_REQUIRED: 'Có tiền cọc cần hoàn — nhập tài khoản nhận tiền hoàn.',
  REFUND_NOT_PENDING: 'Quyết toán không còn chờ hoàn tiền — đã tải lại thông tin mới nhất.',
};

const FIELD_LABEL: Record<string, string> = {
  bankBin: 'Ngân hàng',
  bankName: 'Tên ngân hàng',
  accountNo: 'Số tài khoản',
  accountName: 'Tên chủ tài khoản',
  bankOverrideReason: 'Lý do đổi tài khoản',
  transferRef: 'Mã giao dịch',
  evidence: 'Chứng từ',
  note: 'Ghi chú',
  scheduledAt: 'Ngày hẹn trả',
  returnedOn: 'Ngày trả thực tế',
  source: 'Nguồn yêu cầu',
  damageDecisions: 'Quyết định hư hỏng',
  creditDecisions: 'Khoản tiền cần kiểm tra',
  waivedLines: 'Khoản miễn',
};

// Messages written by the API in Vietnamese are shown as they are; validator ones are English.
const isVietnamese = (text: string) => /[^ -~]/.test(text);

function describeFields(fields: unknown[]): string | null {
  const lines = fields
    .filter(
      (f): f is { field: string; message?: string } =>
        typeof f === 'object' && f !== null && typeof (f as { field?: unknown }).field === 'string',
    )
    .map(({ field, message }) => {
      if (message && isVietnamese(message)) return message;
      const label = field
        .split('.')
        .reverse()
        .find((part) => FIELD_LABEL[part]);
      return `${label ? FIELD_LABEL[label] : 'Dữ liệu'} không hợp lệ`;
    });
  return lines.length > 0 ? `${[...new Set(lines)].join('; ')}.` : null;
}

/** Vietnamese reason for a failed API call, keyed on the stable error code, then on field errors. */
export function describeApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const { status, code, details } = err as ApiError;
  if (code && CODE_MESSAGE[code]) return CODE_MESSAGE[code];
  if (status === 400 && Array.isArray(details?.fields)) {
    const described = describeFields(details.fields);
    if (described) return described;
  }
  if (status === 403) return err.message || 'Bạn không có quyền thực hiện thao tác này.';
  return err.message || fallback;
}

/** Codes after which the shown record is stale and must be loaded again. */
export const isStaleSettlementError = (err: unknown): boolean => {
  const code = (err as ApiError | undefined)?.code;
  return code === 'SETTLEMENT_ALREADY_APPROVED' || code === 'REFUND_NOT_PENDING';
};
