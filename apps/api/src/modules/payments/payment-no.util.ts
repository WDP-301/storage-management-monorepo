/** Payment number format: `PAY-<13-digit epoch ms>-<4 uppercase hex chars>` — mirrors booking numbers. */
export function generatePaymentNo(): string {
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `PAY-${Date.now()}-${rand}`;
}
