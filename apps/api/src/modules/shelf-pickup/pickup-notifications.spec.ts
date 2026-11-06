import type { PickupRequestView } from '@storage/types';
import { notifyFacilityStaff, notifyRequestReady } from './pickup-notifications';

const view = {
  id: 'req-1',
  contractId: 'c-1',
  shelf: { id: 's', code: 'K-01', name: 'Kệ 1' },
  warehouse: { id: 'w-1', code: 'W', name: 'W' },
  customer: { id: 'cust-1', fullName: 'An', phone: null },
  // 02:30 UTC = 09:30 in Vietnam
  requestedFor: new Date('2026-11-10T02:30:00Z'),
  lines: [{ itemId: 'i', name: 'Sách', quantity: 2, available: 5 }],
} as unknown as PickupRequestView;

describe('pickup notifications', () => {
  it('notifies the facility staff and managers once each, without a contractId', async () => {
    const em = { query: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]) };
    const notifications = { createForUsers: jest.fn() };

    await notifyFacilityStaff(em as never, notifications as never, view, 'fac-1');

    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toContain(`'FACILITY_STAFF', 'FACILITY_MANAGER'`);
    expect(sql).toContain('DISTINCT');
    expect(sql).toContain('"ends_at" IS NULL OR "ends_at" > now()');
    expect(params).toEqual(['fac-1']);
    const [, userIds, payload] = notifications.createForUsers.mock.calls[0];
    expect(userIds).toEqual(['u1', 'u2']);
    expect(payload).toMatchObject({
      type: 'PICKUP_REQUEST_CREATED',
      body: 'An muốn lấy Sách ×2 ở kệ K-01 lúc 09:30 10/11',
      data: { pickupRequestId: 'req-1', warehouseId: 'w-1', facilityId: 'fac-1' },
    });
    expect(payload.data).not.toHaveProperty('contractId');
  });

  it('tells the customer the request is ready', async () => {
    const notifications = { createForUsers: jest.fn() };

    await notifyRequestReady({} as never, notifications as never, view);

    expect(notifications.createForUsers).toHaveBeenCalledWith({}, ['cust-1'], {
      type: 'PICKUP_REQUEST_READY',
      title: 'Đồ đã sẵn sàng',
      body: expect.stringContaining('kệ K-01'),
      data: { contractId: 'c-1', pickupRequestId: 'req-1' },
    });
  });
});
