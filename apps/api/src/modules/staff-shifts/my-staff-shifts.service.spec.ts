import type { StaffShift } from '@entities/staff-shift.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StaffShiftStatus } from '@storage/types';
import { MyStaffShiftsService } from './my-staff-shifts.service';

const STAFF = { id: 'an' } as AuthUser;
const MINUTE = 60 * 1000;

const shiftStartingIn = (minutes: number, overrides: Partial<StaffShift> = {}): StaffShift =>
  ({
    id: 'shift-1',
    staffId: 'an',
    startAt: new Date(Date.now() + minutes * MINUTE),
    endAt: new Date(Date.now() + (minutes + 360) * MINUTE),
    status: StaffShiftStatus.SCHEDULED,
    ...overrides,
  }) as StaffShift;

async function rejection(promise: Promise<unknown>): Promise<DomainException> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DomainException);
  return error as DomainException;
}

const errorCode = (error: DomainException) => (error.getResponse() as { code: string }).code;

describe('MyStaffShiftsService', () => {
  let shift: StaffShift | null;
  let repo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock; findOneOrFail: jest.Mock };
  let service: MyStaffShiftsService;

  beforeEach(() => {
    shift = shiftStartingIn(10);
    repo = {
      find: jest.fn().mockResolvedValue([]),
      // Behaves like `{ id, staffId }`: someone else's shift is not found.
      findOne: jest.fn(({ where }: { where: { id: string; staffId: string } }) =>
        Promise.resolve(shift && shift.staffId === where.staffId ? shift : null),
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest.fn(() => Promise.resolve(shift)),
    };
    service = new MyStaffShiftsService(repo as never);
  });

  it('lists only my shifts', async () => {
    await service.list({ from: '2026-11-01', to: '2026-11-07' }, STAFF);

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ staffId: 'an' }) }),
    );
  });

  describe('checkIn', () => {
    it('checks in within 30 minutes of the start, conditional on SCHEDULED', async () => {
      await service.checkIn('shift-1', STAFF);

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'shift-1', status: StaffShiftStatus.SCHEDULED },
        expect.objectContaining({
          status: StaffShiftStatus.CHECKED_IN,
          checkInAt: expect.any(Date),
        }),
      );
    });

    it('allows a late check-in while the shift is still running', async () => {
      shift = shiftStartingIn(-60);

      await service.checkIn('shift-1', STAFF);

      expect(repo.update).toHaveBeenCalled();
    });

    it.each([
      ['too early', shiftStartingIn(31)],
      ['after the shift ended', shiftStartingIn(-400)],
      ['already checked in', shiftStartingIn(10, { status: StaffShiftStatus.CHECKED_IN })],
    ])('refuses when %s', async (_label, row) => {
      shift = row;

      const error = await rejection(service.checkIn('shift-1', STAFF));

      expect(errorCode(error)).toBe(ErrorCode.STAFF_SHIFT_CHECK_IN_NOT_ALLOWED);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('loses cleanly to a concurrent status change', async () => {
      repo.update.mockResolvedValueOnce({ affected: 0 });

      const error = await rejection(service.checkIn('shift-1', STAFF));

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it("treats someone else's shift as not found", async () => {
      shift = shiftStartingIn(10, { staffId: 'binh' });

      const error = await rejection(service.checkIn('shift-1', STAFF));

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('checkOut', () => {
    it('completes a checked-in shift', async () => {
      shift = shiftStartingIn(-60, { status: StaffShiftStatus.CHECKED_IN });

      await service.checkOut('shift-1', STAFF);

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'shift-1', status: StaffShiftStatus.CHECKED_IN },
        expect.objectContaining({
          status: StaffShiftStatus.COMPLETED,
          checkOutAt: expect.any(Date),
        }),
      );
    });

    it('refuses a shift that was never checked in', async () => {
      repo.update.mockResolvedValueOnce({ affected: 0 });

      const error = await rejection(service.checkOut('shift-1', STAFF));

      expect(errorCode(error)).toBe(ErrorCode.STAFF_SHIFT_CHECK_OUT_NOT_ALLOWED);
    });
  });
});
