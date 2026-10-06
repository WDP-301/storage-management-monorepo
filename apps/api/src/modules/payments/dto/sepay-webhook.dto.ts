import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

/**
 * DTO map 1-1 với body SePay gửi đến webhook.
 * Tên field giữ nguyên camelCase như trong docs SePay.
 */
export class SepayWebhookDto {
  @IsNumber()
  id: number;

  @IsString()
  @IsNotEmpty()
  gateway: string;

  @IsString()
  @IsNotEmpty()
  transactionDate: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsOptional()
  subAccount: string | null;

  @IsString()
  @IsOptional()
  referenceCode: string | null;

  /** Mã thanh toán SePay — dùng để match booking */
  @IsString()
  @IsOptional()
  code: string | null;

  @IsNumber()
  @IsPositive()
  transferAmount: number;

  @IsString()
  @IsNotEmpty()
  transferType: 'in' | 'out';

  @IsNumber()
  accumulated: number;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  description?: string;
}
