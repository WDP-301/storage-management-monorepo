// A date alone would be read as UTC midnight and cut off the rest of that day, so the time and
// offset must be explicit.
export const TIMESTAMP_WITH_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
export const TIMESTAMP_WITH_OFFSET_MESSAGE =
  '$property must be a full timestamp with offset, e.g. 2026-10-12T23:59:59+07:00';
