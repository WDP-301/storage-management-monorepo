import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Vietnamese mobile number: 0/+84/84 followed by a prefix assigned to a Vietnamese carrier
 * (Viettel 032-039/086/096-098, Vinaphone 081-085/088/091/094, Mobifone 070/076-079/089/090/093,
 * Vietnamobile 052/056/058/092, Gmobile 059/099, MVNO 055/087) and 7 digits.
 */
const VIETNAMESE_PHONE_PATTERN =
  /^(?:\+?84|0)(?:32|33|34|35|36|37|38|39|52|55|56|58|59|70|76|77|78|79|81|82|83|84|85|86|87|88|89|90|91|92|93|94|96|97|98|99)\d{7}$/;

export class IdentityDocumentDto {
  @ApiPropertyOptional({ example: '001234567890', description: 'Identity document number' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  docNumber?: string;

  @ApiPropertyOptional({ example: 'https://...', description: 'Stored file URL of the document' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  fileUrl?: string;
}

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Display name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678', description: 'Vietnamese mobile phone number' })
  @IsOptional()
  @IsString()
  @Matches(VIETNAMESE_PHONE_PATTERN, {
    message: 'phone must be a valid Vietnamese phone number',
  })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Le Loi', description: 'Street address' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine?: string;

  @ApiPropertyOptional({
    example: '00008',
    description: 'Ward code (FK → wards.code, e.g. 00008 = Ngọc Hà, Hà Nội)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ward?: string;

  @ApiPropertyOptional({
    example: '01',
    description: 'Province code (FK → provinces.code, e.g. 01 = Hà Nội)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  province?: string;

  @ApiPropertyOptional({ example: 'Acme Corp', description: 'Company name for business customers' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ example: '0123456789', description: 'Tax code for business customers' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxCode?: string;

  @ApiPropertyOptional({ type: IdentityDocumentDto, description: 'Identity document' })
  @IsOptional()
  @ValidateNested()
  @Type(() => IdentityDocumentDto)
  identityDocument?: IdentityDocumentDto;
}
