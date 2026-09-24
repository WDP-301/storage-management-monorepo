import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.FACILITY_MANAGER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for FACILITY_STAFF / FACILITY_MANAGER, must be omitted for CUSTOMER / OPERATIONS_MANAGER / ADMIN',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Defaults to now when omitted' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Must be after startsAt when provided' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
