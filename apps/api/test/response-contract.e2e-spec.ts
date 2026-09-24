import { Controller, Get, HttpCode, HttpStatus, INestApplication, Query } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DomainException } from '@shared/exceptions/domain.exception';
import { AllExceptionsFilter } from '@shared/filters/http-exception.filter';
import { HttpResponseInterceptor } from '@shared/interceptors/http-response.interceptor';
import { RequestIdMiddleware } from '@shared/middleware/request-id.middleware';
import { ErrorCode } from '@shared/models/api-response';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { IsEmail } from 'class-validator';
import type { NextFunction, Request, Response } from 'express';

class QueryDto {
  @IsEmail()
  email: string;
}

@Controller('contract')
class ContractController {
  @Get('success')
  success() {
    return { value: 'ok' };
  }

  @Get('validation')
  validation(@Query() query: QueryDto) {
    return query;
  }

  @Get('unavailable')
  unavailable() {
    throw new DomainException(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Required dependencies are unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
      { database: { status: 'error' } },
    );
  }

  @Get('internal-error')
  internalError() {
    throw new Error('vendor secret');
  }

  @Get('no-content')
  @HttpCode(HttpStatus.NO_CONTENT)
  noContent() {
    return undefined;
  }
}

describe('API response contract (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContractController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((request: Request, response: Response, next: NextFunction) =>
      new RequestIdMiddleware().use(request as never, response, next),
    );
    app.useGlobalPipes(createApiValidationPipe());
    app.useGlobalInterceptors(new HttpResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps successful JSON and correlates request IDs', async () => {
    const response = await fetch(`${baseUrl}/api/v1/contract/success`, {
      headers: { 'X-Request-Id': 'e2e-request-1' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('e2e-request-1');
    expect(body).toMatchObject({
      success: true,
      statusCode: 200,
      code: 'SUCCESS',
      message: 'Request successful',
      data: { value: 'ok' },
      requestId: 'e2e-request-1',
      path: '/api/v1/contract/success',
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('generates a UUID when the incoming request ID is invalid', async () => {
    const response = await fetch(`${baseUrl}/api/v1/contract/success`, {
      headers: { 'X-Request-Id': 'invalid request id' },
    });
    const body = await response.json();
    const requestId = response.headers.get('x-request-id');

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.requestId).toBe(requestId);
  });

  it('returns structured validation errors', async () => {
    const response = await fetch(`${baseUrl}/api/v1/contract/validation?email=not-an-email`);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      statusCode: 400,
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Validation failed',
      details: {
        fields: [
          {
            field: 'email',
            code: 'isEmail',
          },
        ],
      },
      path: '/api/v1/contract/validation?email=not-an-email',
    });
  });

  it('preserves readiness details on service unavailable errors', async () => {
    const response = await fetch(`${baseUrl}/api/v1/contract/unavailable`);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      statusCode: 503,
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'Required dependencies are unavailable',
      details: { database: { status: 'error' } },
    });
  });

  it('does not expose internal error details', async () => {
    const response = await fetch(`${baseUrl}/api/v1/contract/internal-error`);
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      success: false,
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    });
    expect(text).not.toContain('vendor secret');
    expect(body.details).toBeUndefined();
  });

  it('does not envelope 204 responses', async () => {
    const response = await fetch(`${baseUrl}/api/v1/contract/no-content`);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});
