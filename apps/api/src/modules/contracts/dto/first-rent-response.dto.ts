import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod } from '@storage/types';
import type { FirstRentSummary } from '../first-rent.util';

/** First month's rent invoice, as returned to staff collecting it at check-in. */
export class FirstRentResponseDto implements FirstRentSummary {
  @ApiProperty({ format: 'uuid' })
  invoice_id: string;

  @ApiProperty({
    example: 'INV-1790760804609-6618',
    description: 'Put in the transfer content; the SePay webhook matches on it',
  })
  invoice_no: string;

  @ApiProperty({
    enum: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
    example: InvoiceStatus.ISSUED,
    description: 'Handover can be finalized only once PAID',
  })
  status: InvoiceStatus;

  @ApiProperty({ example: 1500000, description: 'One month at the contract price, VND' })
  total: number;

  @ApiProperty({ example: 0 })
  paid_amount: number;

  @ApiProperty({ example: 1500000, description: 'total − paid_amount, never negative' })
  amount_due: number;

  @ApiProperty({ format: 'date-time', nullable: true, example: null, description: 'Set once PAID' })
  paid_at: string | Date | null;

  @ApiProperty({
    enum: [PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH],
    nullable: true,
    example: null,
    description: 'How the last payment arrived; null before any payment',
  })
  method: PaymentMethod | null;

  @ApiProperty({
    nullable: true,
    example:
      'https://img.vietqr.io/image/MB-0123456789-compact2.png?amount=1500000&addInfo=INV-1790760804609-6618&accountName=CONG+TY+TNHH+KHO',
    description:
      'VietQR for amount_due; null once nothing is due or when no receiving account is configured',
  })
  payment_qr_url: string | null;
}
