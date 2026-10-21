import { SessionGuard } from '@modules/auth/guards/session.guard';
import { ContractReturnController } from '@modules/contracts/contract-return.controller';
import { ContractReturnService } from '@modules/contracts/contract-return.service';
import { RETURN_MESSAGES, returnConflict } from '@modules/contracts/contract-return.util';
import { ManagedReturnService } from '@modules/contracts/managed-return.service';
import { ReturnPreviewService } from '@modules/contracts/return-preview.service';
import { InspectionController } from '@modules/inspection/inspection.controller';
import { InspectionService } from '@modules/inspection/inspection.service';
import { InspectionLifecycleService } from '@modules/inspection/inspection-lifecycle.service';
import { returnTiming, toReturnTimingRecord } from '@modules/settlements/return-timing';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter } from '@shared/filters/http-exception.filter';
import { HttpResponseInterceptor } from '@shared/interceptors/http-response.interceptor';
import { RequestIdMiddleware } from '@shared/middleware/request-id.middleware';
import { ErrorCode } from '@shared/models/api-response';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { UserRole } from '@storage/types';
import type { NextFunction, Request, Response } from 'express';

const CONTRACT_ID = '0190f6a2-0000-7000-8000-000000000001';
const INSPECTION_ID = '0190f6a2-0000-7000-8000-000000000003';

const previewRecord = () => ({
  ...toReturnTimingRecord(
    returnTiming({
      effectiveAt: new Date('2026-10-01T12:00:00.000Z'),
      months: 6,
      monthlyPrice: '1500000.00',
      noticeFrom: new Date('2027-02-01T05:00:00.000Z'),
      scheduledAt: new Date('2027-02-15T05:00:00.000Z'),
      rules: { noticeDays: 30, penaltyPercent: 100 },
      goLiveAt: new Date('2026-06-01T00:00:00.000Z'),
    }),
  ),
  deposit_held: 3000000,
  saved_refund_account: null,
});

/**
 * The return flow through the real HTTP pipeline (validation, role guard, envelope), with the
 * services faked: what the released mobile app sends must keep working.
 */
