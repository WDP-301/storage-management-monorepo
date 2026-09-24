import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { RequestWithId } from '../middleware/request-id.middleware';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          this.logger.log(
            `[${request.requestId}] ${request.method} ${request.originalUrl ?? request.url} ${response.statusCode} - ${Date.now() - startedAt}ms`,
          );
        },
        error: (error: { status?: number }) => {
          this.logger.error(
            `[${request.requestId}] ${request.method} ${request.originalUrl ?? request.url} ${error.status ?? 500} - ${Date.now() - startedAt}ms`,
          );
        },
      }),
    );
  }
}
