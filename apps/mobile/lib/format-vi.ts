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
 * Day-first date, e.g. `28/09/2026`. Built by hand rather than via `Intl.DateTimeFormat`, whose
 * availability varies across Hermes builds — the output is fixed-format anyway.
 */
export const formatDate = (value: Date) => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${value.getFullYear()}`;
};
