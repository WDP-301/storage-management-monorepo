import type { ShiftTemplate } from '@entities/shift-template.entity';
import type { StaffShift } from '@entities/staff-shift.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { PG_EXCLUSION_VIOLATION } from '@shared/utils/pg-error.util';
import { NotificationType, StaffShiftStatus, UserRole } from '@storage/types';
import { shiftPeriod } from './shift-calendar';
import { StaffShiftsService } from './staff-shifts.service';

const MORNING = {
  id: 'morning',
  code: 'MORNING',
  name: 'Ca sáng',
  startTime: '06:00:00',
  endTime: '12:00:00',
  isActive: true,
} as ShiftTemplate;

const actor = (roles: UserRole[], id = 'manager-hcm') => ({ id, roles }) as AuthUser;
const MANAGER = actor([UserRole.FACILITY_MANAGER]);
const ADMIN = actor([UserRole.ADMIN], 'admin');

const existingShift = (overrides: Partial<StaffShift> = {}): StaffShift =>
  ({
    id: 'shift-1',
    staffId: 'an',
    facilityId: 'hcm',
    shiftTemplateId: MORNING.id,
    workDate: '2099-01-10',
    ...shiftPeriod('2099-01-10', MORNING),
    status: StaffShiftStatus.SCHEDULED,
    ...overrides,
  }) as StaffShift;

async function rejection(promise: Promise<unknown>): Promise<DomainException> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DomainException);
  return error as DomainException;
}

const errorCode = (error: DomainException) => (error.getResponse() as { code: string }).code;

