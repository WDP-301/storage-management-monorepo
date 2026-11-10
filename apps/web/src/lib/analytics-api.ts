import { apiClient } from './api';

export interface FacilityKpis {
  scope: { facility_ids: string[] };
  units: {
    total: number;
    available: number;
    held: number;
    booked: number;
    rented: number;
    pending_inspection: number;
    maintenance: number;
    occupancy_rate: number;
  };
  revenue: { month: string; received: number };
  receivables: { overdue_invoice_count: number; overdue_due: number };
  refunds: { pending_count: number; pending_amount: number };
  contracts: { active: number; expiring_within_30_days: number };
}

export const AnalyticsApi = {
  facilityKpis: async (facilityId?: string): Promise<FacilityKpis> => {
    const res = await apiClient.get<{ success: boolean; data: FacilityKpis }>(
      '/analytics/facility-kpis',
      { params: facilityId ? { facilityId } : {} },
    );
    return res.data.data;
  },
};
