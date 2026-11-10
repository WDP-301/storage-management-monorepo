import { loadManagedFacilityIds } from '@modules/inspection/inspection-access.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitStatus, UserRole } from '@storage/types';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/types/auth-user';
import type { FacilityKpisResponse, UnitStatusCounts } from './types/facility-kpis';

const OCCUPIED: StorageUnitStatus[] = [
  StorageUnitStatus.RENTED,
  StorageUnitStatus.BOOKED,
  StorageUnitStatus.HELD,
  StorageUnitStatus.PENDING_INSPECTION,
];

/**
 * Business KPIs of one branch (or of every branch a global manager looks at): how full the
 * rentable units are, how much invoice money arrived this month, what is overdue, and how many
 * contracts run out within 30 days. Shelf warehouses are containers, not rentable stock — they
 * never appear in the unit counts; their shelves do.
 */
@Injectable()
export class FacilityKpisService {
  constructor(private readonly dataSource: DataSource) {}

  async getKpis(facilityId: string | undefined, actor: AuthUser): Promise<FacilityKpisResponse> {
    const scope = await this.resolveScope(facilityId, actor);

    const [units, revenue, receivables, refunds, contracts] = await Promise.all([
      this.unitCounts(scope),
      this.revenueThisMonth(scope),
      this.overdueReceivables(scope),
      this.pendingRefunds(scope),
      this.contractCounts(scope),
    ]);

    return { scope: { facility_ids: scope }, units, revenue, receivables, refunds, contracts };
  }

  /**
   * Which facilities the caller may see. A facility manager must name one of theirs (they never
   * work across branches); a global manager may omit the id to aggregate every branch.
   */
  private async resolveScope(facilityId: string | undefined, actor: AuthUser): Promise<string[]> {
    const global =
      actor.roles.includes(UserRole.ADMIN) || actor.roles.includes(UserRole.OPERATIONS_MANAGER);
    if (global) {
      if (facilityId) return [facilityId];
      const rows = (await this.dataSource.query(
        `SELECT id FROM facilities WHERE status <> 'INACTIVE'`,
      )) as Array<{ id: string }>;
      return rows.map((r) => r.id);
    }
    const managed = await loadManagedFacilityIds(this.dataSource.manager, actor.id);
    if (!facilityId || managed.includes(facilityId)) {
      if (managed.length === 0) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You are not assigned to any facility',
          HttpStatus.FORBIDDEN,
        );
      }
      return facilityId ? [facilityId] : managed;
    }
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not manage this facility',
      HttpStatus.FORBIDDEN,
    );
  }

  private async unitCounts(scope: string[]): Promise<UnitStatusCounts> {
    const rows = (await this.dataSource.query(
      `SELECT status, count(*)::int AS n FROM storage_units
        WHERE facility_id = ANY($1::uuid[]) AND deleted_at IS NULL AND kind <> 'SHELF_WAREHOUSE'
        GROUP BY status`,
      [scope],
    )) as Array<{ status: StorageUnitStatus; n: number }>;

    const counts: UnitStatusCounts = {
      total: 0,
      available: 0,
      held: 0,
      booked: 0,
      rented: 0,
      pending_inspection: 0,
      maintenance: 0,
      occupancy_rate: 0,
    };
    for (const row of rows) {
      counts.total += row.n;
      const key = row.status.toLowerCase() as keyof Omit<
        UnitStatusCounts,
        'total' | 'occupancy_rate'
      >;
      if (key in counts) counts[key] = row.n;
    }
    const occupied = rows.filter((r) => OCCUPIED.includes(r.status)).reduce((s, r) => s + r.n, 0);
    counts.occupancy_rate =
      counts.total > 0 ? Math.round((occupied / counts.total) * 1000) / 10 : 0;
    return counts;
  }

  /**
   * Money that actually arrived this Vietnam month on invoices of the scope's contracts.
   * Deposits are excluded on purpose — they are money held, not revenue.
   */
  private async revenueThisMonth(scope: string[]): Promise<FacilityKpisResponse['revenue']> {
    const [row] = (await this.dataSource.query(
      `SELECT coalesce(sum(p.amount), 0)::numeric(14,2) AS received
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN contracts c ON c.id = i.contract_id
         JOIN booking_items bi ON bi.id = c.booking_item_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
        WHERE p.status = 'SUCCEEDED' AND p.invoice_id IS NOT NULL
          AND su.facility_id = ANY($1::uuid[])
          AND date_trunc('month', coalesce(p.paid_at, p.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')
            = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      [scope],
    )) as Array<{ received: string }>;
    const [month] = (await this.dataSource.query(
      `SELECT to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS m`,
    )) as Array<{ m: string }>;
    return { month: month.m, received: Number(row?.received ?? 0) };
  }

  /** Open invoices past their due date: count and the still-unpaid remainder. */
  private async overdueReceivables(scope: string[]): Promise<FacilityKpisResponse['receivables']> {
    const [row] = (await this.dataSource.query(
      `SELECT count(*)::int AS overdue_invoice_count,
              coalesce(sum(i.total - coalesce(paid.s, 0)), 0)::numeric(14,2) AS overdue_due
         FROM invoices i
         JOIN contracts c ON c.id = i.contract_id AND c.deleted_at IS NULL
         JOIN booking_items bi ON bi.id = c.booking_item_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
         LEFT JOIN LATERAL (
            SELECT sum(p.amount) AS s FROM payments p
            WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED') paid ON TRUE
        WHERE i.status IN ('ISSUED', 'PARTIALLY_PAID') AND i.due_at < now()
          AND su.facility_id = ANY($1::uuid[])`,
      [scope],
    )) as Array<{ overdue_invoice_count: number; overdue_due: string }>;
    return {
      overdue_invoice_count: row?.overdue_invoice_count ?? 0,
      overdue_due: Number(row?.overdue_due ?? 0),
    };
  }

  /** Refunds approved but not yet completed: how many, and the money still owed to customers. */
  private async pendingRefunds(scope: string[]): Promise<FacilityKpisResponse['refunds']> {
    const [row] = (await this.dataSource.query(
      `SELECT count(*)::int AS pending_count,
              coalesce(sum(s.refund_amount), 0)::numeric(14,2) AS pending_amount
         FROM contract_settlements s
         JOIN contracts c ON c.id = s.contract_id AND c.deleted_at IS NULL
         JOIN booking_items bi ON bi.id = c.booking_item_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
        WHERE s.status = 'AWAITING_REFUND' AND s.refund_amount > 0
          AND su.facility_id = ANY($1::uuid[])`,
      [scope],
    )) as Array<{ pending_count: number; pending_amount: string }>;
    return {
      pending_count: row?.pending_count ?? 0,
      pending_amount: Number(row?.pending_amount ?? 0),
    };
  }

  /** Active contracts and how many reach their term end within the next 30 days. */
  private async contractCounts(scope: string[]): Promise<FacilityKpisResponse['contracts']> {
    const [row] = (await this.dataSource.query(
      `SELECT count(*)::int AS active,
              count(*) FILTER (
                WHERE c.effective_at + make_interval(months => c.months)
                    BETWEEN now() AND now() + interval '30 days')::int AS expiring_within_30_days
         FROM contracts c
         JOIN booking_items bi ON bi.id = c.booking_item_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
        WHERE c.status = 'ACTIVE' AND c.deleted_at IS NULL
          AND su.facility_id = ANY($1::uuid[])`,
      [scope],
    )) as Array<{ active: number; expiring_within_30_days: number }>;
    return {
      active: row?.active ?? 0,
      expiring_within_30_days: row?.expiring_within_30_days ?? 0,
    };
  }
}
