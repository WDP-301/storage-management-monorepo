import type { DropOffRequestView } from '@storage/types';
import {
  notifyDropOffCancelled,
  notifyDropOffConfirmed,
  notifyDropOffCreated,
} from './drop-off-notifications';

const view = {
  id: 'req-1',
  contractId: 'c-1',
  shelf: { id: 's', code: 'K-01', name: 'Kệ 1' },
  warehouse: { id: 'w-1', code: 'W', name: 'W' },
  customer: { id: 'cust-1', fullName: 'An', phone: null },
  // 02:30 UTC = 09:30 in Vietnam
  requestedFor: new Date('2026-11-10T02:30:00Z'),
  lines: [
    { itemId: 'i', name: 'Sách', quantity: 2 },
    { itemId: null, name: 'Chăn', quantity: 1 },
  ],
} as unknown as DropOffRequestView;

const staffEm = () => ({
  query: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
});

describe('drop-off notifications', () => {
  it('tells the facility staff and managers about a new request, without a contractId', async () => {
    const em = staffEm();
    const notifications = { createForUsers: jest.fn() };

    await notifyDropOffCreated(em as never, notifications as never, view, 'fac-1');

    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toContain(`'FACILITY_STAFF', 'FACILITY_MANAGER'`);
    expect(sql).toContain('DISTINCT');
    expect(params).toEqual(['fac-1']);
    const [usedEm, userIds, payload] = notifications.createForUsers.mock.calls[0];
    expect(usedEm).toBe(em);
    expect(userIds).toEqual(['u1', 'u2']);
    expect(payload).toEqual({
      type: 'DROP_OFF_REQUEST_CREATED',
      title: 'Yêu cầu gửi đồ mới',
      body: 'An muốn gửi Sách ×2, Chăn ×1 vào kệ K-01 lúc 09:30 10/11',
      data: { dropOffRequestId: 'req-1', warehouseId: 'w-1', facilityId: 'fac-1' },
    });
  });

  it('falls back to "Khách" when the customer has no name', async () => {
    const notifications = { createForUsers: jest.fn() };
    const anonymous = { ...view, customer: { ...view.customer, fullName: null } };

    await notifyDropOffCreated(staffEm() as never, notifications as never, anonymous, 'fac-1');

    expect(notifications.createForUsers.mock.calls[0][2].body).toMatch(/^Khách muốn gửi /);
  });

  it('tells the customer the branch is ready to receive the goods', async () => {
    const notifications = { createForUsers: jest.fn() };

    await notifyDropOffConfirmed({} as never, notifications as never, view);

    expect(notifications.createForUsers).toHaveBeenCalledWith({}, ['cust-1'], {
      type: 'DROP_OFF_REQUEST_CONFIRMED',
      title: 'Kho đã sẵn sàng nhận đồ',
      body: 'Kho đã xác nhận yêu cầu gửi đồ vào kệ K-01 lúc 09:30 10/11. Đưa mã gửi / lấy đồ cho nhân viên khi tới.',
      data: { contractId: 'c-1', dropOffRequestId: 'req-1' },
    });
  });

  it('tells the facility staff and managers the customer cancelled', async () => {
    const em = staffEm();
    const notifications = { createForUsers: jest.fn() };

    await notifyDropOffCancelled(em as never, notifications as never, view, 'fac-1');

    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('user_role_assignments'), [
      'fac-1',
    ]);
    const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
    expect(userIds).toEqual(['u1', 'u2']);
    expect(payload).toEqual({
      type: 'DROP_OFF_REQUEST_CANCELLED',
      title: 'Khách hủy yêu cầu gửi đồ',
      body: 'An đã hủy yêu cầu gửi Sách ×2, Chăn ×1 vào kệ K-01 (hẹn 09:30 10/11)',
      data: { dropOffRequestId: 'req-1', warehouseId: 'w-1', facilityId: 'fac-1' },
    });
    expect(payload.data).not.toHaveProperty('contractId');
  });
});
