import type { UserRole } from '@storage/types';
import { vi } from 'vitest';
import * as AuthContextModule from '../context/AuthContext';
import * as FacilityContextModule from '../context/FacilityContext';
import type { ContractRecord } from '../types/contract';

export const contractRecord = (over: Partial<ContractRecord> = {}): ContractRecord => ({
  id: 'c-1',
  contract_no: 'CT-41bf439c-f69b-44ee-a615-3ccd5fa65e8f',
  kind: 'INITIAL',
  status: 'DRAFT',
  effective_at: '2026-10-15T00:00:00.000Z',
  ended_at: null,
  signed_at: null,
  months: 6,
  monthly_price: '3200000.00',
  deposit: '3200000.00',
  unit: { id: 'u-1', code: 'HCM-SG-01', name: 'Kho mini Sài Gòn', address_line: '45 Lê Thánh Tôn' },
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Cơ sở Hồ Chí Minh' },
  customer: {
    id: 'cus-1',
    full_name: 'Khách hàng Demo',
    email: 'customer@gmail.com',
    phone: '0900000005',
  },
  handover: {
    id: 'i-1',
    type: 'PRE_HANDOVER',
    scheduled_at: '2026-10-15T00:00:00.000Z',
    inspected_at: null,
    finalized_at: null,
    inspector_name: null,
  },
  return: null,
  documents: [],
  created_at: '2026-10-10T00:49:00.000Z',
  ...over,
});

export const mockRole = (role: UserRole) =>
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { id: 'u', email: 'x@demo.vn', fullName: 'Demo', roles: [role] },
    activeRole: role,
    isAuthenticated: true,
    isLoading: false,
  } as unknown as ReturnType<typeof AuthContextModule.useAuth>);

export const mockSelectedFacility = (facility: { id: string; name: string } | null) =>
  vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
    facilities: [],
    selectedFacility: facility,
    canSelectAll: true,
    isLoading: false,
    setSelectedFacilityId: vi.fn(),
  } as unknown as ReturnType<typeof FacilityContextModule.useFacility>);
