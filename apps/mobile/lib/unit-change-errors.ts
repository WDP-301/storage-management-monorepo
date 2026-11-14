/**
 * The move day/time rules the server checks against the admin-configured window and the OFFICE
 * shift. Their field messages are written for customers; the generic error text is not.
 */
const MOVE_RULE_CODES = new Set(['outOfRange', 'pastTime', 'moveTimeNotInShift']);

/** Customer-facing text for a failed unit-change request; `fallback` when nothing better exists. */
export function unitChangeErrorMessage(cause: unknown, fallback: string): string {
  if (typeof cause !== 'object' || cause === null) return fallback;
  const { code, details, message } = cause as {
    code?: unknown;
    details?: { fields?: unknown };
    message?: unknown;
  };
  if (code === 'VALIDATION_FAILED' && Array.isArray(details?.fields)) {
    const rule = details.fields.find(
      (field) => MOVE_RULE_CODES.has(field?.code) && typeof field?.message === 'string',
    );
    if (rule) return rule.message;
  }
  return typeof message === 'string' && message ? message : fallback;
}
