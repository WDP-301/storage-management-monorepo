import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../models/api-response';

export interface DomainErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class DomainException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, ...(details ? { details } : {}) }, status);
  }
}

/** Throws RESOURCE_NOT_FOUND (404) — `${resource} ${id} not found`, or `${resource} not found` without an id. */
export function notFound(resource: string, id?: string): never {
  throw new DomainException(
    ErrorCode.RESOURCE_NOT_FOUND,
    id === undefined ? `${resource} not found` : `${resource} ${id} not found`,
    HttpStatus.NOT_FOUND,
  );
}

/** Builds a VALIDATION_FAILED (400) error for a single field — callers `throw` it. */
export function fieldValidationError(
  field: string,
  code: string,
  message: string,
): DomainException {
  return new DomainException(
    ErrorCode.VALIDATION_FAILED,
    'Validation failed',
    HttpStatus.BAD_REQUEST,
    {
      fields: [{ field, code, message }],
    },
  );
}
