/** Rentable-unit status breakdown; `occupancy_rate` is a percentage with one decimal. */
export interface UnitStatusCounts {
  total: number;
  available: number;
  held: number;
  booked: number;
  rented: number;
  pending_inspection: number;
  maintenance: number;
  occupancy_rate: number;
}

export interface FacilityKpisResponse {
  /** The facilities the answer aggregates — one for a branch manager, possibly all for ops. */
  scope: { facility_ids: string[] };
  units: UnitStatusCounts;
  /** Invoice money received in the current Vietnam month (deposits excluded). */
  revenue: { month: string; received: number };
  receivables: { overdue_invoice_count: number; overdue_due: number };
  /** Approved settlements whose refund transfer is not yet confirmed — money owed to customers. */
  refunds: { pending_count: number; pending_amount: number };
  contracts: { active: number; expiring_within_30_days: number };
}
