/**
 * Simulates the SePay deposit webhook for a booking so demos do not need a real transfer:
 *   pnpm --filter @storage/api demo:pay <bookingNo> [amount]
 * The amount defaults to what is still owed on the deposit (deposit minus earlier payments). Signs the body exactly like SePay
 * (HMAC-SHA256 over "<timestamp>.<rawBody>") and posts it to the running API.
 */
import { createHmac } from 'node:crypto';
import { AppDataSource } from '../data-source';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('demo:pay is disabled in production');
  }
  const [bookingNo, amountArg] = process.argv.slice(2);
  if (!bookingNo) throw new Error('Usage: demo:pay <bookingNo> [amount]');
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('SEPAY_WEBHOOK_SECRET is not set');
  const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api/v1`;

  await AppDataSource.initialize();
  try {
    const amount = amountArg ? Number(amountArg) : await amountDue(bookingNo);
    const id = Date.now();
    const body = JSON.stringify({
      id,
      gateway: 'DEMO',
      transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
      accountNumber: process.env.SEPAY_ACCOUNT_NO ?? '0000000000',
      subAccount: null,
      referenceCode: `DEMO${id}`,
      code: null,
      transferAmount: amount,
      transferType: 'in',
      accumulated: 0,
      content: bookingNo,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

    const res = await fetch(`${apiUrl}/payments/webhook/sepay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SePay-Timestamp': timestamp,
        'X-SePay-Signature': `sha256=${signature}`,
      },
      body,
    });
    console.log(`Webhook ${res.status}: ${await res.text()} (transfer ${amount} for ${bookingNo})`);

    // The webhook handler runs synchronously, but give the API a moment before reading back.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const [state] = await AppDataSource.query(
      `SELECT b.status,
              (SELECT count(*) FROM booking_items bi JOIN contracts c ON c.booking_item_id = bi.id
                WHERE bi.booking_id = b.id)::int AS contracts
         FROM bookings b WHERE b.booking_no = $1`,
      [bookingNo],
    );
    console.log(`Booking ${bookingNo}: status=${state?.status} contracts=${state?.contracts}`);
  } finally {
    await AppDataSource.destroy();
  }
}

async function amountDue(bookingNo: string): Promise<number> {
  const [row] = await AppDataSource.query(
    `SELECT b.deposit_total,
            COALESCE((SELECT sum(p.amount) FROM payments p
                       WHERE p.booking_id = b.id AND p.status = 'SUCCEEDED'), 0) AS paid
       FROM bookings b WHERE b.booking_no = $1`,
    [bookingNo],
  );
  if (!row) throw new Error(`Booking ${bookingNo} not found`);
  const due = Number(row.deposit_total) - Number(row.paid);
  if (due <= 0) throw new Error(`Booking ${bookingNo} has no deposit left to pay`);
  return due;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
