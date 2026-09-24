import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from '../src/modules/health/health.controller';
import { UploadService } from '../src/modules/upload/upload.service';
import { AllExceptionsFilter } from '../src/shared/filters/http-exception.filter';
import { HttpResponseInterceptor } from '../src/shared/interceptors/http-response.interceptor';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';
import { ErrorCode } from '../src/shared/models/api-response';

const dataSource = {
  isInitialized: true,
  query: jest.fn(),
};

const uploadService = {
  checkHealth: jest.fn(),
};

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: dataSource },
        { provide: UploadService, useValue: uploadService },
      ],
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

  beforeEach(() => {
    dataSource.isInitialized = true;
    dataSource.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    uploadService.checkHealth.mockReset().mockResolvedValue({
      status: 'connected',
      endpoint: 'http://storage.test',
      bucket: 'test-bucket',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports process liveness without checking dependencies', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: { status: 'alive' },
    });
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(uploadService.checkHealth).not.toHaveBeenCalled();
  });

  it.each(['/api/v1/health', '/api/v1/health/ready'])('reports readiness for %s', async (path) => {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        status: 'ready',
        database: { type: 'postgres', status: 'connected' },
        storage: {
          provider: 'cloudflare-r2 (S3-compatible)',
          status: 'connected',
        },
      },
    });
  });

  it('returns 503 and dependency details when the database is unavailable', async () => {
    dataSource.query.mockRejectedValueOnce(new Error('database secret'));

    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      statusCode: 503,
      code: ErrorCode.SERVICE_UNAVAILABLE,
      details: {
        database: { type: 'postgres', status: 'error' },
        storage: { status: 'connected' },
      },
    });
    expect(text).not.toContain('database secret');
  });

  it('returns 503 when object storage is unavailable', async () => {
    uploadService.checkHealth.mockResolvedValueOnce({
      status: 'error',
      endpoint: 'http://storage.test',
      bucket: 'test-bucket',
    });

    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      details: {
        database: { status: 'connected' },
        storage: { status: 'error' },
      },
    });
  });
});
