import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { SettlementLineType, UserRole } from '@storage/types';
import { ApproveSettlementDto } from './dto/approve-settlement.dto';
import { CompleteRefundDto } from './dto/complete-refund.dto';
import { SettlementDecisionsDto } from './dto/settlement-decisions.dto';
import { SettlementsController } from './settlements.controller';

const ALL_ROLES = Object.values(UserRole);
const VERSION = 'a'.repeat(64);

describe('SettlementsController access and input validation', () => {
  const guard = new RolesGuard(new Reflector());
  const context = (method: keyof SettlementsController, roles?: UserRole[]) =>
    ({
      getClass: () => SettlementsController,
      getHandler: () => SettlementsController.prototype[method],
      switchToHttp: () => ({ getRequest: () => ({ user: roles ? { roles } : undefined }) }),
    }) as unknown as ExecutionContext;
  const allowedRoles = (method: keyof SettlementsController) =>
    ALL_ROLES.filter((role) => {
      try {
        return guard.canActivate(context(method, [role]));
      } catch {
        return false;
      }
    });

  it('declares its own session and role guards (only throttling is global)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SettlementsController)).toEqual([
      SessionGuard,
      RolesGuard,
    ]);
  });

  it.each(['detail', 'preview', 'approve', 'completeRefund'] as const)(
    '%s is for operations and admins only',
    (method) => {
      expect(allowedRoles(method).sort()).toEqual(
        [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER].sort(),
      );
      expect(() => guard.canActivate(context(method))).toThrow();
    },
  );

  const validate = (metatype: unknown, value: unknown) =>
    createApiValidationPipe().transform(value, { type: 'body', metatype: metatype as never });

  it('accepts decisions for damages, reviewed payments and waived lines', async () => {
    await expect(
      validate(SettlementDecisionsDto, {
        damageDecisions: [
          { index: 0, amount: 250000 },
          { index: 1, waived: true },
        ],
        creditDecisions: [{ paymentId: '0190f6a2-0000-7000-8000-000000000001', include: false }],
        waivedLines: [{ type: SettlementLineType.OVERSTAY, reason: 'Khách báo trước' }],
      }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['a negative fee', { damageDecisions: [{ index: 0, amount: -1 }] }],
    ['a fee above one billion', { damageDecisions: [{ index: 0, amount: 1_000_000_001 }] }],
    ['a fractional fee', { damageDecisions: [{ index: 0, amount: 10.5 }] }],
    ['waiving a debt', { waivedLines: [{ type: SettlementLineType.UNPAID_INVOICE, reason: 'x' }] }],
    [
      'a waiver without reason',
      { waivedLines: [{ type: SettlementLineType.OVERSTAY, reason: ' ' }] },
    ],
  ])('rejects %s', async (_label, body) => {
    await expect(validate(SettlementDecisionsDto, body)).rejects.toMatchObject({ status: 400 });
  });

  it('needs the previewed version to approve, and takes an account as BIN and number', async () => {
    await expect(validate(ApproveSettlementDto, {})).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(ApproveSettlementDto, {
        expectedVersion: VERSION,
        damageDecisions: [{ index: 0, amount: 100000 }],
        bankAccount: { bankBin: '970418', accountNo: '123456' },
        bankOverrideReason: 'Khách cung cấp qua kênh khác',
      }),
    ).resolves.toMatchObject({ bankAccount: { bankBin: '970418', accountNo: '123456' } });
  });

  it('limits refund proof to five uploads and a 100-character reference', async () => {
    const file = { fileKey: 'uploads/1-a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' };
    await expect(
      validate(CompleteRefundDto, { evidence: Array(6).fill(file) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(CompleteRefundDto, { evidence: [{ ...file, fileKey: 'other/a.jpg' }] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(CompleteRefundDto, { transferRef: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(CompleteRefundDto, { evidence: [file], transferRef: 'FT1' }),
    ).resolves.toBeDefined();
  });
});
