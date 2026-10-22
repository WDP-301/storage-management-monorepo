import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RefundBankAccountInput } from '@storage/types';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Where the deposit is refunded. The account is looked up at the bank before it is saved; the
 * bank's own bank name and holder name are stored.
 */
export class RefundAccountDto implements RefundBankAccountInput {
  @ApiProperty({ example: '970436', description: 'BIN from GET /banks' })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'bankBin must be a 6-digit BIN' })
  bankBin: string;

  @ApiProperty({ example: '0123456789', pattern: '^[0-9A-Za-z]{4,30}$' })
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9A-Za-z]{4,30}$/, { message: 'accountNo must be 4-30 letters or digits' })
  accountNo: string;

  // Older app versions still send the names they asked for; they are accepted and ignored.
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored: the bank name is looked up' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Ignored: the holder name is looked up' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountName?: string;
}