describe('Return request endpoints (e2e response contract)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let schemas: Record<string, { properties: Record<string, unknown> }>;
  const contractReturn = {
    requestReturn: jest.fn(async () => ({ id: 'return-1' })),
    updateReturn: jest.fn(async () => ({ id: 'return-1' })),
    cancelReturn: jest.fn(async () => ({ id: 'return-1' })),
  };
  const managedReturn = { requestOnBehalf: jest.fn(async () => ({ id: 'return-1' })) };
  const lifecycle = { finalize: jest.fn(async () => ({ id: INSPECTION_ID })) };
  const inspections = { update: jest.fn(async () => ({ id: INSPECTION_ID })) };

  beforeAll(async () => {
    // Signed in with the roles named in the X-Test-Roles header; the real RolesGuard decides.
    const signedIn = {
      canActivate: (ctx: { switchToHttp: () => { getRequest: () => Request } }) => {
        const request = ctx.switchToHttp().getRequest();
        const roles = String(request.headers['x-test-roles'] ?? UserRole.CUSTOMER).split(',');
        (request as unknown as { user: unknown }).user = { id: 'user-1', roles };
        return true;
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ContractReturnController, InspectionController],
      providers: [
        { provide: ContractReturnService, useValue: contractReturn },
        { provide: ManagedReturnService, useValue: managedReturn },
        { provide: ReturnPreviewService, useValue: { preview: async () => previewRecord() } },
        { provide: InspectionLifecycleService, useValue: lifecycle },
        { provide: InspectionService, useValue: inspections },
      ],
    })
      .overrideGuard(SessionGuard)
      .useValue(signedIn)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((request: Request, response: Response, next: NextFunction) =>
      new RequestIdMiddleware().use(request as never, response, next),
    );
    app.useGlobalPipes(createApiValidationPipe());
    app.useGlobalInterceptors(new HttpResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    schemas = document.components?.schemas as typeof schemas;

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const call = (method: string, path: string, body?: unknown, roles?: UserRole[]) =>
    fetch(`${baseUrl}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(roles ? { 'X-Test-Roles': roles.join(',') } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const documented = (name: string) => Object.keys(schemas[name].properties).sort();

  it('accepts a return request without a refund account, as the released app sends it', async () => {
    const response = await call('POST', `contracts/${CONTRACT_ID}/return-request`, {
      scheduledAt: '2027-04-12T12:00:00.000Z',
      note: 'Trả buổi sáng',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, data: { id: 'return-1' } });
    expect(contractReturn.requestReturn).toHaveBeenCalledWith(
      CONTRACT_ID,
      'user-1',
      expect.not.objectContaining({ refundAccount: expect.anything() }),
    );
  });

  it('withdraws with 200 and the id in the success envelope, never an empty 204', async () => {
    const response = await call('DELETE', `contracts/${CONTRACT_ID}/return-request`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, statusCode: 200, data: { id: 'return-1' } });
    expect(Object.keys(body.data).sort()).toEqual(documented('ReturnRequestCancelledDto'));
  });

  it('refuses a withdrawal once staff started with 409 RETURN_REQUEST_LOCKED', async () => {
    contractReturn.cancelReturn.mockRejectedValueOnce(
      returnConflict(
        RETURN_MESSAGES.locked,
        { contractId: CONTRACT_ID, inspectionId: 'return-1' },
        ErrorCode.RETURN_REQUEST_LOCKED,
      ),
    );

    const response = await call('DELETE', `contracts/${CONTRACT_ID}/return-request`);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      statusCode: 409,
      code: 'RETURN_REQUEST_LOCKED',
      details: { inspectionId: 'return-1' },
    });
  });

  it('changes a request with the day alone, as a customer who only moves the date', async () => {
    const response = await call('PATCH', `contracts/${CONTRACT_ID}/return-request`, {
      scheduledAt: '2027-04-20T12:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { id: 'return-1' } });
    expect(contractReturn.updateReturn).toHaveBeenCalledWith(
      CONTRACT_ID,
      'user-1',
      expect.objectContaining({ scheduledAt: '2027-04-20T12:00:00.000Z' }),
    );
  });

  it('passes the branch request source and the actor through to the facility check', async () => {
    const response = await call(
      'POST',
      `contracts/${CONTRACT_ID}/return-request/on-behalf`,
      { scheduledAt: '2027-04-12T12:00:00.000Z', source: 'ABANDONED' },
      [UserRole.OPERATIONS_MANAGER],
    );

    expect(response.status).toBe(201);
    expect(managedReturn.requestOnBehalf).toHaveBeenCalledWith(
      CONTRACT_ID,
      expect.objectContaining({ id: 'user-1', roles: [UserRole.OPERATIONS_MANAGER] }),
      expect.objectContaining({ source: 'ABANDONED' }),
    );
  });

  it('rejects a branch request that names the customer as its source', async () => {
    const response = await call(
      'POST',
      `contracts/${CONTRACT_ID}/return-request/on-behalf`,
      { scheduledAt: '2027-04-12T12:00:00.000Z', source: 'CUSTOMER' },
      [UserRole.FACILITY_MANAGER],
    );

    expect(response.status).toBe(400);
    expect(managedReturn.requestOnBehalf).not.toHaveBeenCalled();
  });

  it('hands the picked return day to the finalize', async () => {
    const response = await call(
      'POST',
      `inspections/${INSPECTION_ID}/finalize`,
      { returnedOn: '2027-04-12' },
      [UserRole.FACILITY_STAFF],
    );

    expect(response.status).toBe(200);
    expect(lifecycle.finalize).toHaveBeenCalledWith(
      INSPECTION_ID,
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ returnedOn: '2027-04-12' }),
    );
  });

  it('documents every field of the preview', async () => {
    const response = await call(
      'GET',
      `contracts/${CONTRACT_ID}/return-preview?scheduledAt=2027-02-15T12:00:00.000Z`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ short_notice: true, short_notice_deduction: 1500000 });
    expect(Object.keys(body.data).sort()).toEqual(documented('ReturnPreviewResponseDto'));
  });

  it.each([
    [[UserRole.FACILITY_STAFF], 403],
    [[UserRole.CUSTOMER], 403],
    [[UserRole.FACILITY_MANAGER], 201],
  ])('answers a branch request by %j with %d', async (roles, status) => {
    const response = await call(
      'POST',
      `contracts/${CONTRACT_ID}/return-request/on-behalf`,
      { scheduledAt: '2027-04-12T12:00:00.000Z', source: 'HOTLINE' },
      roles,
    );

    expect(response.status).toBe(status);
  });

  it('keeps customer routes away from staff', async () => {
    const response = await call('DELETE', `contracts/${CONTRACT_ID}/return-request`, undefined, [
      UserRole.FACILITY_MANAGER,
    ]);

    expect(response.status).toBe(403);
    expect(contractReturn.cancelReturn).not.toHaveBeenCalled();
  });

  it('finalizes without a body, as the released apps do', async () => {
    const response = await fetch(`${baseUrl}/inspections/${INSPECTION_ID}/finalize`, {
      method: 'POST',
      headers: { 'X-Test-Roles': UserRole.FACILITY_STAFF },
    });

    expect(response.status).toBe(200);
    expect(lifecycle.finalize).toHaveBeenCalledWith(
      INSPECTION_ID,
      expect.objectContaining({ id: 'user-1' }),
      expect.not.objectContaining({ returnedOn: expect.anything() }),
    );
  });

  it('rejects a malformed return day', async () => {
    const response = await call(
      'POST',
      `inspections/${INSPECTION_ID}/finalize`,
      { returnedOn: '2027-02-30' },
      [UserRole.FACILITY_STAFF],
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { fields: [expect.objectContaining({ field: 'returnedOn' })] },
    });
    expect(lifecycle.finalize).not.toHaveBeenCalled();
  });

  it('accepts damages without a proposed fee, as the released staff app sends them', async () => {
    const response = await call(
      'PATCH',
      `inspections/${INSPECTION_ID}`,
      { damages: [{ description: 'Móp cửa', severity: 'MAJOR' }] },
      [UserRole.FACILITY_STAFF],
    );

    expect(response.status).toBe(200);
    expect(inspections.update).toHaveBeenCalled();
  });
});
