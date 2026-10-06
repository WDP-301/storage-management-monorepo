export class PaymentReceivedEvent {
  sepayId: number;
  amount: number;
  content: string;
  code: string | null;
  transactionDate: string;
  gateway: string;
}

export const PAYMENT_EVENTS = {
  RECEIVED: 'payment.received',
} as const;
