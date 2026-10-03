import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ContractKind, ContractStatus } from '@storage/types';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class ContractFieldsDto {
  @ApiPropertyOptional({ enum: ContractKind, default: ContractKind.INITIAL })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ContractKind)
  kind?: ContractKind;

  @ApiPropertyOptional({ enum: ContractStatus, default: ContractStatus.DRAFT })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  signedAt?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Defaults to the booking item start date',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional({ type: Object })
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  termsSnapshot?: Record<string, any>;
}

export class CreateContractDto extends ContractFieldsDto {
  @ApiProperty({ format: 'uuid', description: 'Item belonging to a CONFIRMED booking' })
  @IsUUID('all')
  bookingItemId: string;
}

export class UpdateContractDto extends PartialType(ContractFieldsDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(60)
  months?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Monthly rent, not total rent' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  monthlyPriceSnapshot?: number;
}
