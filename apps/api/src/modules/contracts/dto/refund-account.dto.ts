import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type RefundBankAccountInput, VN_BANKS } from '@storage/types';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { toAccountHolderName } from '../refund-account.util';

const VN_BANK_BINS = VN_BANKS.map((bank) => bank.bin);

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Where the customer wants the deposit refunded. */
export class RefundAccountDto implements RefundBankAccountInput {
  @ApiPropertyOptional({
    nullable: true,
    example: '970436',
    description: 'VietQR BIN from VN_BANKS; omit (or null) for a bank that is not listed',
  })
  // An empty choice means "other bank", same as leaving it out.
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @ValidateIf((_object, value) => value != null)
  @IsIn(VN_BANK_BINS, { message: 'bankBin must be the BIN of a bank in VN_BANKS' })
  bankBin?: string | null;

  @ApiProperty({
    maxLength: 100,
    example: 'Vietcombank',
    description: 'Required for an unlisted bank; replaced by the listed name when bankBin is set',
  })
  @Transform(trim)
  @ValidateIf((object: RefundAccountDto) => object.bankBin == null || object.bankName != null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ example: '0123456789', pattern: '^[0-9A-Za-z]{4,30}$' })
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9A-Za-z]{4,30}$/, { message: 'accountNo must be 4-30 letters or digits' })
  accountNo: string;

  @ApiProperty({
    minLength: 2,
    maxLength: 100,
    example: 'NGUYEN VAN A',
    description: 'Stored upper case without diacritics, as banks print it',
  })
  @Transform(({ value }) => (typeof value === 'string' ? toAccountHolderName(value) : value))
  @IsString()
  @Length(2, 100)
  accountName: string;
}
