import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PaginationMeta } from '@storage/types';

export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  BAD_REQUEST = 'BAD_REQUEST',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_INVALID = 'SESSION_INVALID',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  EMAIL_ALREADY_REGISTERED = 'EMAIL_ALREADY_REGISTERED',
  ROLE_ALREADY_ASSIGNED = 'ROLE_ALREADY_ASSIGNED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNIT_NOT_AVAILABLE = 'UNIT_NOT_AVAILABLE',
  BOOKING_NOT_CONFIRMED = 'BOOKING_NOT_CONFIRMED',
  BOOKING_NOT_CANCELLABLE = 'BOOKING_NOT_CANCELLABLE',
  BOOKING_ITEM_CONTRACT_WINDOW_EXPIRED = 'BOOKING_ITEM_CONTRACT_WINDOW_EXPIRED',
  CONTRACT_DOCUMENTS_REQUIRED = 'CONTRACT_DOCUMENTS_REQUIRED',
  IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT',
  IDEMPOTENCY_PAYLOAD_MISMATCH = 'IDEMPOTENCY_PAYLOAD_MISMATCH',
}

export interface ValidationFieldDetail {
  field: string;
  code: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  code: 'SUCCESS';
  message: string;
  data: T;
  requestId: string;
  timestamp: string;
  path: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details?: { fields?: ValidationFieldDetail[]; [key: string]: unknown };
  requestId: string;
  timestamp: string;
  path: string;
}

export class ValidationFieldDetailDto implements ValidationFieldDetail {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({ example: 'isEmail' })
  code: string;

  @ApiProperty({ example: 'email must be an email' })
  message: string;
}

export class ApiErrorResponseDto implements ApiErrorResponse {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ enum: ErrorCode, example: ErrorCode.VALIDATION_FAILED })
  code: ErrorCode;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiPropertyOptional({
    example: { fields: [{ field: 'email', code: 'isEmail', message: 'email must be an email' }] },
  })
  details?: { fields?: ValidationFieldDetail[]; [key: string]: unknown };

  @ApiProperty({ format: 'uuid' })
  requestId: string;

  @ApiProperty({ format: 'date-time' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/auth/login' })
  path: string;
}

/** Builds the shared `{ page, limit, total, totalPages }` meta block for paginated list responses. */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
