import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractsApi } from '../../lib/api';
import { contractRecord } from '../../test-utils/contract-fixtures';
import type { ContractRecord } from '../../types/contract';
import { ContractEditDialog } from './ContractEditDialog';
import { endOfDateInput } from './contract-display';

const toast = vi.hoisted(() => ({ notifyUpdated: vi.fn() }));
vi.mock('../../lib/toast', () => ({ useAppToast: () => toast }));

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const fill = (label: string, value: string) =>
  fireEvent.change(input(label), { target: { value } });

const renderEdit = (contract: ContractRecord) => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<ContractEditDialog contract={contract} onClose={onClose} onSaved={onSaved} />);
  return { onSaved, onClose };
};

describe('ContractEditDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves only the changed terms of an unsigned contract', async () => {
    const update = vi.spyOn(ContractsApi, 'update').mockResolvedValue();
    const { onSaved } = renderEdit(contractRecord());
    expect(input('Thời hạn (tháng)').value).toBe('6');
    expect(input('Giá thuê / tháng (VND)').value).toBe('3200000');

    fill('Thời hạn (tháng)', '12');
    fill('Giá thuê / tháng (VND)', '3500000');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('c-1', { months: 12, monthlyPriceSnapshot: 3500000 }),
    );
    expect(toast.notifyUpdated).toHaveBeenCalledWith('hợp đồng', 'CT-41BF439C');
    expect(onSaved).toHaveBeenCalled();
  });

  it('locks the commercial terms of a signed contract and edits only the end date', async () => {
    const update = vi.spyOn(ContractsApi, 'update').mockResolvedValue();
    renderEdit(contractRecord({ status: 'ACTIVE', signed_at: '2026-10-15T03:00:00.000Z' }));

    expect(screen.getByText(/Hợp đồng đã ký/)).toBeTruthy();
    for (const label of ['Ngày hiệu lực', 'Thời hạn (tháng)', 'Giá thuê / tháng (VND)']) {
      expect(input(label).disabled).toBe(true);
    }
    expect(input('Ngày kết thúc').disabled).toBe(false);

    fill('Ngày kết thúc', '2027-10-15');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('c-1', { endedAt: endOfDateInput('2027-10-15') }),
    );
  });

  it('closes without a request when nothing changed', () => {
    const update = vi.spyOn(ContractsApi, 'update');
    const { onClose, onSaved } = renderEdit(contractRecord());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(update).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('explains invalid input instead of sending it', () => {
    const update = vi.spyOn(ContractsApi, 'update');
    renderEdit(contractRecord());
    fill('Thời hạn (tháng)', '61');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByRole('alert').textContent).toContain('1 đến 60');
    expect(update).not.toHaveBeenCalled();
  });

  it('explains that a stored end date cannot be cleared', () => {
    const update = vi.spyOn(ContractsApi, 'update');
    const { onClose } = renderEdit(contractRecord({ ended_at: '2027-04-14T16:59:59.999Z' }));
    fill('Ngày kết thúc', '');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByRole('alert').textContent).toBe('Không thể xóa ngày kết thúc đã lưu.');
    expect(update).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the API reason when saving fails', async () => {
    vi.spyOn(ContractsApi, 'update').mockRejectedValue(
      new Error('Contract is signed — these fields can no longer change: months'),
    );
    const { onSaved } = renderEdit(contractRecord());
    fill('Thời hạn (tháng)', '12');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect((await screen.findByRole('alert')).textContent).toContain('can no longer change');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