describe('StaffShiftsService', () => {
  let stored: StaffShift[];
  let em: {
    query: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let shiftsRepo: { find: jest.Mock; findOne: jest.Mock };
  let roleAssignments: { find: jest.Mock };
  let facilities: { findStaff: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let service: StaffShiftsService;

  beforeEach(() => {
    stored = [];
    em = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn((entity: { name: string }, { where }: { where: { id: string } }) =>
        Promise.resolve(
          entity.name === 'ShiftTemplate'
            ? where.id === MORNING.id
              ? MORNING
              : null
            : (stored.find((shift) => shift.id === where.id) ?? null),
        ),
      ),
      // Overlap lookups see the stored shifts, minus the one excluded by `id: Not(...)`.
      find: jest.fn(
        (_entity: unknown, { where }: { where: { id?: { type: string; value: string } } }) =>
          Promise.resolve(
            stored.filter((shift) => !(where.id?.type === 'not' && shift.id === where.id.value)),
          ),
      ),
      create: jest.fn((_entity: unknown, data: Partial<StaffShift>) => ({ ...data }) as StaffShift),
      save: jest.fn((rows: StaffShift | StaffShift[]) => {
        const list = (Array.isArray(rows) ? rows : [rows]).map((row, index) => ({
          ...row,
          id: row.id ?? `new-${index}`,
        }));
        return Promise.resolve(Array.isArray(rows) ? list : list[0]);
      }),
    };
    shiftsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(stored.find((shift) => shift.id === where.id) ?? null),
      ),
    };
    roleAssignments = {
      find: jest
        .fn()
        .mockResolvedValue([{ facilityId: 'hcm', startsAt: new Date('2020-01-01'), endsAt: null }]),
    };
    facilities = {
      findStaff: jest.fn().mockResolvedValue([
        { id: 'an', fullName: 'An' },
        { id: 'binh', fullName: 'Bình' },
      ]),
    };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    const dataSource = { transaction: jest.fn((work: (e: unknown) => unknown) => work(em)) };
    service = new StaffShiftsService(
      dataSource as never,
      shiftsRepo as never,
      roleAssignments as never,
      facilities as never,
      notifications as never,
    );
  });

  describe('list', () => {
    it('refuses a facility manager of another facility', async () => {
      const error = await rejection(
        service.list({ facilityId: 'hn', from: '2099-01-01', to: '2099-01-07' }, MANAGER),
      );

      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(shiftsRepo.find).not.toHaveBeenCalled();
    });

    it('lets an admin read any facility without a role lookup', async () => {
      await service.list({ facilityId: 'hn', from: '2099-01-01', to: '2099-01-07' }, ADMIN);

      expect(roleAssignments.find).not.toHaveBeenCalled();
      expect(shiftsRepo.find).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const dto = {
      facilityId: 'hcm',
      shiftTemplateId: MORNING.id,
      staffIds: ['an', 'binh'],
      workDates: ['2099-01-10', '2099-01-11'],
    };

    it('creates staff × dates shifts under the facility lock and notifies each staff once', async () => {
      await service.create(dto, MANAGER);

      expect(em.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'staff_shifts:hcm',
      ]);
      const saved = em.save.mock.calls[0][0] as StaffShift[];
      expect(saved).toHaveLength(4);
      expect(saved[0]).toMatchObject({
        staffId: 'an',
        workDate: '2099-01-10',
        assignedBy: MANAGER.id,
        status: StaffShiftStatus.SCHEDULED,
        ...shiftPeriod('2099-01-10', MORNING),
      });
      expect(notifications.createForUsers).toHaveBeenCalledTimes(2);
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['an'],
        expect.objectContaining({ type: NotificationType.SHIFT_ASSIGNED }),
      );
    });

    it('refuses staff who do not work at the facility', async () => {
      const error = await rejection(service.create({ ...dto, staffIds: ['an', 'chi'] }, MANAGER));

      expect(errorCode(error)).toBe(ErrorCode.VALIDATION_FAILED);
      expect(em.save).not.toHaveBeenCalled();
    });

    it('refuses an inactive or unknown shift template', async () => {
      const error = await rejection(service.create({ ...dto, shiftTemplateId: 'gone' }, MANAGER));

      expect(errorCode(error)).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('refuses shifts that would already have started', async () => {
      const error = await rejection(service.create({ ...dto, workDates: ['2020-01-10'] }, MANAGER));

      expect(errorCode(error)).toBe(ErrorCode.VALIDATION_FAILED);
      expect(em.save).not.toHaveBeenCalled();
    });

    it('creates nothing when any shift overlaps an existing one', async () => {
      stored = [
        existingShift({
          staffId: 'binh',
          workDate: '2099-01-11',
          ...shiftPeriod('2099-01-11', MORNING),
        }),
      ];

      const error = await rejection(service.create(dto, MANAGER));

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(errorCode(error)).toBe(ErrorCode.STAFF_SHIFT_OVERLAP);
      expect(error.getResponse()).toMatchObject({
        details: { conflicts: [{ staff_id: 'binh', work_date: '2099-01-11' }] },
      });
      expect(em.save).not.toHaveBeenCalled();
      expect(notifications.createForUsers).not.toHaveBeenCalled();
    });

    it('maps a race caught by the exclusion constraint to STAFF_SHIFT_OVERLAP', async () => {
      em.save.mockRejectedValueOnce({ code: PG_EXCLUSION_VIOLATION });

      const error = await rejection(service.create(dto, MANAGER));

      expect(errorCode(error)).toBe(ErrorCode.STAFF_SHIFT_OVERLAP);
    });
  });

  describe('update', () => {
    it('moves a shift to another day, recomputing its times', async () => {
      stored = [existingShift()];

      await service.update('shift-1', { workDate: '2099-01-12' }, MANAGER);

      expect(em.save.mock.calls[0][0][0]).toMatchObject({
        workDate: '2099-01-12',
        ...shiftPeriod('2099-01-12', MORNING),
      });
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['an'],
        expect.objectContaining({ type: NotificationType.SHIFT_UPDATED }),
      );
    });

    it('only edits the note without re-checking times', async () => {
      stored = [existingShift()];

      await service.update('shift-1', { note: 'Mang áo đồng phục' }, MANAGER);

      expect(em.save.mock.calls[0][0][0]).toMatchObject({ note: 'Mang áo đồng phục' });
      expect(em.find).toHaveBeenCalledTimes(1); // only the record reload
    });

    it('refuses a shift that has started', async () => {
      stored = [existingShift({ startAt: new Date('2020-01-01T00:00:00Z') })];

      const error = await rejection(service.update('shift-1', { note: 'x' }, MANAGER));

      expect(errorCode(error)).toBe(ErrorCode.STAFF_SHIFT_LOCKED);
    });

    it('returns 404 for an unknown shift', async () => {
      const error = await rejection(service.update('missing', { note: 'x' }, MANAGER));

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled shift and notifies the staff member', async () => {
      stored = [existingShift()];

      await service.cancel('shift-1', MANAGER);

      expect(em.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: StaffShiftStatus.CANCELLED }),
      );
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['an'],
        expect.objectContaining({ type: NotificationType.SHIFT_CANCELLED }),
      );
    });

    it('refuses a shift that is no longer scheduled', async () => {
      stored = [existingShift({ status: StaffShiftStatus.CHECKED_IN })];

      const error = await rejection(service.cancel('shift-1', MANAGER));

      expect(errorCode(error)).toBe(ErrorCode.STAFF_SHIFT_LOCKED);
    });

    it('refuses a facility manager of another facility', async () => {
      stored = [existingShift({ facilityId: 'hn' })];

      const error = await rejection(service.cancel('shift-1', MANAGER));

      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(em.save).not.toHaveBeenCalled();
    });
  });
});
