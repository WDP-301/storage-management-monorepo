import { ApiError } from '../../../lib/api';

const DATE_FIELDS = ['returnedOn', 'scheduledAt'];

/** True when the API's field-level validation failure names one of the date inputs. */
function isDateFieldError(error: ApiError): boolean {
  const fields = error.details?.fields;
  return (
    Array.isArray(fields) &&
    fields.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        DATE_FIELDS.includes((entry as { field?: unknown }).field as string),
    )
  );
}

/**
 * API conflicts arrive in English; staff get the reason in Vietnamese.
 * `forbidden` lets an action say what the user was not allowed to do.
 */
export function staffErrorMessage(
  error: unknown,
  fallback: string,
  forbidden = 'Bạn không có quyền với biên bản này.',
): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'FORBIDDEN' || error.statusCode === 403) return forbidden;
  // The API message for this code is already Vietnamese and says exactly what is missing.
  if (error.code === 'CONTRACT_DOCUMENTS_REQUIRED') return error.message;
  if (error.code === 'FIRST_RENT_UNPAID')
    return 'Khách chưa thanh toán tiền thuê tháng đầu — thu tiền trước khi chốt biên nhận.';
  if (error.statusCode === 400 && isDateFieldError(error)) return 'Ngày không hợp lệ.';
  const reason = [
    ['already finalized', 'Biên bản đã được chốt trước đó.'],
    [
      'Assign an inspector',
      'Biên bản chưa được phân công nhân viên — nhờ quản lý giao việc trước.',
    ],
    ['requires a', 'Hợp đồng không ở trạng thái phù hợp để chốt biên bản này.'],
    ['expected state', 'Trạng thái kho không khớp — liên hệ quản lý chi nhánh.'],
  ].find(([needle]) => error.message.includes(needle));
  if (reason) return reason[1];
  // Message substrings above are best-effort; the error code is the stable signal.
  if (error.code === 'CONFLICT' || error.statusCode === 409)
    return 'Thao tác bị xung đột — tải lại biên bản rồi thử lại.';
  if (error.statusCode === 400) return 'Thông tin chưa hợp lệ, kiểm tra lại ghi chú và hư hỏng.';
  return error.message || fallback;
}
