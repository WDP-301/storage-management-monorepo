import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class HttpResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((res) => {
        // If response is already formatted or has custom format (e.g. paginated)
        if (res && typeof res === 'object' && 'success' in res) {
          return res;
        }

        // If response contains data and meta (e.g. from service)
        if (res && typeof res === 'object' && 'meta' in res && 'data' in res) {
          return {
            success: true,
            data: res.data,
            meta: res.meta,
          };
        }

        return {
          success: true,
          data: res,
        };
      }),
    );
  }
}
