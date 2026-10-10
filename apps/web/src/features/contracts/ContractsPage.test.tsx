import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractsApi } from '../../lib/api';
import { contractRecord, mockRole, mockSelectedFacility } from '../../test-utils/contract-fixtures';
import type { ContractListQuery } from '../../types/contract';
import { ContractsPage } from './ContractsPage';

vi.mock('../../lib/toast', () => ({ useAppToast: () => ({ notifyUpdated: vi.fn() }) }));

const page = (contracts = [contractRecord()], total = contracts.length) => ({
  contracts,
  meta: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) },
});

describe('ContractsPage', () => {
  let list: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRole(UserRole.OPERATIONS_MANAGER);
    mockSelectedFacility(null);
    list = vi.spyOn(ContractsApi, 'list').mockResolvedValue(page());
  });

  afterEach(() => vi.restoreAllMocks());

  it('lists contracts with a short number, customer, unit, term, price and status', async () => {
    render(<ContractsPage />);
    const row = (await screen.findByText('CT-41BF439C')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Khách hàng Demo')).toBeTruthy();
    expect(within(row).getByText('0900000005')).toBeTruthy();
    expect(within(row).getByText('HCM-SG-01')).toBeTruthy();
    expect(within(row).getByText('6 tháng')).toBeTruthy();
    expect(within(row).getByText('3.200.000 đ')).toBeTruthy();
    expect(within(row).getByText('Chưa giao người')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Biên bản nhận' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Biên bản trả' })).toBeTruthy();
    expect(within(row).getByText('Chờ nhận kho')).toBeTruthy();
    expect(list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      facilityId: undefined,
      status: undefined,
      search: undefined,
    });
  });

  it('scopes the list to the facility picked in the header', async () => {
    mockSelectedFacility({ id: 'fac-dn', name: 'Cơ sở Đà Nẵng' });
    render(<ContractsPage />);
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ facilityId: 'fac-dn' })),
    );
  });

  it('waits for a facility manager to have a facility before loading', async () => {
    mockRole(UserRole.FACILITY_MANAGER);
    render(<ContractsPage />);
    await screen.findByText('Không có hợp đồng nào khớp bộ lọc.');
    expect(list).not.toHaveBeenCalled();
  });

  it('searches on the server after typing stops', async () => {
    render(<ContractsPage />);
    await screen.findByText('CT-41BF439C');
    fireEvent.change(screen.getByLabelText('Tìm hợp đồng'), { target: { value: ' 0900 ' } });
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: '0900', page: 1 })),
    );
  });

  it('filters by status', async () => {
    render(<ContractsPage />);
    await screen.findByText('CT-41BF439C');
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc trạng thái hợp đồng' }));
    const option = await screen.findByRole('option', { name: 'Đang hiệu lực' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ACTIVE' })),
    );
  });

  it('shows the planned end, or the recorded end once set', async () => {
    list.mockResolvedValue(
      page([
        contractRecord({ id: 'a', months: 12 }),
        contractRecord({
          id: 'b',
          contract_no: 'CT-aaaaaaaa-0000',
          ended_at: '2027-01-15T00:00:00.000Z',
        }),
      ]),
    );
    render(<ContractsPage />);
    expect(await screen.findByText('15/10/2026 → 14/10/2027')).toBeTruthy();
    expect(screen.getByText('15/10/2026 → 15/01/2027')).toBeTruthy();
  });

  it('shows the handover and the return record in their own columns', async () => {
    const step = {
      id: 'r-1',
      type: 'RETURN',
      scheduled_at: '2027-04-14T00:00:00.000Z',
      inspected_at: null,
      finalized_at: null,
      inspector_name: null,
    };
    const signedHandover = {
      ...step,
      id: 'h-1',
      type: 'PRE_HANDOVER',
      finalized_at: '2026-10-15T03:00:00.000Z',
      inspector_name: 'Nhân viên kho Demo',
    };
    list.mockResolvedValue(
      page([
        contractRecord({ status: 'ACTIVE', handover: signedHandover, return: step }),
        contractRecord({
          id: 'b',
          contract_no: 'CT-bbbbbbbb-0',
          handover: { ...signedHandover, finalized_at: null },
        }),
      ]),
    );
    render(<ContractsPage />);
    await screen.findByText('CT-BBBBBBBB');
    const [returning, fresh] = screen.getAllByRole('row').slice(1);
    const cells = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .slice(5, 7)
        .map((cell) => cell.textContent);
    expect(cells(returning)).toEqual(['Đã chốt 15/10/2026', 'Chưa giao người']);
    // A new contract only has its handover record.
    expect(cells(fresh)).toEqual(['Nhân viên kho Demo', '—']);
    expect(within(returning).getByText('Chưa giao người').className).toContain('text-kumo-warning');
  });

  it('opens the detail of a contract', async () => {
    render(<ContractsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem hợp đồng CT-41BF439C' }));
    expect(screen.getByRole('dialog', { name: 'Hợp đồng CT-41BF439C' })).toBeTruthy();
  });

  it('steps back a page when the last row of the last page is gone', async () => {
    list.mockImplementation(async (query?: ContractListQuery) =>
      query?.page === 2
        ? { contracts: [], meta: { page: 2, limit: 20, total: 20, totalPages: 1 } }
        : page([contractRecord()], 21),
    );
    render(<ContractsPage />);
    await screen.findByText('CT-41BF439C');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
    );
    expect(screen.getByText('CT-41BF439C')).toBeTruthy();
  });

  it('reports a failed load', async () => {
    list.mockRejectedValue(new Error('Máy chủ không phản hồi'));
    render(<ContractsPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('Máy chủ không phản hồi');
  });

  it('pages through the server results', async () => {
    list.mockResolvedValue(page([contractRecord()], 45));
    render(<ContractsPage />);
    await screen.findByText('CT-41BF439C');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
  });
});
