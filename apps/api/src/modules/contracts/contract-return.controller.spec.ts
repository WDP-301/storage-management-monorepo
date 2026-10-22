import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ExecutionContext, HttpStatus, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { UserRole } from '@storage/types';
import { ContractReturnController } from './contract-return.controller';
import { ManagedReturnRequestDto } from './dto/managed-return-request.dto';
import {
  ReturnPreviewQueryDto,
  ReturnRequestDto,
  UpdateReturnRequestDto,
} from './dto/return-request.dto';

const ALL_ROLES = Object.values(UserRole);

describe('ContractReturnController access and input validation', () => {
  const guard = new RolesGuard(new Reflector());
  const context = (method: keyof ContractReturnController, roles?: UserRole[]) =>
    ({
      getClass: () => ContractReturnController,
      getHandler: () => ContractReturnController.prototype[method],
      switchToHttp: () => ({ getRequest: () => ({ user: roles ? { roles } : undefined }) }),
    }) as unknown as ExecutionContext;
  const allowedRoles = (method: keyof ContractReturnController) =>
    ALL_ROLES.filter((role) => {
      try {
        return guard.canActivate(context(method, [role]));
      } catch {
        return false;
      }
    });

  it('declares its own session and role guards (only throttling is global)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ContractReturnController)).toEqual([
      SessionGuard,
      RolesGuard,
    ]);
  });

  it.each(['preview', 'requestReturn', 'updateReturn', 'cancelReturn'] as const)(
    '%s is for customers only',
    (method) => {
      expect(allowedRoles(method)).toEqual([UserRole.CUSTOMER]);
      expect(() => guard.canActivate(context(method))).toThrow();
    },
  );

  it('lets facility managers, operations and admins request a return on the customer’s behalf', () => {
    expect(allowedRoles('requestOnBehalf').sort()).toEqual(
      [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER].sort(),
    );
    expect(() => guard.canActivate(context('requestOnBehalf'))).toThrow();
  });

  it('answers a withdrawal with 200 and a body, which the mobile app needs', () => {
    const handler = ContractReturnController.prototype.cancelReturn;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.DELETE);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(HttpStatus.OK);
  });

  const validate = (metatype: unknown, value: unknown, type: 'body' | 'query' = 'body') =>
    createApiValidationPipe().transform(value, { type, metatype: metatype as never });

  it('accepts the body older app versions send', async () => {
    await expect(
      validate(ReturnRequestDto, { scheduledAt: '2027-04-12T12:00:00.000Z', note: 'Sáng' }),
    ).resolves.toBeDefined();
  });

  it('accepts a request with a refund account', async () => {
    await expect(
      validate(ReturnRequestDto, {
        scheduledAt: '2027-04-12T12:00:00.000Z',
        refundAccount: {
          bankBin: '970436',
          bankName: 'VCB',
          accountNo: '0123',
          accountName: 'Le B',
        },
      }),
    ).resolves.toMatchObject({ refundAccount: { bankBin: '970436', accountNo: '0123' } });
  });

  it.each([
    ['a missing day', {}],
    ['a malformed day', { scheduledAt: '12/04/2027' }],
    ['a note over 1000 characters', { scheduledAt: '2027-04-12', note: 'x'.repeat(1001) }],
    ['unknown fields', { scheduledAt: '2027-04-12', source: 'HOTLINE' }],
  ])('rejects a request with %s', async (_label, body) => {
    await expect(validate(ReturnRequestDto, body)).rejects.toMatchObject({ status: 400 });
  });

  it('names the nested refund account field that is wrong', async () => {
    await expect(
      validate(ReturnRequestDto, {
        scheduledAt: '2027-04-12',
        refundAccount: { bankBin: '97043', accountNo: '0123', accountName: 'Le B' },
      }),
    ).rejects.toMatchObject({
      response: {
        details: {
          fields: expect.arrayContaining([
            expect.objectContaining({ field: 'refundAccount.bankBin' }),
          ]),
        },
      },
    });
  });

  it('accepts an empty change and rejects a malformed one', async () => {
    await expect(validate(UpdateReturnRequestDto, {})).resolves.toBeDefined();
    await expect(validate(UpdateReturnRequestDto, { scheduledAt: 'soon' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('requires the day to preview', async () => {
    await expect(
      validate(ReturnPreviewQueryDto, { scheduledAt: '2027-04-12' }, 'query'),
    ).resolves.toBeDefined();
    await expect(validate(ReturnPreviewQueryDto, {}, 'query')).rejects.toMatchObject({
      status: 400,
    });
  });

  it.each(['HOTLINE', 'ABANDONED'])('accepts a branch request from %s', async (source) => {
    await expect(
      validate(ManagedReturnRequestDto, { scheduledAt: '2027-04-12', source }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['no source', { scheduledAt: '2027-04-12' }],
    ['the customer as source', { scheduledAt: '2027-04-12', source: 'CUSTOMER' }],
  ])('rejects a branch request with %s', async (_label, body) => {
    await expect(validate(ManagedReturnRequestDto, body)).rejects.toMatchObject({ status: 400 });
  });
});

describe('ContractReturnController delegation', () => {
  const CONTRACT_ID = '0190f6a2-0000-7000-8000-000000000001';
  const user = { id: 'user-1', roles: [UserRole.CUSTOMER] } as AuthUser;
  const manager = { id: 'manager-1', roles: [UserRole.FACILITY_MANAGER] } as AuthUser;
  const contractReturn = {
    requestReturn: jest.fn().mockResolvedValue({ id: 'return-1' }),
    updateReturn: jest.fn().mockResolvedValue({ id: 'return-1' }),
    cancelReturn: jest.fn().mockResolvedValue({ id: 'return-1' }),
  };
  const managedReturn = { requestOnBehalf: jest.fn().mockResolvedValue({ id: 'return-2' }) };
  const returnPreview = { preview: jest.fn().mockResolvedValue({ early: true }) };
  const controller = new ContractReturnController(
    contractReturn as never,
    managedReturn as never,
    returnPreview as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('acts on behalf of the signed-in customer, taking the id from the session', async () => {
    const request = { scheduledAt: '2027-04-12T12:00:00.000Z' };

    await controller.preview(CONTRACT_ID, request, user);
    await controller.requestReturn(CONTRACT_ID, request, user);
    await controller.updateReturn(CONTRACT_ID, { note: 'x' }, user);
    await expect(controller.cancelReturn(CONTRACT_ID, user)).resolves.toEqual({ id: 'return-1' });

    expect(returnPreview.preview).toHaveBeenCalledWith(CONTRACT_ID, 'user-1', request.scheduledAt);
    expect(contractReturn.requestReturn).toHaveBeenCalledWith(CONTRACT_ID, 'user-1', request);
    expect(contractReturn.updateReturn).toHaveBeenCalledWith(CONTRACT_ID, 'user-1', { note: 'x' });
    expect(contractReturn.cancelReturn).toHaveBeenCalledWith(CONTRACT_ID, 'user-1');
  });

  it('hands the whole actor to the branch request, which checks the facility', async () => {
    const dto = { scheduledAt: '2027-04-12T12:00:00.000Z', source: 'HOTLINE' } as never;

    await expect(controller.requestOnBehalf(CONTRACT_ID, dto, manager)).resolves.toEqual({
      id: 'return-2',
    });

    expect(managedReturn.requestOnBehalf).toHaveBeenCalledWith(CONTRACT_ID, manager, dto);
    expect(contractReturn.requestReturn).not.toHaveBeenCalled();
  });
});
