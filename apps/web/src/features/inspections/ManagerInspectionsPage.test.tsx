import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import * as FacilityContextModule from '../../context/FacilityContext';
import { ContractsApi, FacilitiesApi, InspectionsApi, UploadsApi } from '../../lib/api';
import type { InspectionRecord } from '../../types/inspection';
import { finalizeConsequence, inspectionMetrics, matchesSearch } from './inspection-display';
import { ManagerInspectionsPage } from './ManagerInspectionsPage';

const row = (
  overrides: Partial<InspectionRecord> & { code: string; customer: string },
): InspectionRecord => {
  const { code, customer, ...rest } = overrides;
  return {
    id: `insp-${code}`,
    type: 'PRE_HANDOVER',
    inspectedBy: null,
    conditionNotes: null,
    evidence: [],
    damages: [],
    scheduledAt: '2026-10-13T00:00:00.000Z',
    inspectedAt: null,
    finalizedAt: null,
    createdAt: '2026-10-08T00:00:00.000Z',
    inspector: null,
    contract: {
      id: `c-${code}`,
      contractNo: `CT-${code}`,
      status: 'DRAFT',
      effectiveAt: '2026-10-13T00:00:00.000Z',
      endedAt: null,
      months: 6,
      customerSnapshot: { fullName: customer, phone: '0912345678' },
      bookingItem: {
        storageUnit: {
          id: `u-${code}`,
          code,
          facilityId: 'fac-1',
          facility: { id: 'fac-1', name: 'Kho Quận 7' },
        },
      },
    },
    ...rest,
  };
};

const UNASSIGNED = row({ code: 'A-101', customer: 'Nguyễn Văn An' });
const ASSIGNED_RETURN = row({
  code: 'B-202',
  customer: 'Trần Thị Bình',
  type: 'RETURN',
  inspectedBy: 'staff-1',
  inspector: { id: 'staff-1', fullName: 'Lê Nhân Viên' },
  evidence: [{ fileKey: 'uploads/1-door.jpg', name: 'door.jpg', mimeType: 'image/jpeg' }],
  damages: [{ description: 'Móp cửa cuốn', severity: 'MAJOR' }],
});
const DONE = row({
  code: 'C-303',
  customer: 'Phạm Đã Xong',
  inspectedBy: 'staff-1',
  finalizedAt: new Date().toISOString(),
});

describe('inspection-display', () => {
  it('counts pending handovers/returns, unassigned and recent completions', () => {
    expect(inspectionMetrics([UNASSIGNED, ASSIGNED_RETURN, DONE], Date.now())).toEqual({
      pendingHandover: 1,
      pendingReturn: 1,
      unassigned: 1,
      doneLast7Days: 1,
    });
  });

  it('searches unit code, customer and phone ignoring accents', () => {
    expect(matchesSearch(UNASSIGNED, 'nguyen van')).toBe(true);
    expect(matchesSearch(UNASSIGNED, 'a-101')).toBe(true);
    expect(matchesSearch(UNASSIGNED, '0912')).toBe(true);
    expect(matchesSearch(UNASSIGNED, 'b-202')).toBe(false);
  });

  it('spells out what finalizing does', () => {
    expect(finalizeConsequence(UNASSIGNED)).toContain('Đang thuê');
    expect(finalizeConsequence(ASSIGNED_RETURN)).toContain('Bảo trì');
    expect(finalizeConsequence({ ...ASSIGNED_RETURN, damages: [] })).toContain('Trống');
  });
});

