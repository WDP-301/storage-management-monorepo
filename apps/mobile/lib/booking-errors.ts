const UNIT_UNAVAILABLE_MESSAGE =
  'Kho vừa được người khác giữ hoặc tạm ngừng, vui lòng chọn kho khác.';
const FALLBACK_MESSAGE = 'Không giữ được kho. Vui lòng thử lại.';

/**
 * Customer-facing text for a failed booking request. Conflicts are matched on the API's machine
 * code, never on the server's message text, which is not meant for display.
 */
export function bookingErrorMessage(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    const { code } = cause as { code?: unknown };
    if (code === 'UNIT_NOT_AVAILABLE' || code === 'RESOURCE_NOT_FOUND') {
      return UNIT_UNAVAILABLE_MESSAGE;
    }
  }
  return cause instanceof Error && cause.message ? cause.message : FALLBACK_MESSAGE;
}
