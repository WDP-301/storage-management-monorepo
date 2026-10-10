import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { UserRole } from '@storage/types';
import { ContractsController } from './contracts.controller';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { ReplaceContractDocumentsDto } from './dto/contract-documents.dto';
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
  it.each(['create', 'update', 'remove'] as const)(
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

  it('replaceDocuments and staffView are open to staff and managers, not customers', () => {
    for (const method of ['replaceDocuments', 'staffView'] as const) {
      expect(allows(method, UserRole.ADMIN)).toBe(true);
      expect(allows(method, UserRole.OPERATIONS_MANAGER)).toBe(true);
      expect(allows(method, UserRole.FACILITY_MANAGER)).toBe(true);
      expect(allows(method, UserRole.FACILITY_STAFF)).toBe(true);
      expect(allows(method, UserRole.CUSTOMER)).toBe(false);
    }
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

  const file = (over: Record<string, unknown> = {}) => ({
    fileKey: 'uploads/1-a.pdf',
    name: 'a.pdf',
    mimeType: 'application/pdf',
    ...over,
  });
  const validateDocuments = (body: unknown) =>
    createApiValidationPipe().transform(body, {
      type: 'body',
      metatype: ReplaceContractDocumentsDto,
    });

  it('accepts images and PDFs, including an empty list', async () => {
    await expect(validateDocuments({ documents: [] })).resolves.toBeDefined();
    await expect(
      validateDocuments({
        documents: [file(), file({ fileKey: 'uploads/2-b.jpg', mimeType: 'image/jpeg', size: 10 })],
      }),
    ).resolves.toBeDefined();
  });

  it.each([
    [
      'more than 10 files',
      { documents: Array.from({ length: 11 }, (_, i) => file({ fileKey: `uploads/${i}.pdf` })) },
    ],
    ['a non image/PDF mime type', { documents: [file({ mimeType: 'text/plain' })] }],
    ['a file key outside uploads/', { documents: [file({ fileKey: 'private/a.pdf' })] }],
    ['a nested file key', { documents: [file({ fileKey: 'uploads/x/a.pdf' })] }],
    ['a repeated file key', { documents: [file(), file()] }],
    ['a missing list', {}],
    ['unknown fields', { documents: [], extra: 1 }],
  ])('rejects documents with %s', async (_label, body) => {
    await expect(validateDocuments(body)).rejects.toMatchObject({ status: 400 });
  });

  it('no longer accepts evidence when updating or creating a contract', async () => {
    await expect(
      createApiValidationPipe().transform(
        { evidence: 'https://r2.example.com/uploads/a.jpg' },
        { type: 'body', metatype: UpdateContractDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      createApiValidationPipe().transform(
        { bookingItemId: '3f2b8a52-6a3c-4f0e-9f0e-0a1b2c3d4e5f', evidence: 'x' },
        { type: 'body', metatype: CreateContractDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
