import { CallHandler, ExecutionContext, HttpStatus, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { HttpResponseInterceptor } from './http-response.interceptor';

const context = (statusCode = 200, raw = false) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: '/api/v1/test', requestId: 'request-1' }),
      getResponse: () => ({ statusCode }),
    }),
    getHandler: () => (raw ? 'raw-handler' : 'handler'),
    getClass: () => 'controller',
  }) as unknown as ExecutionContext;

const next = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('HttpResponseInterceptor', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const interceptor = new HttpResponseInterceptor(reflector);

  beforeEach(() => jest.clearAllMocks());

  it('wraps successful values with request metadata even when data has success', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(context(), next({ success: 'business' })),
    );
    expect(result).toMatchObject({
      success: true,
      statusCode: 200,
      code: 'SUCCESS',
      data: { success: 'business' },
      requestId: 'request-1',
      path: '/api/v1/test',
    });
  });

  it('does not wrap 204, explicit raw responses, or streams', async () => {
    await expect(
      lastValueFrom(interceptor.intercept(context(HttpStatus.NO_CONTENT), next(undefined))),
    ).resolves.toBeUndefined();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(true);
    await expect(
      lastValueFrom(interceptor.intercept(context(200, true), next('raw'))),
    ).resolves.toBe('raw');
    const stream = new StreamableFile(Buffer.from('x'));
    await expect(lastValueFrom(interceptor.intercept(context(), next(stream)))).resolves.toBe(
      stream,
    );
  });
});
