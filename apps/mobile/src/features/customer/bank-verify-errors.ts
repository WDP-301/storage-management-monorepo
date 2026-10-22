import { ApiError } from '../../../lib/api';

const UNKNOWN_ACCOUNT = 'Số tài khoản không tồn tại tại ngân hàng đã chọn';
const UNKNOWN_BANK = 'Ngân hàng không hợp lệ hoặc chưa được hỗ trợ';
const UNAVAILABLE = 'Không kiểm tra được tài khoản lúc này, vui lòng thử lại';
const THROTTLED = 'Bạn kiểm tra quá nhiều lần, vui lòng thử lại sau ít phút';

/** True when the API's answer is about the bank account check, not about the rest of the form. */
export function isBankCheckError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'BANK_ACCOUNT_INVALID' || error.statusCode === 503 || error.statusCode === 429)
  );
}

/** Vietnamese message for a failed bank account check; anything unexpected reads as "try again". */
export function bankCheckErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNAVAILABLE;
  if (error.statusCode === 429) return THROTTLED;
  if (error.code === 'BANK_ACCOUNT_INVALID') {
    return error.details?.reason === 'BANK' ? UNKNOWN_BANK : UNKNOWN_ACCOUNT;
  }
  return UNAVAILABLE;
}
