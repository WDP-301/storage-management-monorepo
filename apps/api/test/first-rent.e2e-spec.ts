import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { ContractCancelService } from '@modules/contracts/contract-cancel.service';
import { ContractDocumentsService } from '@modules/contracts/contract-documents.service';
import { ContractQueryService } from '@modules/contracts/contract-query.service';
import { ContractReturnService } from '@modules/contracts/contract-return.service';
import { ContractsController } from '@modules/contracts/contracts.controller';
import { ContractsService } from '@modules/contracts/contracts.service';
import { FirstRentService } from '@modules/contracts/first-rent.service';
import { loadFirstRentSummaries, withPaymentQr } from '@modules/contracts/first-rent.util';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { DomainException } from '@shared/exceptions/domain.exception';
import { AllExceptionsFilter } from '@shared/filters/http-exception.filter';
import { HttpResponseInterceptor } from '@shared/interceptors/http-response.interceptor';
import { RequestIdMiddleware } from '@shared/middleware/request-id.middleware';
import { ErrorCode } from '@shared/models/api-response';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { InvoiceStatus, PaymentMethod, UserRole } from '@storage/types';
import type { NextFunction, Request, Response } from 'express';

const CONTRACT_ID = '0190f6a2-0000-7000-8000-000000000001';
const MISSING_ID = '0190f6a2-0000-7000-8000-000000000002';

/** A summary built by the real read path, from rows a staff member would see mid check-in. */
async function realSummary(status: InvoiceStatus, payments: unknown[]) {
  const rows = (entity: { name: string }) =>
    entity.name === 'Invoice'
      ? [
          {
            id: 'inv-1',
            invoiceNo: 'INV-1790760804609-6618',
            contractId: CONTRACT_ID,
            status,
            total: '1500000.00',
            issuedAt: new Date('2026-10-12T03:00:00Z'),
          },
        ]
      : payments;
  const dataSource = {
    getRepository: (entity: { name: string }) => ({ find: async () => rows(entity) }),
  };
  const config = {
    get: (key: string) =>
      ({ SEPAY_BANK_ID: 'MB', SEPAY_ACCOUNT_NO: '0123456789', SEPAY_ACCOUNT_NAME: 'CONG TY KHO' })[
        key
      ],
  };
  const summary = (await loadFirstRentSummaries(dataSource as never, [CONTRACT_ID])).get(
    CONTRACT_ID,
  );
  return withPaymentQr(summary as never, config as never);
}

describe('First-rent endpoints (e2e response contract)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let documentedFields: string[];

  beforeAll(async () => {
    const firstRent = {
      issue: jest.fn(async (id: string) => {
        if (id === MISSING_ID) {
          throw new DomainException(
            ErrorCode.CONFLICT,
            'The first month is only collected before handover',
            HttpStatus.CONFLICT,
            { contractId: id },
          );
        }
        return realSummary(InvoiceStatus.ISSUED, []);
      }),
      confirmCash: jest.fn(async () =>
        realSummary(InvoiceStatus.PAID, [
          {
            invoiceId: 'inv-1',
            amount: '1500000.00',
            method: PaymentMethod.CASH,
            paidAt: new Date('2026-10-12T03:05:00Z'),
          },
        ]),
      ),
    };
    const unused = [
      ContractsService,
      ContractReturnService,
      ContractCancelService,
      ContractQueryService,
      ContractDocumentsService,
    ].map((provide) => ({ provide, useValue: {} }));
    const signedIn = {
      canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
        ctx.switchToHttp().getRequest().user = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] };
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [...unused, { provide: FirstRentService, useValue: firstRent }],
    })
      .overrideGuard(SessionGuard)
      .useValue(signedIn)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    // Same pipeline as main.ts.
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((request: Request, response: Response, next: NextFunction) =>
      new RequestIdMiddleware().use(request as never, response, next),
    );
    app.useGlobalPipes(createApiValidationPipe());
    app.useGlobalInterceptors(new HttpResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());

    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const schema = document.components?.schemas?.FirstRentResponseDto as {
      properties: Record<string, unknown>;
    };
    documentedFields = Object.keys(schema.properties).sort();

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string) =>
    fetch(`${baseUrl}/api/v1/contracts/${path}`, {
      method: 'POST',
      headers: { 'X-Request-Id': 'e2e-first-rent' },
    });

  it('wraps the issued invoice in the success envelope, data matching the Swagger schema', async () => {
    const response = await post(`${CONTRACT_ID}/first-rent`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      statusCode: 200,
      code: 'SUCCESS',
      message: 'Request successful',
      requestId: 'e2e-first-rent',
      path: `/api/v1/contracts/${CONTRACT_ID}/first-rent`,
      data: {
        invoice_no: 'INV-1790760804609-6618',
        status: 'ISSUED',
        total: 1500000,
        paid_amount: 0,
        amount_due: 1500000,
        paid_at: null,
        method: null,
        payment_qr_url: expect.stringContaining('addInfo=INV-1790760804609-6618'),
      },
    });
    expect(body.timestamp).toEqual(expect.any(String));
    expect(Object.keys(body.data).sort()).toEqual(documentedFields);
  });

  it('wraps the cash confirmation the same way', async () => {
    const response = await post(`${CONTRACT_ID}/first-rent/cash`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      code: 'SUCCESS',
      data: {
        status: 'PAID',
        paid_amount: 1500000,
        amount_due: 0,
        method: 'CASH',
        paid_at: '2026-10-12T03:05:00.000Z',
        payment_qr_url: null,
      },
    });
    expect(Object.keys(body.data).sort()).toEqual(documentedFields);
  });

  it('returns a refusal in the error envelope', async () => {
    const response = await post(`${MISSING_ID}/first-rent`);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      success: false,
      statusCode: 409,
      code: ErrorCode.CONFLICT,
      details: { contractId: MISSING_ID },
      requestId: 'e2e-first-rent',
    });
    expect(body).not.toHaveProperty('data');
  });
});
