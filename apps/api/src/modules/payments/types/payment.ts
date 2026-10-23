export class PaymentReceivedEvent {
  sepayId: number;
  amount: number;
  content: string;
  code: string | null;
  /** Bank reference of the transfer (what staff see in the banking app); not SePay's own id. */
  referenceCode: string | null;
  transactionDate: string;
  gateway: string;
}

export const PAYMENT_EVENTS = {
  RECEIVED: 'payment.received',
} as const;
