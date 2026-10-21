import { ApiError } from '../../../lib/api';

const NOT_FOUND = 'Yêu cầu trả kho không còn — tải lại trang';
const DAY_OUT_OF_RANGE = 'Chọn ngày trong 365 ngày tới';
const BAD_ACCOUNT = 'Kiểm tra lại tài khoản nhận hoàn';

/** Field paths of a VALIDATION_FAILED body (`details.fields[].field`), e.g. `refundAccount.accountNo`. */
function invalidFields(details: Record<string, unknown> | undefined): string[] {
  const fields = details?.fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .map((entry) => (entry as { field?: unknown } | null)?.field)
    .filter((field): field is string => typeof field === 'string');
}

/**
 * Vietnamese message for a failed return request call. Conflicts (409) already carry a message
 * written for the customer — a locked or finalized request, a contract no longer active.
 */
export function returnErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  // No status: the request never reached the API; its message says so in Vietnamese.
  if (error.statusCode === undefined || error.statusCode === 409) return error.message;
  if (error.statusCode === 404) return NOT_FOUND;
  if (error.statusCode === 400) {
    const fields = invalidFields(error.details);
    if (fields.some((field) => field.startsWith('refundAccount'))) return BAD_ACCOUNT;
    if (fields.includes('scheduledAt')) return DAY_OUT_OF_RANGE;
  }
  return fallback;
}
