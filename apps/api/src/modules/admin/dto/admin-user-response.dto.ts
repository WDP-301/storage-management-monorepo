import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@shared/models/api-response';
import { UserRole, UserStatus } from '@storage/types';
import type {
  AdminRoleAssignment,
  AdminUser,
  AdminUserListResponse,
  AdminUserResponse,
  RevokeRoleResponse,
} from '../types/admin-user';

export class AdminRoleAssignmentDto implements AdminRoleAssignment {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: UserRole, example: UserRole.FACILITY_STAFF })
  role: UserRole;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'Facility scope, null = global' })
  facilityId: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  endsAt: Date | null;
}

export class AdminUserDto implements AdminUser {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ nullable: true, example: '0901234567' })
  phone: string | null;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  emailVerifiedAt: Date | null;

  @ApiProperty({ type: [AdminRoleAssignmentDto] })
  roles: AdminRoleAssignmentDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class AdminUserResponseDto implements AdminUserResponse {
  @ApiProperty({ type: AdminUserDto })
  user: AdminUserDto;
}

export class AdminUserListResponseDto implements AdminUserListResponse {
  @ApiProperty({ type: [AdminUserDto] })
  users: AdminUserDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class RevokeRoleResponseDto implements RevokeRoleResponse {
  @ApiProperty({ example: true })
  revoked: boolean;
}
