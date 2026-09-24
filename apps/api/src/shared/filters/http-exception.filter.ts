import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../middleware/request-id.middleware';
import { ApiErrorResponse, ErrorCode } from '../models/api-response';

type ExceptionBody = {
  code?: string;
  message?: string | string[];
  error?: string;
  details?: ApiErrorResponse['details'];
};

const defaultCode = (status: number): ErrorCode => {
  if (status === HttpStatus.UNAUTHORIZED) return ErrorCode.AUTHENTICATION_REQUIRED;
  if (status === HttpStatus.NOT_FOUND) return ErrorCode.RESOURCE_NOT_FOUND;
  if (status === HttpStatus.TOO_MANY_REQUESTS) return ErrorCode.RATE_LIMIT_EXCEEDED;
  if (status === HttpStatus.SERVICE_UNAVAILABLE) return ErrorCode.SERVICE_UNAVAILABLE;
  if (status >= 500) return ErrorCode.INTERNAL_ERROR;
  return ErrorCode.BAD_REQUEST;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: ApiErrorResponse['details'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      const body: ExceptionBody =
        typeof raw === 'string' ? { message: raw } : (raw as ExceptionBody);
      code = body.code ?? defaultCode(status);
      message = Array.isArray(body.message)
        ? body.message.join('; ')
        : (body.message ?? body.error ?? exception.message);
      details = body.details;
    }

    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `[${request.requestId}] ${request.method} ${request.originalUrl ?? request.url}: ${error.message}`,
        error.stack,
      );
      message = status === HttpStatus.SERVICE_UNAVAILABLE ? message : 'Internal server error';
      if (status !== HttpStatus.SERVICE_UNAVAILABLE) details = undefined;
    }

    const body: ApiErrorResponse = {
      success: false,
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    };
    response.status(status).json(body);
  }
}
