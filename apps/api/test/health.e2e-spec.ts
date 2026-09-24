import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { HealthController } from '../src/modules/health/health.controller';
import { AllExceptionsFilter } from '../src/shared/filters/http-exception.filter';
import { HttpResponseInterceptor } from '../src/shared/interceptors/http-response.interceptor';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
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

  it.each(['/api/v1/health', '/api/v1/health/live'])('reports liveness for %s', async (path) => {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: { status: 'alive' },
    });
  });
});