describe('ManagerInspectionsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeRole: UserRole.FACILITY_MANAGER,
    } as never);
    vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
      facilities: [],
      selectedFacility: {
        id: 'fac-1',
        code: 'Q7',
        name: 'Kho Quận 7',
        provinceCode: null,
        status: 'ACTIVE',
      },
      selectFacility: vi.fn(),
      canSelectAll: false,
      isLoading: false,
    });
    vi.spyOn(InspectionsApi, 'list').mockResolvedValue([UNASSIGNED, ASSIGNED_RETURN, DONE]);
    vi.spyOn(FacilitiesApi, 'listStaff').mockResolvedValue([
      { id: 'staff-1', fullName: 'Lê Nhân Viên', phone: null },
      { id: 'staff-2', fullName: 'Võ Kỹ Thuật', phone: '0909' },
    ]);
    vi.spyOn(UploadsApi, 'downloadUrl').mockResolvedValue('https://signed.example/door.jpg');
  });

  it('lists the selected facility and hides finalized records by default', async () => {
    render(<ManagerInspectionsPage />);

    expect(await screen.findByText('A-101')).toBeTruthy();
    expect(screen.getByText('B-202')).toBeTruthy();
    expect(screen.queryByText('C-303')).toBeNull();
    expect(InspectionsApi.list).toHaveBeenCalledWith({ facilityId: 'fac-1' });
  });

  it('does not load until the manager facility is selected', async () => {
    vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
      facilities: [],
      selectedFacility: null,
      selectFacility: vi.fn(),
      canSelectAll: false,
      isLoading: true,
    });
    render(<ManagerInspectionsPage />);

    await waitFor(() => expect(screen.queryByText('A-101')).toBeNull());
    expect(InspectionsApi.list).not.toHaveBeenCalled();
  });

  it('lets an admin on "all facilities" see every facility without a filter', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeRole: UserRole.ADMIN,
    } as never);
    vi.spyOn(FacilityContextModule, 'useFacility').mockReturnValue({
      facilities: [],
      selectedFacility: null,
      selectFacility: vi.fn(),
      canSelectAll: true,
      isLoading: false,
    });
    render(<ManagerInspectionsPage />);

    expect(await screen.findByText('A-101')).toBeTruthy();
    expect(InspectionsApi.list).toHaveBeenCalledWith({});
  });

  it('cancels a draft contract the customer never collected', async () => {
    const cancel = vi.spyOn(ContractsApi, 'cancel').mockResolvedValue();
    render(<ManagerInspectionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xem biên bản A-101' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Khách không nhận kho' }));
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận huỷ hợp đồng' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('c-A-101'));
  });

  it('assigns a staff member of the facility', async () => {
    const assign = vi.spyOn(InspectionsApi, 'assign').mockResolvedValue(UNASSIGNED);
    render(<ManagerInspectionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xem biên bản A-101' }));
    const select = await screen.findByRole('combobox', { name: 'Chọn nhân viên phụ trách' });
    await waitFor(() => expect(within(select).getByText('Võ Kỹ Thuật · 0909')).toBeTruthy());
    expect(FacilitiesApi.listStaff).toHaveBeenCalledWith('fac-1');
    // Finalizing needs an assignee first.
    expect(
      (screen.getByRole('button', { name: 'Chốt biên bản' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.change(select, { target: { value: 'staff-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giao nhân viên' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('insp-A-101', 'staff-2'));
    expect(InspectionsApi.list).toHaveBeenCalledTimes(2);
  });

  it('shows evidence and damages, and finalizes only after confirmation', async () => {
    const finalize = vi.spyOn(InspectionsApi, 'finalize').mockResolvedValue(ASSIGNED_RETURN);
    render(<ManagerInspectionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xem biên bản B-202' }));
    expect(await screen.findByText('Móp cửa cuốn')).toBeTruthy();
    expect(screen.getByText('Nghiêm trọng')).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByAltText('door.jpg') as HTMLImageElement).src).toBe(
        'https://signed.example/door.jpg',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chốt biên bản' }));
    expect(screen.getByText(/kho chuyển sang Bảo trì/)).toBeTruthy();
    expect(finalize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chốt' }));
    await waitFor(() => expect(finalize).toHaveBeenCalledWith('insp-B-202'));
  });

  it('searches within the default unfinalized view', async () => {
    render(<ManagerInspectionsPage />);
    await screen.findByText('A-101');

    fireEvent.change(screen.getByPlaceholderText('Tìm mã kho, khách, SĐT...'), {
      target: { value: 'pham da' },
    });
    expect(screen.queryByText('A-101')).toBeNull();
    expect(screen.queryByText('C-303')).toBeNull(); // still hidden: default filter is "Chưa chốt"
  });
});
