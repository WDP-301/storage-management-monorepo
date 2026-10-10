import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilitiesApi, InspectionsApi } from '../../lib/api';
import { contractRecord } from '../../test-utils/contract-fixtures';
import type { ContractInspectionSummary, ContractRecord } from '../../types/contract';
import { ContractStaffSection } from './ContractStaffSection';

const step = (over: Partial<ContractInspectionSummary> = {}): ContractInspectionSummary => ({
  id: 'i-1',
  type: 'PRE_HANDOVER',
  scheduled_at: '2026-10-15T00:00:00.000Z',
  inspected_at: null,
  finalized_at: null,
  inspector_name: null,
  ...over,
});

const renderSection = (contract: ContractRecord, canAssign = true) => {
  const onChanged = vi.fn();
  const onOpenInspection = vi.fn();
  render(
    <ContractStaffSection
      contract={contract}
      canAssign={canAssign}
      onOpenInspection={onOpenInspection}
      onChanged={onChanged}
    />,
  );
  return { onChanged, onOpenInspection };
};

describe('ContractStaffSection', () => {
  let listStaff: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listStaff = vi.spyOn(FacilitiesApi, 'listStaff').mockResolvedValue([
      { id: 's-1', fullName: 'Nhân viên kho Demo', phone: '0900000004' },
      { id: 's-2', fullName: 'Võ Kỹ Thuật', phone: null },
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('assigns a staff member of the contract facility to the handover', async () => {
    const assign = vi.spyOn(InspectionsApi, 'assign').mockResolvedValue({} as never);
    const { onChanged } = renderSection(contractRecord({ handover: step() }));

    expect(screen.getByText('Chưa giao nhân viên')).toBeTruthy();
    await waitFor(() => expect(listStaff).toHaveBeenCalledWith('fac-1'));
    const select = screen.getByLabelText('Chọn nhân viên nhận kho');
    await waitFor(() => expect(within(select).getByText('Võ Kỹ Thuật')).toBeTruthy());
    const button = screen.getByRole('button', { name: 'Giao nhân viên' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(select, { target: { value: 's-2' } });
    fireEvent.click(button);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('i-1', 's-2'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('offers to change the assignee and shows the return step once requested', async () => {
    renderSection(
      contractRecord({
        status: 'ACTIVE',
        handover: step({
          inspector_name: 'Nhân viên kho Demo',
          finalized_at: '2026-10-15T03:00:00.000Z',
        }),
        return: step({ id: 'r-1', type: 'RETURN', inspector_name: 'Võ Kỹ Thuật' }),
      }),
    );
    expect(screen.getByText(/Đã chốt 15\/10\/2026/)).toBeTruthy();
    // A finished handover cannot be reassigned; the open return can.
    expect(screen.queryByLabelText('Chọn nhân viên nhận kho')).toBeNull();
    expect(screen.getByLabelText('Chọn nhân viên trả kho')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đổi nhân viên' })).toBeTruthy();
  });

  it('shows the API reason when the assignment is refused', async () => {
    vi.spyOn(InspectionsApi, 'assign').mockRejectedValue(
      new Error('Staff user is not assigned to this facility'),
    );
    const { onChanged } = renderSection(contractRecord({ handover: step() }));
    const select = screen.getByLabelText('Chọn nhân viên nhận kho');
    await waitFor(() => expect(within(select).getByText('Võ Kỹ Thuật')).toBeTruthy());
    fireEvent.change(select, { target: { value: 's-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giao nhân viên' }));
    expect((await screen.findByRole('alert')).textContent).toContain('not assigned');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('is read-only for roles that cannot assign and skips loading staff', () => {
    renderSection(contractRecord({ handover: step() }), false);
    expect(screen.queryByLabelText('Chọn nhân viên nhận kho')).toBeNull();
    expect(listStaff).not.toHaveBeenCalled();
  });

  it('opens the inspection record from its row', () => {
    const { onOpenInspection } = renderSection(contractRecord({ handover: step() }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem biên bản nhận kho' }));
    expect(onOpenInspection).toHaveBeenCalledWith('i-1');
  });

  it('says so when the contract has no handover yet', () => {
    renderSection(contractRecord({ handover: null }));
    expect(screen.getByText('Chưa có biên bản nhận kho.')).toBeTruthy();
    expect(listStaff).not.toHaveBeenCalled();
  });

  it('shows only the handover record until the customer asks to return', () => {
    renderSection(contractRecord({ handover: step() }));
    expect(screen.getByText('Biên bản nhận kho')).toBeTruthy();
    expect(screen.queryByText('Biên bản trả kho')).toBeNull();
    expect(screen.getByText('Hẹn nhận kho 15/10/2026')).toBeTruthy();
  });

  it('gives the return record its own section once it exists', () => {
    renderSection(
      contractRecord({
        status: 'ACTIVE',
        handover: step({ finalized_at: '2026-10-15T03:00:00.000Z' }),
        return: step({ id: 'r-1', type: 'RETURN', scheduled_at: '2027-04-14T00:00:00.000Z' }),
      }),
    );
    const sections = screen.getAllByText(/^Biên bản (nhận|trả) kho$/).map((el) => el.textContent);
    expect(sections).toEqual(['Biên bản nhận kho', 'Biên bản trả kho']);
    expect(screen.getByText('Hẹn trả kho 14/04/2027')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xem biên bản trả kho' })).toBeTruthy();
  });
});
