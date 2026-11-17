import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole } from '@storage/types';
import { FacilityKpisService } from './facility-kpis.service';

const actor = (roles: UserRole[], id = 'usr-1') => ({ id, roles }) as AuthUser;

describe('FacilityKpisService', () => {
  let query: jest.Mock;
  let service: FacilityKpisService;

  beforeEach(() => {
    query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM storage_units')) {
        return [
          { status: 'AVAILABLE', n: 5 },
          { status: 'RENTED', n: 4 },
          { status: 'HELD', n: 1 },
        ];
      }
      if (sql.includes('FROM payments p')) return [{ received: '2500000.00' }];
      if (sql.includes("to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh'")) return [{ m: '2026-11' }];
      if (sql.includes('FROM invoices i')) {
        return [{ overdue_invoice_count: 1, overdue_due: '500000.00' }];
      }
      if (sql.includes('FROM contract_settlements s')) {
        return [{ pending_count: 1, pending_amount: '200000.00' }];
      }
      return [{ active: 4, expiring_within_30_days: 1 }];
    });
    service = new FacilityKpisService({ query } as never);
  });

  it('excludes DEPOSIT_TOPUP and VOID invoices from monthly revenue aggregation', async () => {
    const res = await service.getKpis('fac-1', actor([UserRole.ADMIN]));

    const revenueCall = query.mock.calls.find(([sql]) => String(sql).includes('FROM payments p'));
    expect(revenueCall?.[0]).toContain("i.kind <> 'DEPOSIT_TOPUP'");
    expect(revenueCall?.[0]).toContain("i.status <> 'VOID'");
    expect(res.revenue).toEqual({ month: '2026-11', received: 2500000 });
  });
});
