import {
  CustomerProfileDto,
  IdentityDocumentDto,
} from '@modules/customer/dto/customer-response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@storage/types';
import type { AuthMeResponse, AuthUser, AuthUserResponse } from '../types/auth-user';

export class AuthUserDto implements AuthUser {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'customer@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  phone?: string | null;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ enum: UserRole, isArray: true, example: [UserRole.CUSTOMER] })
  roles: UserRole[];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class AuthUserResponseDto implements AuthUserResponse {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class LoginResponseDto {
  @ApiProperty({ format: 'date-time', description: 'Session expiry time' })
  expiresAt: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  loggedOut: boolean;
}

export class AuthMeResponseDto implements AuthMeResponse {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: CustomerProfileDto, nullable: true })
  profile: CustomerProfileDto | null;

  @ApiProperty({ type: IdentityDocumentDto, nullable: true })
  identityDocument: IdentityDocumentDto | null;
}
