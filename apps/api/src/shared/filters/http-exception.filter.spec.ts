import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

const host = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const value = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: 'req-1', method: 'GET', originalUrl: '/api/v1/test' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { value, status, json };
};

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('normalizes HTTP errors with stable metadata', () => {
    const ctx = host();
    filter.catch(new HttpException('Missing', HttpStatus.NOT_FOUND), ctx.value);
    expect(ctx.status).toHaveBeenCalledWith(404);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'RESOURCE_NOT_FOUND',
        requestId: 'req-1',
        path: '/api/v1/test',
      }),
    );
  });

  it('does not expose unknown error messages', () => {
    const ctx = host();
    filter.catch(new Error('vendor secret'), ctx.value);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }),
    );
  });
});
