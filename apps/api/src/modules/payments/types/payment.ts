export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  referenceCode: string | null;
  code: string | null;
  transferAmount: number;
  transferType: 'in' | 'out';
  accumulated: number;
  content: string;
}

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
