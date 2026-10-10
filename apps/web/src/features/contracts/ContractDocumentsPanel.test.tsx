import { UserRole } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractsApi, UploadsApi } from '../../lib/api';
import { contractRecord, mockRole } from '../../test-utils/contract-fixtures';
import type { ContractDocument, ContractRecord } from '../../types/contract';
import { ContractDetailDialog } from './ContractDetailDialog';

vi.mock('../../lib/toast', () => ({ useAppToast: () => ({ notifyUpdated: vi.fn() }) }));

const PDF: ContractDocument = {
  fileKey: 'uploads/1-hop-dong.pdf',
  name: 'hop-dong.pdf',
  mimeType: 'application/pdf',
  size: 2048,
};
const PHOTO: ContractDocument = {
  fileKey: 'uploads/2-trang-2.jpg',
  name: 'trang-2.jpg',
  mimeType: 'image/jpeg',
};

const renderDialog = (contract: ContractRecord) => {
  const onChanged = vi.fn();
  render(<ContractDetailDialog contract={contract} onClose={vi.fn()} onChanged={onChanged} />);
  return { onChanged };
};
const pick = (...files: File[]) =>
  fireEvent.change(screen.getByLabelText('Chọn file hợp đồng'), { target: { files } });
const file = (name: string, type: string, size = 100) =>
  new File([new Uint8Array(size)], name, { type });

describe('contract documents panel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists files and opens one through a fresh signed link', async () => {
    mockRole(UserRole.FACILITY_MANAGER);
    vi.spyOn(UploadsApi, 'downloadUrl').mockResolvedValue('https://signed.example.com/x');
    const open = vi.spyOn(window, 'open').mockReturnValue({ location: {} } as Window);
    renderDialog(contractRecord({ documents: [PDF, PHOTO] }));

    expect(screen.getByText('File hợp đồng (2)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'hop-dong.pdf' }));
    await waitFor(() => expect(UploadsApi.downloadUrl).toHaveBeenCalledWith(PDF.fileKey));
    expect(open).toHaveBeenCalled();
  });

  it('uploads new files one by one and saves the merged list', async () => {
    mockRole(UserRole.FACILITY_MANAGER);
    const uploaded: ContractDocument[] = [
      { fileKey: 'uploads/3-a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', size: 100 },
      { fileKey: 'uploads/4-b.pdf', name: 'b.pdf', mimeType: 'application/pdf', size: 100 },
    ];
    const upload = vi
      .spyOn(UploadsApi, 'upload')
      .mockResolvedValueOnce(uploaded[0])
      .mockResolvedValueOnce(uploaded[1]);
    const replace = vi.spyOn(ContractsApi, 'replaceDocuments').mockResolvedValue();
    const { onChanged } = renderDialog(contractRecord({ documents: [PDF] }));

    pick(file('a.jpg', 'image/jpeg'), file('b.pdf', 'application/pdf'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('c-1', [PDF, ...uploaded]));
    expect(upload).toHaveBeenCalledTimes(2);
    expect(onChanged).toHaveBeenCalled();
  });

  it.each([
    ['a text file', [file('notes.txt', 'text/plain')], /notes\.txt/],
    ['a 16 MB file', [file('big.pdf', 'application/pdf', 16 * 1024 * 1024)], /15 MB/],
  ])('rejects %s without calling the API', (_name, files, message) => {
    mockRole(UserRole.ADMIN);
    const upload = vi.spyOn(UploadsApi, 'upload');
    renderDialog(contractRecord());
    pick(...files);
    expect(screen.getByRole('alert').textContent).toMatch(message);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects a pick that would exceed ten files', () => {
    mockRole(UserRole.ADMIN);
    const upload = vi.spyOn(UploadsApi, 'upload');
    const nine = Array.from({ length: 9 }, (_, i) => ({ ...PHOTO, fileKey: `uploads/${i}-p.jpg` }));
    renderDialog(contractRecord({ documents: nine }));
    pick(file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg'));
    expect(screen.getByRole('alert').textContent).toMatch(/tối đa 10/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('keeps the old list and shows the reason when an upload fails', async () => {
    mockRole(UserRole.ADMIN);
    vi.spyOn(UploadsApi, 'upload').mockRejectedValue(new Error('Tải "a.jpg" lên thất bại (403).'));
    const replace = vi.spyOn(ContractsApi, 'replaceDocuments').mockResolvedValue();
    const { onChanged } = renderDialog(contractRecord({ documents: [PDF] }));

    pick(file('a.jpg', 'image/jpeg'));
    expect((await screen.findByRole('alert')).textContent).toContain('403');
    expect(replace).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText('File hợp đồng (1)')).toBeTruthy();
  });

  it('removes a file only after confirmation', async () => {
    mockRole(UserRole.OPERATIONS_MANAGER);
    const replace = vi.spyOn(ContractsApi, 'replaceDocuments').mockResolvedValue();
    renderDialog(contractRecord({ status: 'ACTIVE', documents: [PDF, PHOTO] }));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa file hop-dong.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa file hop-dong.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa file' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('c-1', [PHOTO]));
  });

  it('does not let an active contract lose its last file', () => {
    mockRole(UserRole.ADMIN);
    renderDialog(contractRecord({ status: 'ACTIVE', documents: [PDF] }));
    const remove = screen.getByRole('button', { name: 'Xóa file hop-dong.pdf' });
    expect((remove as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/phải có ít nhất 1 file/)).toBeTruthy();
  });

  it('lets a draft drop its last file', () => {
    mockRole(UserRole.ADMIN);
    renderDialog(contractRecord({ documents: [PDF] }));
    const remove = screen.getByRole('button', { name: 'Xóa file hop-dong.pdf' });
    expect((remove as HTMLButtonElement).disabled).toBe(false);
  });

  it('is view-only once the contract is ended', () => {
    mockRole(UserRole.ADMIN);
    renderDialog(contractRecord({ status: 'ENDED', documents: [PDF] }));
    expect(screen.getByRole('button', { name: 'hop-dong.pdf' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tải file lên' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa file hop-dong.pdf' })).toBeNull();
  });
});
