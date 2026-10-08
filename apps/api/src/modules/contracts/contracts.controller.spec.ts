import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { UserRole } from '@storage/types';
import { ContractsController } from './contracts.controller';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

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

  it.each(['create', 'findAll', 'findOne', 'uploadEvidence'] as const)(
    '%s requires a session and permits all four staff roles, excluding customers',
    (method) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, ContractsController)).toEqual([
        SessionGuard,
        RolesGuard,
      ]);
      for (const role of [
        UserRole.ADMIN,
        UserRole.OPERATIONS_MANAGER,
        UserRole.FACILITY_MANAGER,
        UserRole.FACILITY_STAFF,
      ]) {
        expect(allows(method, role)).toBe(true);
      }
      expect(allows(method, UserRole.CUSTOMER)).toBe(false);
      expect(() => guard.canActivate(context(method, []))).toThrow();
      expect(() => guard.canActivate(context(method))).toThrow();
    },
  );

  // Editing or deleting a contract can strand its unit, so facility roles go through
  // handover/return finalize instead.
  it.each(['update', 'remove'] as const)('%s is limited to admin and operations', (method) => {
    expect(allows(method, UserRole.ADMIN)).toBe(true);
    expect(allows(method, UserRole.OPERATIONS_MANAGER)).toBe(true);
    expect(allows(method, UserRole.FACILITY_MANAGER)).toBe(false);
    expect(allows(method, UserRole.FACILITY_STAFF)).toBe(false);
    expect(allows(method, UserRole.CUSTOMER)).toBe(false);
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
