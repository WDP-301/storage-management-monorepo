import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@storage/types';
import type {
  ChangePasswordResponse,
  CustomerAccount,
  CustomerProfile,
  CustomerProfileResponse,
  IdentityDocumentInfo,
} from '../types/customer-profile';

export class CustomerProfileDto implements CustomerProfile {
  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty({ nullable: true, example: '123 Đường ABC' })
  address_line: string | null;

  @ApiProperty({ nullable: true, description: 'Ward code (FK → wards.code)' })
  ward: string | null;

  @ApiProperty({ nullable: true, description: 'Province code (FK → provinces.code)' })
  province: string | null;

  @ApiProperty({ nullable: true })
  company_name: string | null;

  @ApiProperty({ nullable: true })
  tax_code: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: string | Date;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  deleted_at: string | Date | null;
}

export class IdentityDocumentDto implements IdentityDocumentInfo {
  @ApiProperty({ nullable: true })
  docNumber: string | null;

  @ApiProperty()
  fileUrl: string;
}

export class CustomerAccountDto implements CustomerAccount {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'customer@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ nullable: true, example: '0901234567' })
  phone: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;
}

export class CustomerProfileResponseDto implements CustomerProfileResponse {
  @ApiProperty({ type: CustomerProfileDto, nullable: true })
  profile: CustomerProfileDto | null;

  @ApiProperty({ type: CustomerAccountDto })
  user: CustomerAccountDto;

  @ApiProperty({ type: IdentityDocumentDto, nullable: true })
  identityDocument: IdentityDocumentDto | null;
}

export class ChangePasswordResponseDto implements ChangePasswordResponse {
  @ApiProperty({ example: 'Password changed' })
  message: string;
}
