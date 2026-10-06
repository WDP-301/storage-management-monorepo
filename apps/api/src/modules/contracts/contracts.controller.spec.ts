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

  it.each(['create', 'findAll', 'findOne', 'update', 'remove'] as const)(
    '%s requires a session and permits all four staff roles, excluding customers',
    (method) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, ContractsController)).toEqual([
        SessionGuard,
        RolesGuard,
      ]);
      const context = (roles?: UserRole[]) =>
        ({
          getClass: () => ContractsController,
          getHandler: () => ContractsController.prototype[method],
          switchToHttp: () => ({ getRequest: () => ({ user: roles ? { roles } : undefined }) }),
        }) as unknown as ExecutionContext;
      for (const role of [
        UserRole.ADMIN,
        UserRole.OPERATIONS_MANAGER,
        UserRole.FACILITY_MANAGER,
        UserRole.FACILITY_STAFF,
      ]) {
        expect(guard.canActivate(context([role]))).toBe(true);
      }
      expect(() => guard.canActivate(context([UserRole.CUSTOMER]))).toThrow();
      expect(() => guard.canActivate(context([]))).toThrow();
      expect(() => guard.canActivate(context())).toThrow();
    },
  );

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
