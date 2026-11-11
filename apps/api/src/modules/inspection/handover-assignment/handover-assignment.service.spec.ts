import { Inspection } from '@entities/inspection.entity';
import { StaffShift } from '@entities/staff-shift.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { Logger } from '@nestjs/common';
import { NotificationType } from '@storage/types';
import { HandoverAssignmentService } from './handover-assignment.service';

const TEN_AM = new Date('2026-11-01T03:00:00Z'); // 10:00 in Vietnam

const handover = (id: string, facilityId: string, unitCode: string, scheduledAt = TEN_AM) =>
  ({
    id,
    scheduledAt,
    contract: {
      bookingItem: { bookingId: 'booking-1', storageUnit: { facilityId, code: unitCode } },
    },
  }) as unknown as Inspection;

const staffRole = (id: string, fullName: string) => ({
  facilityId: 'hcm',
  startsAt: new Date('2020-01-01'),
  endsAt: null,
  user: { id, fullName },
});

const morningShift = (staffId: string) => ({
  staffId,
  startAt: new Date('2026-10-31T23:00:00Z'),
  endAt: new Date('2026-11-01T05:00:00Z'),
});

describe('HandoverAssignmentService', () => {
  let handovers: Inspection[];
  let shifts: ReturnType<typeof morningShift>[];
  let lastAssigned: { inspectedBy: string } | null;
  let em: {
    transaction: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
  };
  let notifications: { createForUsers: jest.Mock };
  let service: HandoverAssignmentService;

  beforeEach(() => {
    handovers = [handover('i-1', 'hcm', 'A-01'), handover('i-2', 'hcm', 'A-02')];
    shifts = [morningShift('an'), morningShift('binh')];
    lastAssigned = null;
    em = {
      transaction: jest.fn((work: (e: unknown) => unknown) => work(em)),
      find: jest.fn((entity: unknown) => {
        if (entity === Inspection) return Promise.resolve(handovers);
        if (entity === UserRoleAssignment) {
          return Promise.resolve([
            staffRole('chi', 'Chi'),
            staffRole('an', 'An'),
            staffRole('binh', 'Bình'),
          ]);
        }
        if (entity === StaffShift) return Promise.resolve(shifts);
        return Promise.resolve([]);
      }),
      findOne: jest.fn(() => Promise.resolve(lastAssigned)),
      query: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    service = new HandoverAssignmentService(notifications as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('gives every handover of the booking to the first staff on shift, and notifies them', async () => {
    await service.assignSafely(em as never, 'booking-1');

    expect(em.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'handover_rotation:hcm',
    ]);
    expect(em.update).toHaveBeenCalledWith(
      Inspection,
      { id: expect.objectContaining({ value: ['i-1', 'i-2'] }) },
      { inspectedBy: 'an' },
    );
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['an'],
      expect.objectContaining({
        type: NotificationType.HANDOVER_ASSIGNED,
        body: expect.stringContaining('A-01, A-02'),
        data: { bookingId: 'booking-1', facilityId: 'hcm', inspectionIds: ['i-1', 'i-2'] },
      }),
    );
  });

  it('continues the rotation after the last assigned staff member', async () => {
    lastAssigned = { inspectedBy: 'an' };

    await service.assignSafely(em as never, 'booking-1');

    expect(em.update).toHaveBeenCalledWith(Inspection, expect.anything(), {
      inspectedBy: 'binh',
    });
  });

  it('skips staff who are not on shift at the handover time', async () => {
    lastAssigned = { inspectedBy: 'an' };
    shifts = [morningShift('an')];

    await service.assignSafely(em as never, 'booking-1');

    // Bình and Chi have no shift at 10:00, so the turn comes back round to An.
    expect(em.update).toHaveBeenCalledWith(Inspection, expect.anything(), { inspectedBy: 'an' });
  });

  it('leaves the handovers for a manager when nobody is on shift', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    shifts = [];

    await service.assignSafely(em as never, 'booking-1');

    expect(em.update).not.toHaveBeenCalled();
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('picks one staff member per facility of the booking', async () => {
    handovers = [handover('i-1', 'hcm', 'A-01'), handover('i-2', 'hn', 'B-01')];

    await service.assignSafely(em as never, 'booking-1');

    expect(em.query).toHaveBeenCalledWith(expect.any(String), ['handover_rotation:hcm']);
    expect(em.query).toHaveBeenCalledWith(expect.any(String), ['handover_rotation:hn']);
    expect(em.update).toHaveBeenCalledTimes(2);
  });

  it('re-assigns a facility handover that was left pending (e.g. a shift added later)', async () => {
    handovers = [handover('i-1', 'hcm', 'A-01')];

    const visited = await service.assignPendingForFacility(
      em as never,
      'hcm',
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-11-02T00:00:00Z'),
    );

    expect(visited).toBe(1);
    expect(em.update).toHaveBeenCalledWith(Inspection, expect.anything(), { inspectedBy: 'an' });
  });

  it('does nothing when no handover is pending in the window', async () => {
    handovers = [];

    const visited = await service.assignPendingForFacility(
      em as never,
      'hcm',
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-11-02T00:00:00Z'),
    );

    expect(visited).toBe(0);
    expect(em.update).not.toHaveBeenCalled();
  });

  it('never throws, so the deposit confirmation is not undone', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    em.update.mockRejectedValueOnce(new Error('db down'));

    await expect(service.assignSafely(em as never, 'booking-1')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
