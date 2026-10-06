import { TicketPriority, TicketStatus } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import { TicketsApi } from '../../lib/api';
import type { ServiceTicketRecord, TicketUserInfo } from '../../types/service-tickets';
import { ManagerTicketsPage } from './ManagerTicketsPage';

vi.mock('../../lib/toast', () => ({
  useAppToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    notifyCreated: vi.fn(),
    notifyUpdated: vi.fn(),
    notifyDeleted: vi.fn(),
  }),
}));

const TEST_STAFF: TicketUserInfo[] = [
  {
    id: 'staff-tuannv',
    full_name: 'Nguyễn Văn Tuấn',
    email: 'tuan@example.com',
  },
];

const TEST_TICKETS: ServiceTicketRecord[] = [
  {
    id: 't-1',
    ticket_no: 'TK-2026-0001',
    facility_id: 'fac-1',
    type_id: 'type-1',
    type: null,
    storage_unit_id: 'u-1',
    customer_id: 'c-1',
    subject: 'Hỏng khóa thông minh kho A-102',
    description: 'Khóa không phản hồi khi quét thẻ từ',
    priority: TicketPriority.HIGH,
    status: TicketStatus.OPEN,
    assigned_to: null,
    storage_unit: {
      id: 'u-1',
      code: 'A-102',
    },
    facility: {
      id: 'fac-1',
      code: 'TB-01',
      name: 'Kho Tân Bình',
    },
    customer: {
      id: 'c-1',
      full_name: 'Trần Văn Khách',
      email: 'khach@example.com',
    },
    resolution: null,
    resolved_at: null,
    attachments: [],
    assignee: null,
    history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 't-2',
    ticket_no: 'TK-2026-0002',
    facility_id: 'fac-1',
    type_id: 'type-1',
    type: null,
    storage_unit_id: 'u-2',
    customer_id: 'c-1',
    subject: 'Bảo trì bóng đèn kho B-201',
    description: 'Đèn chập chờn',
    priority: TicketPriority.NORMAL,
    status: TicketStatus.ASSIGNED,
    assigned_to: 'staff-tuannv',
    storage_unit: {
      id: 'u-2',
      code: 'B-201',
    },
    facility: {
      id: 'fac-1',
      code: 'TB-01',
      name: 'Kho Tân Bình',
    },
    customer: {
      id: 'c-1',
      full_name: 'Trần Văn Khách',
      email: 'khach@example.com',
    },
    resolution: null,
    resolved_at: null,
    attachments: [],
    assignee: TEST_STAFF[0],
    history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('ManagerTicketsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'mgr-1',
        email: 'manager@example.com',
        fullName: 'Nguyễn Quản Lý',
        status: 'ACTIVE',
        roles: ['FACILITY_MANAGER'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(TicketsApi, 'getAll').mockResolvedValue({
      tickets: TEST_TICKETS,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    });
    vi.spyOn(TicketsApi, 'getOne').mockImplementation(async (id) => {
      return TEST_TICKETS.find((t) => t.id === id) || TEST_TICKETS[0];
    });
    vi.spyOn(TicketsApi, 'assign').mockResolvedValue({
      ...TEST_TICKETS[0],
      assigned_to: 'staff-tuannv',
      status: TicketStatus.ASSIGNED,
      assignee: TEST_STAFF[0],
    });
    vi.spyOn(TicketsApi, 'remove').mockResolvedValue({ deleted: true, id: 't-1' });
  });

  it('renders page header and metric cards', async () => {
    render(<ManagerTicketsPage />);

    expect(screen.getByText('Quản lý sự cố & Phiếu dịch vụ')).toBeTruthy();
    expect(screen.getByText('Tổng số phiếu sự cố')).toBeTruthy();
    expect(screen.getByText('Chờ phân công')).toBeTruthy();
    expect(screen.getByText('Đang tiến hành xử lý')).toBeTruthy();
    expect(screen.getByText('Đã xử lý dứt điểm')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('TK-2026-0001')).toBeTruthy();
    });
  });

  it('filters tickets when typing in the search box', async () => {
    render(<ManagerTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TK-2026-0001')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Tìm mã vé, sự cố, khách...');
    fireEvent.change(searchInput, { target: { value: 'A-102' } });

    expect(screen.getByText('A-102')).toBeTruthy();
  });

  it('opens details dialog when clicking Chi tiết', async () => {
    render(<ManagerTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TK-2026-0001')).toBeTruthy();
    });

    const detailButtons = screen.getAllByRole('button', { name: /chi tiết/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    expect(await screen.findByText('Chi tiết phiếu sự cố dịch vụ')).toBeTruthy();
    expect(await screen.findByText('Nội dung mô tả sự cố:')).toBeTruthy();
    expect(TicketsApi.getOne).toHaveBeenCalledWith('t-1');
  });

  it('opens assign dialog and allows assigning staff', async () => {
    render(<ManagerTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TK-2026-0001')).toBeTruthy();
    });

    const assignButtons = screen.getAllByRole('button', { name: /phân công/i });
    expect(assignButtons.length).toBeGreaterThan(0);
    fireEvent.click(assignButtons[0]);

    expect(await screen.findByText('Phân công kỹ thuật viên phụ trách')).toBeTruthy();

    const select = await screen.findByLabelText(/Chọn nhân viên tiếp nhận ca trực/i);
    fireEvent.change(select, { target: { value: 'staff-tuannv' } });

    const confirmBtn = screen.getByRole('button', { name: /xác nhận phân công/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đã phân công vé/i)).toBeTruthy();
    });
  });

  it('opens delete confirmation dialog and deletes ticket on confirm', async () => {
    const removeSpy = vi
      .spyOn(TicketsApi, 'remove')
      .mockResolvedValue({ deleted: true, id: 't-1' });
    render(<ManagerTicketsPage />);

    await waitFor(() => {
      expect(screen.getByText('TK-2026-0001')).toBeTruthy();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /xóa/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);

    expect(await screen.findByText('Xác nhận xóa phiếu sự cố')).toBeTruthy();
    expect(
      screen.getByText(/Bạn có chắc chắn muốn xóa vĩnh viễn phiếu sự cố này không/i),
    ).toBeTruthy();

    const confirmDeleteBtn = screen.getByRole('button', { name: /xác nhận xóa/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đã xóa phiếu sự cố/i)).toBeTruthy();
    });
    expect(removeSpy).toHaveBeenCalled();
  });
});
