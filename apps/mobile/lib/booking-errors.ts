const UNIT_UNAVAILABLE_MESSAGE =
  'Kho vừa được người khác giữ hoặc tạm ngừng, vui lòng chọn kho khác.';
const FALLBACK_MESSAGE = 'Không giữ được kho. Vui lòng thử lại.';

/**
 * Booking rules the server checks against admin-configured settings. Their field messages are
 * written for customers; the client may have offered a value under rules that changed since.
 */
const BOOKING_RULE_CODES = new Set(['maxSize', 'range', 'maxLeadDays']);

function bookingRuleMessage(details: unknown): string | null {
  const fields = (details as { fields?: unknown } | undefined)?.fields;
  if (!Array.isArray(fields)) return null;
  const rule = fields.find(
    (field) => BOOKING_RULE_CODES.has(field?.code) && typeof field?.message === 'string',
  );
  return rule ? rule.message : null;
}

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
    if (code === 'VALIDATION_FAILED') {
      const message = bookingRuleMessage((cause as { details?: unknown }).details);
      if (message) return message;
    }
  }
  return cause instanceof Error && cause.message ? cause.message : FALLBACK_MESSAGE;
}
