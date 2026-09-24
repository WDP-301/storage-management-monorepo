import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import type { RequestWithId } from '../middleware/request-id.middleware';
import type { ApiSuccessResponse } from '../models/api-response';

@Injectable()
export class HttpResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data): unknown => {
        if (
          isRaw ||
          response.statusCode === HttpStatus.NO_CONTENT ||
          data instanceof StreamableFile
        ) {
          return data;
        }

        const body: ApiSuccessResponse<unknown> = {
          success: true,
          statusCode: response.statusCode,
          code: 'SUCCESS',
          message: 'Request successful',
          data,
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          path: request.originalUrl ?? request.url,
        };
        return body;
      }),
    );
  }
}
