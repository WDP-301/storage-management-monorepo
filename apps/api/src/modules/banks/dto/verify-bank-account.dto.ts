import { ApiProperty } from '@nestjs/swagger';
import type { RefundBankAccountInput } from '@storage/types';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** A bank account to look up: the BIN from GET /banks and the account number. */
export class VerifyBankAccountDto implements RefundBankAccountInput {
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
}
