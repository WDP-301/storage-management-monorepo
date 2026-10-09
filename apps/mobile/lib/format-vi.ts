/** Vietnamese display formatting shared across customer screens. */

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

/** Area in m², trimming the trailing decimals the API sends (`"3.00"` → `3 m²`). */
export const formatArea = (value: number) => `${formatNumber(value)} m²`;

/**
 * Abbreviated money for places with no room for the full figure, such as a map pin:
 * `550000` → `550k`, `1400000` → `1,4tr`.
 *
 * Only ever decorative-adjacent — a pin label the customer uses to compare, then taps to see the
 * exact amount. Never use it where the number is the amount being agreed to or transferred.
 */
export const formatMoneyShort = (value: number) => {
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${formatNumber(Math.round(value / 1_000))}k`;
  return formatNumber(value);
};

/** Plain number with a Vietnamese decimal comma and no trailing zeroes. */
export const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);

/**
 * Day-first date from the ISO day strings the rental schedule stores: `2026-09-28` → `28/09/2026`.
 *
 * A plain string rearrangement rather than `Intl.DateTimeFormat`, whose availability varies across
 * Hermes builds — the output is fixed-format anyway.
 */
export const formatIsoDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Timestamp in the device's own timezone: `2026-10-06T03:24:00.000Z` → `10:24, 06/10/2026`.
 *
 * Unlike `formatIsoDate` this cannot be a string rearrangement — the API sends UTC and a receipt
 * has to show the clock the customer was looking at. `Date` getters do the conversion without
 * `Intl.DateTimeFormat`, whose availability varies across Hermes builds.
 */
export const formatIsoDateTime = (iso: string) => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}, ${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`;
};

/** Warehouse footprint as `5 × 8 × 3,5 m` (width × length × height); height is omitted when unknown. */
export const formatDimensions = (widthM: number, lengthM: number, heightM: number | null) => {
  const sides = [widthM, lengthM, heightM].filter((side): side is number => side !== null);
  return `${sides.map(formatNumber).join(' × ')} m`;
};
