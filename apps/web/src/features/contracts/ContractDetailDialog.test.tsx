import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractsApi, UploadsApi } from '../../lib/api';
import { contractRecord, mockRole } from '../../test-utils/contract-fixtures';
import type { ContractRecord } from '../../types/contract';
import { ContractDetailDialog } from './ContractDetailDialog';

vi.mock('../../lib/toast', () => ({ useAppToast: () => ({ notifyUpdated: vi.fn() }) }));

const ACTIONS = ['Hủy hợp đồng', 'Sửa hợp đồng', 'Xóa', 'Tải file lên', 'Thay file'];
const visibleActions = () =>
  ACTIONS.filter((name) => screen.queryByRole('button', { name }) !== null);

const renderDialog = (contract: ContractRecord, onChanged = vi.fn(), onClose = vi.fn()) => {
  render(<ContractDetailDialog contract={contract} onClose={onClose} onChanged={onChanged} />);
  return { onChanged, onClose };
};

describe('ContractDetailDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the customer, unit, terms, handover and the full number', () => {
    mockRole(UserRole.ADMIN);
    renderDialog(
      contractRecord({
        handover: {
          id: 'i-1',
          type: 'PRE_HANDOVER',
          scheduled_at: '2026-10-15T00:00:00.000Z',
          inspected_at: null,
          finalized_at: null,
          inspector_name: 'Nhân viên kho Demo',
        },
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Hợp đồng CT-41BF439C' })).toBeTruthy();
    for (const text of [
      'Khách hàng Demo',
      'customer@gmail.com',
      'HCM-SG-01 · Kho mini Sài Gòn',
      '45 Lê Thánh Tôn',
      'Thuê mới',
      'Đã giao nhân viên',
      'Nhân viên kho Demo',
      'CT-41bf439c-f69b-44ee-a615-3ccd5fa65e8f',
      'Chưa có file hợp đồng.',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByText('3.200.000 đ')).toHaveLength(2);
  });

  it.each([
    [UserRole.ADMIN, 'DRAFT', ['Hủy hợp đồng', 'Sửa hợp đồng', 'Tải file lên']],
    [UserRole.OPERATIONS_MANAGER, 'ACTIVE', ['Sửa hợp đồng', 'Tải file lên']],
    [UserRole.OPERATIONS_MANAGER, 'CANCELLED', ['Xóa', 'Tải file lên']],
    [UserRole.ADMIN, 'ENDED', ['Xóa', 'Tải file lên']],
    [UserRole.FACILITY_MANAGER, 'DRAFT', ['Hủy hợp đồng']],
    [UserRole.FACILITY_MANAGER, 'ACTIVE', []],
    [UserRole.FACILITY_MANAGER, 'CANCELLED', []],
  ] as const)('%s on a %s contract can use %j', (role, status, expected) => {
    mockRole(role);
    renderDialog(contractRecord({ status }));
    expect(visibleActions()).toEqual(expected);
  });

  it('cancels a draft after confirmation', async () => {
    mockRole(UserRole.FACILITY_MANAGER);
    const cancel = vi.spyOn(ContractsApi, 'cancel').mockResolvedValue();
    const { onChanged } = renderDialog(contractRecord());

    fireEvent.click(screen.getByRole('button', { name: 'Hủy hợp đồng' }));
    expect(screen.getByText(/Kho sẽ trở về trạng thái trống/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(cancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy hợp đồng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy hợp đồng' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('c-1'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('deletes a finished contract and closes', async () => {
    mockRole(UserRole.ADMIN);
    const remove = vi.spyOn(ContractsApi, 'remove').mockResolvedValue();
    const { onChanged, onClose } = renderDialog(contractRecord({ status: 'CANCELLED' }));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('c-1'));
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the API reason when an action fails and stays open', async () => {
    mockRole(UserRole.ADMIN);
    vi.spyOn(ContractsApi, 'remove').mockRejectedValue(
      new Error('Cannot delete a ACTIVE contract'),
    );
    const { onChanged, onClose } = renderDialog(contractRecord({ status: 'ENDED' }));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Cannot delete a ACTIVE contract',
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uploads a contract file and stores its link', async () => {
    mockRole(UserRole.OPERATIONS_MANAGER);
    const upload = vi.spyOn(UploadsApi, 'upload').mockResolvedValue({
      key: 'uploads/1-hop-dong.pdf',
      publicUrl: 'https://cdn.example.com/b/uploads/1-hop-dong.pdf',
    });
    const setEvidence = vi.spyOn(ContractsApi, 'setEvidence').mockResolvedValue();
    const { onChanged } = renderDialog(contractRecord());

    const file = new File(['%PDF'], 'hop-dong.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Chọn file hợp đồng'), { target: { files: [file] } });
    await waitFor(() =>
      expect(setEvidence).toHaveBeenCalledWith(
        'c-1',
        'https://cdn.example.com/b/uploads/1-hop-dong.pdf',
      ),
    );
    expect(upload).toHaveBeenCalledWith(file);
    expect(onChanged).toHaveBeenCalled();
  });

  it('opens an existing contract file through a fresh signed link', async () => {
    mockRole(UserRole.FACILITY_MANAGER);
    const downloadUrl = vi
      .spyOn(UploadsApi, 'downloadUrl')
      .mockResolvedValue('https://signed.example.com/x');
    const open = vi.spyOn(window, 'open').mockReturnValue({ location: {} } as Window);
    renderDialog(contractRecord({ evidence: 'https://cdn.example.com/b/uploads/1-hop-dong.pdf' }));

    fireEvent.click(screen.getByRole('button', { name: '1-hop-dong.pdf' }));
    await waitFor(() => expect(downloadUrl).toHaveBeenCalledWith('uploads/1-hop-dong.pdf'));
    expect(open).toHaveBeenCalled();
    // Managers can open the file but not replace it.
    expect(screen.queryByRole('button', { name: 'Thay file' })).toBeNull();
  });

  it('does not carry a pending action over to another contract', async () => {
    mockRole(UserRole.ADMIN);
    let fail: (err: Error) => void = () => {};
    vi.spyOn(ContractsApi, 'remove').mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const onClose = vi.fn();
    const props = { onClose, onChanged: vi.fn() };
    const { rerender } = render(
      <ContractDetailDialog contract={contractRecord({ status: 'ENDED' })} {...props} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));

    rerender(
      <ContractDetailDialog
        contract={contractRecord({ id: 'c-2', contract_no: 'CT-bbbbbbbb-0', status: 'ENDED' })}
        {...props}
      />,
    );
    expect((screen.getByRole('button', { name: 'Xóa' }) as HTMLButtonElement).disabled).toBe(false);
    fail(new Error('Cannot delete'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('switches to the edit form and back', () => {
    mockRole(UserRole.ADMIN);
    renderDialog(contractRecord());
    fireEvent.click(screen.getByRole('button', { name: 'Sửa hợp đồng' }));
    expect(screen.getByRole('dialog', { name: 'Sửa hợp đồng CT-41BF439C' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Hợp đồng CT-41BF439C' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(screen.getByRole('dialog', { name: 'Hợp đồng CT-41BF439C' })).toBeTruthy();
  });
});
