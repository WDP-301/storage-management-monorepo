import { UserRole, UserStatus } from '@storage/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../../context/AuthContext';
import { AdminUsersApi, FacilitiesApi } from '../../lib/api';
import type { AdminUser } from '../../types/admin-user';
import type { AuthUser } from '../../types/auth';
import { UserManagementPage } from './UserManagementPage';

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

const MOCK_ADMIN_USER: AuthUser = {
  id: 'admin-1',
  email: 'admin@storage.vn',
  fullName: 'Quản Trị Viên Chính',
  phone: '0901234567',
  status: UserStatus.ACTIVE,
  roles: [UserRole.ADMIN],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_USERS_LIST: AdminUser[] = [
  {
    id: 'admin-1',
    email: 'admin@storage.vn',
    fullName: 'Quản Trị Viên Chính',
    phone: '0901234567',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    roles: [
      {
        id: 'ura-1',
        role: UserRole.ADMIN,
        facilityId: null,
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: null,
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'staff.tanbinh@storage.vn',
    fullName: 'Lê Văn Nhân Viên',
    phone: '0987654321',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: '2026-01-02T00:00:00.000Z',
    roles: [
      {
        id: 'ura-2',
        role: UserRole.FACILITY_STAFF,
        facilityId: 'fac-tb',
        startsAt: '2026-01-02T00:00:00.000Z',
        endsAt: null,
      },
    ],
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'user-3',
    email: 'customer@gmail.com',
    fullName: 'Nguyễn Thị Khách',
    phone: null,
    status: UserStatus.SUSPENDED,
    emailVerifiedAt: null,
    roles: [
      {
        id: 'ura-3',
        role: UserRole.CUSTOMER,
        facilityId: null,
        startsAt: '2026-01-03T00:00:00.000Z',
        endsAt: null,
      },
    ],
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
];

const MOCK_FACILITIES = [
  {
    id: 'fac-tb',
    code: 'TB-01',
    name: 'Kho Tân Bình',
    provinceCode: '79',
    status: 'ACTIVE',
  },
  {
    id: 'fac-q7',
    code: 'Q7-01',
    name: 'Kho Quận 7',
    provinceCode: '79',
    status: 'ACTIVE',
  },
];

describe('UserManagementPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: MOCK_ADMIN_USER,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(FacilitiesApi, 'listAll').mockResolvedValue(MOCK_FACILITIES);

    vi.spyOn(AdminUsersApi, 'list').mockResolvedValue({
      users: MOCK_USERS_LIST,
      meta: {
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      },
    });

    vi.spyOn(AdminUsersApi, 'getById').mockImplementation(async (id: string) => {
      const found = MOCK_USERS_LIST.find((u) => u.id === id);
      if (!found) throw new Error('Not found');
      return found;
    });

    vi.spyOn(AdminUsersApi, 'updateStatus').mockImplementation(
      async (id: string, status: UserStatus) => {
        const found = MOCK_USERS_LIST.find((u) => u.id === id);
        return { ...(found || MOCK_USERS_LIST[0]), status };
      },
    );

    vi.spyOn(AdminUsersApi, 'assignRole').mockImplementation(async (id: string, dto) => {
      const found = MOCK_USERS_LIST.find((u) => u.id === id) ?? MOCK_USERS_LIST[0];
      return {
        ...found,
        roles: [
          ...found.roles,
          {
            id: 'ura-new',
            role: dto.role,
            facilityId: dto.facilityId ?? null,
            startsAt: dto.startsAt ?? new Date(),
            endsAt: dto.endsAt ?? null,
          },
        ],
      };
    });

    vi.spyOn(AdminUsersApi, 'revokeRole').mockResolvedValue(true);
  });

  it('renders page header, metrics row, search bar and users table', async () => {
    render(<UserManagementPage />);

    expect(screen.getByText('Quản lý người dùng')).toBeTruthy();
    expect(screen.getByText('Tổng số tài khoản')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tìm theo tên, email, SĐT...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Quản Trị Viên Chính')).toBeTruthy();
      expect(screen.getByText('Lê Văn Nhân Viên')).toBeTruthy();
      expect(screen.getByText('Nguyễn Thị Khách')).toBeTruthy();
    });

    // Verify status badges
    expect(screen.getAllByText('Hoạt động').length).toBeGreaterThan(0);
    expect(screen.getByText('Tạm ngưng')).toBeTruthy();

    // Verify self admin badge
    expect(screen.getByText('Bạn')).toBeTruthy();
  });

  it('opens user detail dialog with profile and role assignments', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Lê Văn Nhân Viên')).toBeTruthy();
    });

    const detailButtons = screen.getAllByRole('button', { name: /chi tiết & quyền/i });
    fireEvent.click(detailButtons[1]); // Second user: Lê Văn Nhân Viên

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ & Phân quyền tài khoản')).toBeTruthy();
      expect(screen.getByText(/user-2/)).toBeTruthy();
      expect(screen.getAllByText('staff.tanbinh@storage.vn').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Danh sách vai trò hiện tại (1)')).toBeTruthy();
    });
  });

  it('prevents logged-in admin from suspending their own account', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Quản Trị Viên Chính')).toBeTruthy();
    });

    const detailButtons = screen.getAllByRole('button', { name: /chi tiết & quyền/i });
    fireEvent.click(detailButtons[0]); // First user: logged-in admin

    await waitFor(() => {
      expect(screen.getByText(/admin-1/)).toBeTruthy();
    });

    // Alert message about self account
    expect(screen.getByText(/Bạn đang quản lý tài khoản của chính mình/i)).toBeTruthy();

    // Status select and Save button should be disabled for self
    const saveButton = screen.getByRole('button', { name: /lưu trạng thái/i });
    expect(saveButton.hasAttribute('disabled')).toBe(true);
  });

  it('allows updating status for other users', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Lê Văn Nhân Viên')).toBeTruthy();
    });

    const detailButtons = screen.getAllByRole('button', { name: /chi tiết & quyền/i });
    fireEvent.click(detailButtons[1]); // Second user: Lê Văn Nhân Viên

    await waitFor(() => {
      expect(screen.getByText(/user-2/)).toBeTruthy();
    });

    // Select new status
    const statusSelect = screen.getByRole('combobox', { name: /chọn trạng thái mới/i });
    fireEvent.click(statusSelect);

    const suspendedOption = await screen.findByRole('option', { name: /tạm ngưng \(suspended\)/i });
    fireEvent.pointerDown(suspendedOption);
    fireEvent.pointerUp(suspendedOption);
    fireEvent.click(suspendedOption);

    const saveButton = screen.getByRole('button', { name: /lưu trạng thái/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(AdminUsersApi.updateStatus).toHaveBeenCalledWith('user-2', UserStatus.SUSPENDED);
    });
  });

  it('triggers role revocation modal and confirms deletion', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Lê Văn Nhân Viên')).toBeTruthy();
    });

    const detailButtons = screen.getAllByRole('button', { name: /chi tiết & quyền/i });
    fireEvent.click(detailButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Danh sách vai trò hiện tại (1)')).toBeTruthy();
    });

    // Click revoke button for the assigned role
    const revokeButton = screen.getByRole('button', { name: /thu hồi/i });
    fireEvent.click(revokeButton);

    // Revocation confirm dialog
    await waitFor(() => {
      expect(screen.getByText('Thu hồi vai trò người dùng')).toBeTruthy();
      expect(screen.getByText(/Bạn có chắc chắn muốn thu hồi vai trò/i)).toBeTruthy();
    });

    // Confirm revocation
    const confirmButton = screen.getByRole('button', { name: /xác nhận thu hồi/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(AdminUsersApi.revokeRole).toHaveBeenCalledWith('user-2', 'ura-2');
    });
  });
});
