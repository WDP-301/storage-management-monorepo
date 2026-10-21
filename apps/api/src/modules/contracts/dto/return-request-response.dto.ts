import { ApiProperty } from '@nestjs/swagger';
import type { RefundBankAccount, ReturnPreviewRecord } from '@storage/types';

export class RefundBankAccountResponseDto implements RefundBankAccount {
  @ApiProperty({ nullable: true, example: '970436', description: 'null for an unlisted bank' })
  bankBin: string | null;

  @ApiProperty({ example: 'Vietcombank' })
  bankName: string;

  @ApiProperty({ example: '0123456789' })
  accountNo: string;

  @ApiProperty({ example: 'NGUYEN VAN A' })
  accountName: string;
}

const DAY = { format: 'date', example: '2027-03-31' } as const;

/** What a return on the chosen day would cost, before the customer commits to it. */
export class ReturnPreviewResponseDto implements ReturnPreviewRecord {
  @ApiProperty({
    format: 'date-time',
    description: '00:00 Vietnam time of the first day after the term (exclusive end)',
  })
  term_end_at: string;

  @ApiProperty({ ...DAY, description: 'Last day of the term; returning on it is on time' })
  last_day: string;

  @ApiProperty(DAY)
  scheduled_day: string;

  @ApiProperty({ ...DAY, description: 'Day money is counted to (the scheduled day here)' })
  effective_return_day: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'Since when the notice runs: now, or the open request’s anchor if not moved earlier',
  })
  notice_from: string;

  @ApiProperty({ example: 45, description: 'Days between notice_from and the scheduled day' })
  notice_days: number;

  @ApiProperty({ example: 30 })
  required_notice_days: number;

  @ApiProperty({ description: 'Returning before the last day of the term' })
  early: boolean;

  @ApiProperty({ description: 'Early with less notice than required' })
  short_notice: boolean;

  @ApiProperty({ example: 0, description: 'One month of rent when short_notice, VND' })
  short_notice_deduction: number;

  @ApiProperty({ ...DAY, description: 'Overstay is charged for each day after this one' })
  overstay_from_day: string;

  @ApiProperty({ example: 0 })
  overstay_days: number;

  @ApiProperty({ example: 50000, description: 'Monthly rent / 30 × percent, rounded half up' })
  overstay_penalty_per_day: number;

  @ApiProperty({ example: 0 })
  overstay_penalty: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 3000000,
    description: 'Deposit held for the contract; null while it cannot be determined',
  })
  deposit_held: number | null;

  @ApiProperty({
    type: RefundBankAccountResponseDto,
    nullable: true,
    description: 'Account the customer used last time, to pre-fill the form',
  })
  saved_refund_account: RefundBankAccountResponseDto | null;
}

export class ReturnRequestCancelledDto {
  @ApiProperty({ format: 'uuid', description: 'The return request that was withdrawn' })
  id: string;
}
