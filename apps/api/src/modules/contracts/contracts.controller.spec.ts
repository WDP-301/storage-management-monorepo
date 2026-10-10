import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { UserRole } from '@storage/types';
import { ContractsController } from './contracts.controller';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';

describe('Contract access and input validation', () => {
  const guard = new RolesGuard(new Reflector());

  const context = (method: keyof ContractsController, roles?: UserRole[]) =>
    ({
      getClass: () => ContractsController,
      getHandler: () => ContractsController.prototype[method],
      switchToHttp: () => ({ getRequest: () => ({ user: roles ? { roles } : undefined }) }),
    }) as unknown as ExecutionContext;
  const allows = (method: keyof ContractsController, role: UserRole) => {
    try {
      return guard.canActivate(context(method, [role]));
    } catch {
      return false;
    }
  };

  // Writes can strand units, so they stay system-wide only.
  it.each(['create', 'uploadEvidence', 'update', 'remove'] as const)(
    '%s is limited to admin and operations',
    (method) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, ContractsController)).toEqual([
        SessionGuard,
        RolesGuard,
      ]);
      expect(allows(method, UserRole.ADMIN)).toBe(true);
      expect(allows(method, UserRole.OPERATIONS_MANAGER)).toBe(true);
      expect(allows(method, UserRole.FACILITY_MANAGER)).toBe(false);
      expect(allows(method, UserRole.FACILITY_STAFF)).toBe(false);
      expect(allows(method, UserRole.CUSTOMER)).toBe(false);
      expect(() => guard.canActivate(context(method, []))).toThrow();
      expect(() => guard.canActivate(context(method))).toThrow();
    },
  );

  // Contracts carry customer PII: managers read (scoped to their facilities in the
  // service), staff and customers do not.
  it.each(['findAll', 'findOne'] as const)('%s is readable by managers only', (method) => {
    expect(allows(method, UserRole.ADMIN)).toBe(true);
    expect(allows(method, UserRole.OPERATIONS_MANAGER)).toBe(true);
    expect(allows(method, UserRole.FACILITY_MANAGER)).toBe(true);
    expect(allows(method, UserRole.FACILITY_STAFF)).toBe(false);
    expect(allows(method, UserRole.CUSTOMER)).toBe(false);
  });

  it.each([
    { status: 'SIGNED' },
    { facilityId: 'not-a-uuid' },
    { limit: '101' },
    { page: '0' },
    { page: '1000000000000000000' },
  ])('rejects invalid list filters: %j', async (query) => {
    await expect(
      createApiValidationPipe().transform(query, {
        type: 'query',
        metatype: ListContractsQueryDto,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('cancel is open to managers but not to staff or customers', () => {
    expect(allows('cancel', UserRole.ADMIN)).toBe(true);
    expect(allows('cancel', UserRole.OPERATIONS_MANAGER)).toBe(true);
    expect(allows('cancel', UserRole.FACILITY_MANAGER)).toBe(true);
    expect(allows('cancel', UserRole.FACILITY_STAFF)).toBe(false);
    expect(allows('cancel', UserRole.CUSTOMER)).toBe(false);
  });

  it.each([
    { months: 0 },
    { months: null },
    { monthlyPriceSnapshot: -1 },
    { status: 'CONFIRMED' },
    { effectiveAt: null },
    { endedAt: 'not-a-date' },
  ])('rejects invalid updates: %j', async (body) => {
    await expect(
      createApiValidationPipe().transform(body, { type: 'body', metatype: UpdateContractDto }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a malformed booking item ID', async () => {
    await expect(
      createApiValidationPipe().transform(
        { bookingItemId: 'invalid' },
        { type: 'body', metatype: CreateContractDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
