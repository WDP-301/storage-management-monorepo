jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));

import { NotificationType } from '@storage/types';
import { ShelfRequestSweepService } from './shelf-request-sweep.service';

const NOW = new Date('2026-07-01T10:00:00+07:00'); // 10:00 VN — cutoff is midnight VN today.
const STALE = '2026-06-30T15:00:00+07:00';

const rawView = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  status: 'CANCELLED',
  contractId: 'contract-1',
  contractNo: 'HD-1',
  shelfId: 'shelf-1',
  shelfCode: 'K-01',
  shelfName: 'Kệ 01',
  warehouseId: 'wh-1',
  warehouseCode: 'WH-1',
  warehouseName: 'Kho 1',
  customerId: 'customer-1',
  customerName: 'Khách A',
  customerPhone: '090',
  requestedFor: new Date(STALE),
  note: null,
  lines: [{ name: 'Thùng', quantity: 2, unit: 'PACKAGE' }],
  createdAt: new Date(),
  assignedToId: null,
  assignedToName: null,
  confirmedAt: null,
  confirmedById: null,
  confirmedByName: null,
  readyAt: null,
  readyById: null,
  readyByName: null,
  cancelledAt: new Date(),
  cancelledById: null,
  completedAt: null,
  completedReceiptId: null,
  ...overrides,
});

describe('ShelfRequestSweepService', () => {
  let expired: boolean;
  let advisoryGranted: boolean;
  let em: { query: jest.Mock };
  let candidates: { PICKUP: { id: string }[]; DROP_OFF: { id: string }[] };
  let runnerQuery: jest.Mock;
  let notifications: { createForUsers: jest.Mock };
  let service: ShelfRequestSweepService;

  beforeEach(() => {
    expired = true;
    advisoryGranted = true;
    candidates = { PICKUP: [{ id: 'req-1' }], DROP_OFF: [] };
    runnerQuery = jest.fn(async (sql: string) =>
      sql.includes('pg_try_advisory_lock') ? [{ acquired: advisoryGranted }] : [],
    );
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('UPDATE')) return expired ? [{ id: 'req-1' }] : [];
        if (sql.includes('user_role_assignments')) return [{ userId: 'staff-1' }];
        if (sql.includes('"facility_id"')) return [{ facilityId: 'fac-1' }];
        if (sql.includes('"pickup_requests" r') || sql.includes('"drop_off_requests" r'))
          return [rawView()];
        return [];
      }),
    };
    notifications = { createForUsers: jest.fn() };
    service = new ShelfRequestSweepService(
      {
        createQueryRunner: jest.fn(() => ({
          connect: jest.fn(),
          query: runnerQuery,
          release: jest.fn(),
          manager: {
            query: jest.fn(async (sql: string) => {
              if (sql.includes('"pickup_requests"')) return candidates.PICKUP;
              if (sql.includes('"drop_off_requests"')) return candidates.DROP_OFF;
              return [];
            }),
          },
        })),
        transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(em)),
      } as never,
      notifications as never,
    );
  });

  it('expires a stale open pickup request and notifies customer and branch', async () => {
    const result = await service.run(NOW);

    expect(result.expired).toBe(1);
    const calls = notifications.createForUsers.mock.calls;
    // First notice goes to the customer; the second to the facility.
    expect(calls[0][1]).toEqual(['customer-1']);
    expect(calls[0][2].type).toBe(NotificationType.PICKUP_REQUEST_CANCELLED);
    expect(calls[1][1]).toEqual(['staff-1']);
    expect(calls[1][2].type).toBe(NotificationType.PICKUP_REQUEST_CANCELLED);
  });

  it('expires a stale drop-off request with its own notice', async () => {
    candidates = { PICKUP: [], DROP_OFF: [{ id: 'req-1' }] };

    const result = await service.run(NOW);

    expect(result.expired).toBe(1);
    expect(notifications.createForUsers.mock.calls[0][2].type).toBe(
      NotificationType.DROP_OFF_REQUEST_CANCELLED,
    );
  });

  it('leaves a request alone when it was already closed inside the transaction', async () => {
    expired = false;

    const result = await service.run(NOW);

    expect(result.expired).toBe(0);
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });

  it('does nothing while another instance holds the advisory lock', async () => {
    advisoryGranted = false;

    const result = await service.run(NOW);

    expect(result.expired).toBe(0);
    expect(em.query).not.toHaveBeenCalled();
  });
});
