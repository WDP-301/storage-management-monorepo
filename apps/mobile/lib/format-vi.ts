/** Vietnamese display formatting shared across customer screens. */

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

/** Area in m², trimming the trailing decimals the API sends (`"3.00"` → `3 m²`). */
export const formatArea = (value: number) => `${formatNumber(value)} m²`;

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
