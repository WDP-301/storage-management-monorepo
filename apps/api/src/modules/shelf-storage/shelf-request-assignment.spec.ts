import { StaffShift } from '@entities/staff-shift.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { Logger } from '@nestjs/common';
import { NotificationType } from '@storage/types';
import { loadDropOffRequests } from './drop-off-request.read';
import { loadPickupRequests } from './pickup-request.read';
import {
  assignShelfRequest,
  assignShelfRequestSafely,
  pendingShelfRequests,
  shelfRequestRecipients,
} from './shelf-request-assignment';

jest.mock('./pickup-request.read');
jest.mock('./drop-off-request.read');

const TEN_AM = new Date('2026-11-01T03:00:00Z'); // 10:00 in Vietnam

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
const requestView = {
  id: 'req-1',
  customer: { id: 'cust-1', fullName: 'Hoa' },
  shelf: { code: 'K-01' },
  warehouse: { id: 'w-1' },
  requestedFor: TEN_AM,
  lines: [{ name: 'Sách', quantity: 2, unit: 'BOX' }],
};

describe('shelf request assignment', () => {
  let openRow: { requestedFor: Date; facilityId: string } | null;
  let last: { staffId: string } | null;
  let shifts: ReturnType<typeof morningShift>[];
  let em: { transaction: jest.Mock; find: jest.Mock; query: jest.Mock };
  let notifications: { createForUsers: jest.Mock };

  const updates = () =>
    em.query.mock.calls.filter(([sql]) => String(sql).trimStart().startsWith('UPDATE'));

  beforeEach(() => {
    openRow = { requestedFor: TEN_AM, facilityId: 'hcm' };
    last = null;
    shifts = [morningShift('an'), morningShift('binh')];
    em = {
      transaction: jest.fn((work: (e: unknown) => unknown) => work(em)),
      find: jest.fn((entity: unknown) => {
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
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE OF r')) return openRow ? [openRow] : [];
        if (sql.includes('AS "staffId"')) return last ? [last] : [];
        return [];
      }),
    };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    jest.mocked(loadPickupRequests).mockResolvedValue([requestView] as never);
    jest.mocked(loadDropOffRequests).mockResolvedValue([requestView] as never);
  });

  afterEach(() => jest.resetAllMocks());

  it('gives the request to the first staff member on shift, by name, and tells only them', async () => {
    const staffId = await assignShelfRequest(em as never, 'PICKUP', 'req-1', notifications);

    expect(staffId).toBe('an');
    expect(updates()).toEqual([[expect.stringContaining('"pickup_requests"'), ['req-1', 'an']]]);
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      'shelf_pickup_rotation:hcm',
    ]);
    expect(notifications.createForUsers).toHaveBeenCalledWith(em, ['an'], {
      type: NotificationType.PICKUP_REQUEST_CREATED,
      title: 'Bạn được giao yêu cầu lấy đồ',
      body: 'Chuẩn bị Sách ×2 thùng ở kệ K-01 cho Hoa lúc 10:00 01/11',
      data: { pickupRequestId: 'req-1', warehouseId: 'w-1', facilityId: 'hcm' },
    });
  });

  it('continues after whoever was given that kind of request last', async () => {
    last = { staffId: 'an' };
    expect(await assignShelfRequest(em as never, 'DROP_OFF', 'req-1', notifications)).toBe('binh');
    expect(updates()[0][0]).toContain('"drop_off_requests"');
    expect(notifications.createForUsers.mock.calls[0][2]).toMatchObject({
      type: NotificationType.DROP_OFF_REQUEST_CREATED,
      title: 'Bạn được giao yêu cầu gửi đồ',
      data: { dropOffRequestId: 'req-1' },
    });
  });

  it('skips staff without a shift covering the appointment and wraps around', async () => {
    last = { staffId: 'binh' };
    shifts = [morningShift('an')];
    expect(await assignShelfRequest(em as never, 'PICKUP', 'req-1', notifications)).toBe('an');
  });

  it('leaves the request unassigned when nobody is on shift then', async () => {
    shifts = [];
    expect(await assignShelfRequest(em as never, 'PICKUP', 'req-1', notifications)).toBeNull();
    expect(updates()).toEqual([]);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('does nothing for a request already assigned, closed or locked elsewhere', async () => {
    openRow = null;
    expect(await assignShelfRequest(em as never, 'PICKUP', 'req-1', notifications)).toBeNull();
    expect(em.find).not.toHaveBeenCalled();
  });

  it('never throws: a failure leaves the request to the branch', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    em.find.mockRejectedValue(new Error('db down'));
    await expect(
      assignShelfRequestSafely(em as never, 'PICKUP', 'req-1', notifications),
    ).resolves.toBeNull();
  });

  it('lists open unassigned requests of both kinds, oldest first', async () => {
    em.query.mockImplementation(async (sql: string) =>
      sql.includes('"pickup_requests"')
        ? [{ id: 'p-2', createdAt: new Date('2026-11-01T02:00:00Z') }]
        : [{ id: 'd-1', createdAt: new Date('2026-11-01T01:00:00Z') }],
    );
    expect(await pendingShelfRequests(em as never, 'hcm', TEN_AM, TEN_AM)).toEqual([
      { kind: 'DROP_OFF', id: 'd-1' },
      { kind: 'PICKUP', id: 'p-2' },
    ]);
  });

  it('tells the assignee and managers, or the whole branch when unassigned', async () => {
    em.query.mockImplementation(async (sql: string) =>
      sql.includes("'FACILITY_MANAGER' AND")
        ? [{ userId: 'boss' }]
        : [{ userId: 'an' }, { userId: 'binh' }, { userId: 'boss' }],
    );
    expect(await shelfRequestRecipients(em as never, 'hcm', 'an')).toEqual(['an', 'boss']);
    expect(await shelfRequestRecipients(em as never, 'hcm', null)).toEqual(['an', 'binh', 'boss']);
  });
});
