import { ShiftTemplate } from '@entities/shift-template.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { PG_UNIQUE_VIOLATION } from '@shared/utils/pg-error.util';
import { ShiftTemplatesService } from './shift-templates.service';

const buildRow = (overrides: Partial<ShiftTemplate> = {}): ShiftTemplate =>
  ({
    id: 'morning',
    code: 'MORNING',
    name: 'Ca sáng',
    startTime: '06:00:00',
    endTime: '12:00:00',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as ShiftTemplate;

/** Resolves with the DomainException a call rejects with, for asserting code and status. */
async function rejection(promise: Promise<unknown>): Promise<DomainException> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DomainException);
  return error as DomainException;
}

const errorCode = (error: DomainException) => (error.getResponse() as { code: string }).code;

describe('ShiftTemplatesService', () => {
  let rows: ShiftTemplate[];
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let lockQuery: jest.Mock;
  let service: ShiftTemplatesService;

  beforeEach(() => {
    rows = [buildRow()];
    lockQuery = jest.fn().mockResolvedValue([]);
    repo = {
      // Active templates other than the one being saved, like `{ isActive: true, id: Not(id) }`.
      find: jest.fn(({ where }: { where?: { id?: { value: string } } } = {}) =>
        Promise.resolve(where ? rows.filter((r) => r.isActive && r.id !== where.id?.value) : rows),
      ),
      findOne: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      ),
      create: jest.fn((data: Partial<ShiftTemplate>) => ({ ...data }) as ShiftTemplate),
      save: jest.fn((row: ShiftTemplate) =>
        Promise.resolve(buildRow({ id: row.id ?? 'new-id', ...row })),
      ),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        transaction: jest.fn((work: (manager: unknown) => Promise<unknown>) =>
          work({ query: lockQuery, getRepository: () => repo }),
        ),
      },
    };
    service = new ShiftTemplatesService(repo as never);
  });

  describe('list', () => {
    it('returns every template by start time with HH:mm times', async () => {
      const result = await service.list();

      expect(repo.find).toHaveBeenCalledWith({ order: { startTime: 'ASC', code: 'ASC' } });
      expect(result.shift_templates[0]).toMatchObject({
        code: 'MORNING',
        start_time: '06:00',
        end_time: '12:00',
        is_active: true,
      });
    });
  });

  describe('create', () => {
    const dto = { code: 'AFTERNOON', name: 'Ca chiều', startTime: '12:00', endTime: '18:00' };

    it('saves an active template under the write lock', async () => {
      const result = await service.create(dto);

      expect(lockQuery).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'shift_templates',
      ]);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ ...dto, isActive: true }));
      expect(result.shift_template).toMatchObject({ code: 'AFTERNOON', start_time: '12:00' });
    });

    it('refuses a shift overlapping an active one', async () => {
      const error = await rejection(service.create({ ...dto, startTime: '11:00' }));

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(errorCode(error)).toBe(ErrorCode.SHIFT_TEMPLATE_OVERLAP);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows an overlapping shift that is created inactive', async () => {
      await service.create({ ...dto, startTime: '11:00', isActive: false });

      expect(repo.save).toHaveBeenCalled();
    });

    it('ignores overlaps with inactive shifts', async () => {
      rows = [buildRow({ isActive: false })];

      await service.create({ ...dto, startTime: '11:00' });

      expect(repo.save).toHaveBeenCalled();
    });

    it('refuses a shift whose start equals its end', async () => {
      const error = await rejection(service.create({ ...dto, endTime: '12:00' }));

      expect(errorCode(error)).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('maps a duplicate code to SHIFT_TEMPLATE_CODE_TAKEN', async () => {
      repo.save.mockRejectedValueOnce({ code: PG_UNIQUE_VIOLATION });

      const error = await rejection(service.create(dto));

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(errorCode(error)).toBe(ErrorCode.SHIFT_TEMPLATE_CODE_TAKEN);
    });
  });

  describe('update', () => {
    it('changes only the fields sent', async () => {
      await service.update('morning', { name: 'Ca sớm' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MORNING', name: 'Ca sớm', startTime: '06:00:00' }),
      );
    });

    it('does not compare a template with itself', async () => {
      await service.update('morning', { endTime: '11:00' });

      expect(repo.save).toHaveBeenCalled();
    });

    it('refuses re-activating a template that overlaps an active one', async () => {
      rows.push(
        buildRow({
          id: 'early',
          code: 'EARLY',
          startTime: '05:00:00',
          endTime: '07:00:00',
          isActive: false,
        }),
      );

      const error = await rejection(service.update('early', { isActive: true }));

      expect(errorCode(error)).toBe(ErrorCode.SHIFT_TEMPLATE_OVERLAP);
    });

    it('returns 404 for an unknown template', async () => {
      const error = await rejection(service.update('missing', { name: 'x' }));

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing template and returns it', async () => {
      const result = await service.remove('morning');

      expect(repo.softDelete).toHaveBeenCalledWith('morning');
      expect(result.shift_template).toMatchObject({ id: 'morning', code: 'MORNING' });
    });

    it('returns 404 for an unknown template', async () => {
      const error = await rejection(service.remove('missing'));

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });
  });
});
