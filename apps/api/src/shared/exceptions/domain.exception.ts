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
