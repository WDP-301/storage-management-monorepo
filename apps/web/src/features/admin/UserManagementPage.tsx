import {
  Badge,
  Button,
  Dialog,
  InputGroup,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  Eye,
  MagnifyingGlass,
  ShieldCheck,
  Trash,
  User,
  UserCheck,
  UserGear,
  UserPlus,
  Users,
  Warehouse,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { UserRole, UserStatus } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminUsersApi, FacilitiesApi, type FacilityRecord } from '../../lib/api';
import { getRoleTitle } from '../../lib/roles';
import { useAppToast } from '../../lib/toast';
import type { AdminRoleAssignment, AdminUser } from '../../types/admin-user';

const PAGE_SIZE = 20;

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'Hoạt động',
  [UserStatus.SUSPENDED]: 'Tạm ngưng',
  [UserStatus.DISABLED]: 'Vô hiệu hóa',
};

const getStatusBadge = (status: UserStatus) => {
  switch (status) {
    case UserStatus.ACTIVE:
      return (
        <Badge variant="success" appearance="dot">
          {USER_STATUS_LABELS[status]}
        </Badge>
      );
    case UserStatus.SUSPENDED:
      return (
        <Badge variant="warning" appearance="dot">
          {USER_STATUS_LABELS[status]}
        </Badge>
      );
    case UserStatus.DISABLED:
      return (
        <Badge variant="error" appearance="dot">
          {USER_STATUS_LABELS[status]}
        </Badge>
      );
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

const getRoleBadge = (role: UserRole) => {
  switch (role) {
    case UserRole.ADMIN:
      return <Badge variant="neutral">{getRoleTitle(role)}</Badge>;
    case UserRole.OPERATIONS_MANAGER:
      return <Badge variant="info">{getRoleTitle(role)}</Badge>;
    case UserRole.FACILITY_MANAGER:
      return <Badge variant="warning">{getRoleTitle(role)}</Badge>;
    case UserRole.FACILITY_STAFF:
      return <Badge variant="secondary">{getRoleTitle(role)}</Badge>;
    case UserRole.CUSTOMER:
      return <Badge variant="neutral">{getRoleTitle(role)}</Badge>;
    default:
      return <Badge variant="neutral">{role}</Badge>;
  }
};

/** Format ISO date into Vietnamese locale */
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const UserManagementPage: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const toast = useAppToast();

  // State: Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);

  // State: Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // State: Selected user for detail & role management modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isRefreshingDetail, setIsRefreshingDetail] = useState(false);

  // State: Status update inside modal
  const [editStatus, setEditStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // State: Assign role form inside modal
  const [newRole, setNewRole] = useState<UserRole>(UserRole.FACILITY_STAFF);
  const [newFacilityId, setNewFacilityId] = useState<string>('');
  const [newStartsAt, setNewStartsAt] = useState<string>('');
  const [newEndsAt, setNewEndsAt] = useState<string>('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);

  // State: Revoke role confirmation
  const [assignmentToRevoke, setAssignmentToRevoke] = useState<AdminRoleAssignment | null>(null);
  const [isRevokingRole, setIsRevokingRole] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load facilities for role assignment dropdown
  useEffect(() => {
    FacilitiesApi.listAll()
      .then((data) => setFacilities(data || []))
      .catch((err) => {
        console.error('Failed to load facilities for user management:', err);
      });
  }, []);

  // Fetch users list from backend
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await AdminUsersApi.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as UserStatus) : undefined,
        role: roleFilter !== 'ALL' ? (roleFilter as UserRole) : undefined,
      });

      setUsers(res.users);
      setTotalUsers(res.meta.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách người dùng.';
      toast.error('Lỗi tải dữ liệu', msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, roleFilter, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Reload single user details to keep modal data fresh
  const refreshSelectedUser = useCallback(
    async (userId: string) => {
      setIsRefreshingDetail(true);
      try {
        const freshUser = await AdminUsersApi.getById(userId);
        setSelectedUser(freshUser);
        setEditStatus(freshUser.status);
        // Also sync list in background
        setUsers((prev) => prev.map((u) => (u.id === freshUser.id ? freshUser : u)));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Không thể tải chi tiết người dùng.';
        toast.error('Lỗi tải dữ liệu', msg);
      } finally {
        setIsRefreshingDetail(false);
      }
    },
    [toast],
  );

  // Handle open detail modal
  const handleOpenDetail = (user: AdminUser) => {
    setSelectedUser(user);
    setEditStatus(user.status);
    setNewRole(UserRole.FACILITY_STAFF);
    setNewFacilityId(facilities[0]?.id || '');
    setNewStartsAt('');
    setNewEndsAt('');
    // Refresh to get full assignments
    refreshSelectedUser(user.id);
  };

  // Handle Update Status
  const handleSaveStatus = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentAdmin?.id && editStatus !== UserStatus.ACTIVE) {
      toast.warning(
        'Thao tác không được phép',
        'Hệ thống không cho phép tự khóa hoặc đình chỉ tài khoản quản trị viên của chính bạn.',
      );
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const updated = await AdminUsersApi.updateStatus(selectedUser.id, editStatus);
      setSelectedUser(updated);
      setEditStatus(updated.status);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(
        'Cập nhật thành công',
        `Trạng thái tài khoản "${updated.fullName}" đã chuyển sang ${USER_STATUS_LABELS[updated.status]}.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại.';
      toast.error('Lỗi cập nhật trạng thái', msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Check if role requires facilityId
  const roleRequiresFacility =
    newRole === UserRole.FACILITY_STAFF || newRole === UserRole.FACILITY_MANAGER;

  // Handle Assign Role
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (roleRequiresFacility && !newFacilityId) {
      toast.warning(
        'Thiếu thông tin cơ sở',
        `Vai trò ${getRoleTitle(newRole)} bắt buộc phải chọn cơ sở kho cụ thể.`,
      );
      return;
    }

    if (newStartsAt && newEndsAt && new Date(newEndsAt) <= new Date(newStartsAt)) {
      toast.warning(
        'Khoảng thời gian không hợp lệ',
        'Thời gian kết thúc phải sau thời gian bắt đầu hiệu lực.',
      );
      return;
    }

    setIsAssigningRole(true);
    try {
      const updated = await AdminUsersApi.assignRole(selectedUser.id, {
        role: newRole,
        facilityId: roleRequiresFacility ? newFacilityId : undefined,
        startsAt: newStartsAt ? new Date(newStartsAt).toISOString() : undefined,
        endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : undefined,
      });

      setSelectedUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNewStartsAt('');
      setNewEndsAt('');
      toast.success(
        'Gán vai trò thành công',
        `Đã cấp vai trò "${getRoleTitle(newRole)}" cho người dùng ${updated.fullName}.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gán vai trò thất bại.';
      toast.error('Lỗi gán vai trò', msg);
    } finally {
      setIsAssigningRole(false);
    }
  };

  // Handle Revoke Role
  const handleConfirmRevoke = async () => {
    if (!selectedUser || !assignmentToRevoke) return;

    setIsRevokingRole(true);
    try {
      await AdminUsersApi.revokeRole(selectedUser.id, assignmentToRevoke.id);
      toast.success(
        'Thu hồi vai trò thành công',
        `Đã thu hồi vai trò "${getRoleTitle(assignmentToRevoke.role)}" khỏi người dùng.`,
      );
      setAssignmentToRevoke(null);
      // Reload user details
      await refreshSelectedUser(selectedUser.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thu hồi vai trò thất bại.';
      toast.error('Lỗi thu hồi vai trò', msg);
    } finally {
      setIsRevokingRole(false);
    }
  };

  // Helper map for facility names
  const facilityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of facilities) {
      map.set(f.id, `${f.name} (${f.code})`);
    }
    return map;
  }, [facilities]);

  // Derived counts for overview cards
  const activeCount = useMemo(
    () => users.filter((u) => u.status === UserStatus.ACTIVE).length,
    [users],
  );
  const suspendedCount = useMemo(
    () => users.filter((u) => u.status === UserStatus.SUSPENDED).length,
    [users],
  );
  const disabledCount = useMemo(
    () => users.filter((u) => u.status === UserStatus.DISABLED).length,
    [users],
  );
  const staffCount = useMemo(
    () => users.filter((u) => u.roles.some((r) => r.role !== UserRole.CUSTOMER)).length,
    [users],
  );

  // Status options for Filter Select
  const statusFilterOptions = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: UserStatus.ACTIVE, label: 'Hoạt động' },
    { value: UserStatus.SUSPENDED, label: 'Tạm ngưng' },
    { value: UserStatus.DISABLED, label: 'Vô hiệu hóa' },
  ];

  // Role options for Filter Select
  const roleFilterOptions = [
    { value: 'ALL', label: 'Tất cả vai trò' },
    { value: UserRole.ADMIN, label: 'Quản trị viên' },
    { value: UserRole.OPERATIONS_MANAGER, label: 'Quản lý vận hành' },
    { value: UserRole.FACILITY_MANAGER, label: 'Quản lý cơ sở' },
    { value: UserRole.FACILITY_STAFF, label: 'Nhân viên cơ sở' },
    { value: UserRole.CUSTOMER, label: 'Khách hàng' },
  ];

  // Role options for Assign Role Dialog
  const assignRoleOptions = [
    { value: UserRole.FACILITY_STAFF, label: 'Nhân viên cơ sở (Cần chọn kho)' },
    { value: UserRole.FACILITY_MANAGER, label: 'Quản lý cơ sở (Cần chọn kho)' },
    { value: UserRole.OPERATIONS_MANAGER, label: 'Quản lý vận hành (Toàn cục)' },
    { value: UserRole.ADMIN, label: 'Quản trị viên hệ thống (Toàn cục)' },
    { value: UserRole.CUSTOMER, label: 'Khách hàng (Toàn cục)' },
  ];

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'ALL' || roleFilter !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Quản lý người dùng
          </Text>
          <Text variant="secondary">
            Xem danh sách tài khoản, điều chỉnh trạng thái hoạt động và phân quyền vai trò cho nhân
            sự trong hệ thống.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className="w-4 h-4" />}
            onClick={() => loadUsers()}
            loading={isLoading}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tổng số tài khoản</Text>
            <Users className="w-4 h-4 text-kumo-subtle" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{totalUsers}</span>
            <span className="text-xs text-kumo-subtle">người dùng</span>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đang hoạt động (trang này)</Text>
            <CheckCircle className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{activeCount}</span>
            <Badge variant="success" appearance="dot">
              Bình thường
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tạm ngưng / Vô hiệu hóa</Text>
            <WarningCircle className="w-4 h-4 text-kumo-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">
              {suspendedCount + disabledCount}
            </span>
            <Badge variant="warning" appearance="dot">
              Cần chú ý
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Nhân sự & Quản trị</Text>
            <ShieldCheck className="w-4 h-4 text-kumo-info" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{staffCount}</span>
            <span className="text-xs text-kumo-subtle">có vai trò nội bộ</span>
          </div>
        </LayerCard>
      </div>

      {/* Filter and Search Bar */}
      <LayerCard className="px-5 py-4 ring ring-kumo-line">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="w-full sm:w-80">
              <InputGroup size="base">
                <InputGroup.Addon align="start">
                  <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
                </InputGroup.Addon>
                <InputGroup.Input
                  type="text"
                  placeholder="Tìm theo tên, email, SĐT..."
                  aria-label="Tìm kiếm người dùng"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </div>

            {/* Status Select */}
            <div className="w-full sm:w-48">
              <Select
                aria-label="Lọc trạng thái tài khoản"
                value={statusFilter}
                onValueChange={(val) => {
                  if (val) {
                    setStatusFilter(String(val));
                    setPage(1);
                  }
                }}
                items={statusFilterOptions}
                renderValue={(v) =>
                  statusFilterOptions.find((o) => o.value === v)?.label ?? String(v)
                }
              />
            </div>

            {/* Role Select */}
            <div className="w-full sm:w-48">
              <Select
                aria-label="Lọc vai trò người dùng"
                value={roleFilter}
                onValueChange={(val) => {
                  if (val) {
                    setRoleFilter(String(val));
                    setPage(1);
                  }
                }}
                items={roleFilterOptions}
                renderValue={(v) =>
                  roleFilterOptions.find((o) => o.value === v)?.label ?? String(v)
                }
              />
            </div>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="w-4 h-4" />}
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setRoleFilter('ALL');
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </LayerCard>

      {/* Users Table */}
      <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Người dùng</Table.Head>
              <Table.Head>Số điện thoại</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head>Vai trò nắm giữ</Table.Head>
              <Table.Head>Ngày đăng ký</Table.Head>
              <Table.Head className="text-right">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {users.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-12 text-kumo-subtle">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-kumo-subtle opacity-50" />
                    <Text variant="secondary">
                      {hasActiveFilters
                        ? 'Không tìm thấy người dùng nào phù hợp với bộ lọc.'
                        : 'Chưa có người dùng nào trong hệ thống.'}
                    </Text>
                  </div>
                </Table.Cell>
              </Table.Row>
            ) : (
              users.map((user) => {
                const isCurrentUser = user.id === currentAdmin?.id;

                return (
                  <Table.Row key={user.id}>
                    {/* User Info */}
                    <Table.Cell className="whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-kumo-fill ring ring-kumo-line flex items-center justify-center text-xs font-semibold text-kumo-default shrink-0">
                          {user.fullName?.charAt(0).toUpperCase() || (
                            <User className="w-4 h-4 text-kumo-subtle" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs text-kumo-default truncate max-w-[200px]">
                              {user.fullName}
                            </span>
                            {isCurrentUser && <Badge variant="neutral">Bạn</Badge>}
                          </div>
                          <div className="text-[11px] text-kumo-subtle truncate max-w-[220px]">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </Table.Cell>

                    {/* Phone */}
                    <Table.Cell className="whitespace-nowrap">
                      <span className="text-xs text-kumo-default">
                        {user.phone ? (
                          <span className="font-mono">{user.phone}</span>
                        ) : (
                          <span className="text-kumo-subtle italic">Chưa có</span>
                        )}
                      </span>
                    </Table.Cell>

                    {/* Status */}
                    <Table.Cell className="whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </Table.Cell>

                    {/* Roles Badges */}
                    <Table.Cell className="min-w-[200px]">
                      {user.roles && user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {user.roles.map((assignment) => {
                            const facilityName = assignment.facilityId
                              ? facilityNameMap.get(assignment.facilityId) || 'Cơ sở'
                              : null;

                            return (
                              <div
                                key={assignment.id}
                                className="inline-flex items-center gap-1"
                                title={
                                  facilityName ? `Cơ sở: ${facilityName}` : 'Phạm vi toàn hệ thống'
                                }
                              >
                                {getRoleBadge(assignment.role)}
                                {facilityName && (
                                  <span className="text-[10px] text-kumo-subtle font-mono">
                                    ({facilityName.split(' ')[0]})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-kumo-subtle italic">Chưa gán vai trò</span>
                      )}
                    </Table.Cell>

                    {/* Registration Date */}
                    <Table.Cell className="whitespace-nowrap">
                      <span className="text-xs text-kumo-subtle">{formatDate(user.createdAt)}</span>
                    </Table.Cell>

                    {/* Actions */}
                    <Table.Cell className="whitespace-nowrap text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenDetail(user)}
                      >
                        Chi tiết & Quyền
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </LayerCard>

      {/* Pagination */}
      {totalUsers > 0 && (
        <div className="pt-2 border-t border-kumo-line">
          <Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={totalUsers}>
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        </div>
      )}

      {/* Modal 1: User Detail & Role Management Dialog */}
      <Dialog.Root
        open={Boolean(selectedUser)}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <Dialog
          size="xl"
          className="p-6 sm:p-7 max-w-2xl sm:w-[680px] w-full max-h-[90vh] overflow-y-auto"
        >
          {selectedUser && (
            <div className="space-y-6">
              {/* Dialog Header */}
              <div className="flex items-center justify-between border-b border-kumo-line pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-kumo-fill text-kumo-default flex items-center justify-center shrink-0">
                    <UserGear className="w-5 h-5 text-kumo-brand" />
                  </div>
                  <div>
                    <Dialog.Title className="text-base font-semibold text-kumo-default">
                      Hồ sơ & Phân quyền tài khoản
                    </Dialog.Title>
                    <div className="text-xs">
                      <Text variant="secondary">
                        Mã ID:{' '}
                        <span className="font-mono text-kumo-default">{selectedUser.id}</span>
                      </Text>
                    </div>
                  </div>
                </div>
                <Dialog.Close
                  render={(props) => (
                    <button
                      type="button"
                      {...props}
                      className="p-1.5 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-control cursor-pointer transition"
                      aria-label="Đóng"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                />
              </div>

              {/* User Overview Profile Box */}
              <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-kumo-default">
                      {selectedUser.fullName}
                    </div>
                    <div className="text-xs text-kumo-subtle mt-0.5">{selectedUser.email}</div>
                  </div>
                  <div>{getStatusBadge(selectedUser.status)}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-kumo-line text-xs">
                  <div>
                    <span className="text-kumo-subtle">Điện thoại:</span>{' '}
                    <span className="font-mono text-kumo-default">
                      {selectedUser.phone || 'Chưa cập nhật'}
                    </span>
                  </div>
                  <div>
                    <span className="text-kumo-subtle">Ngày tạo:</span>{' '}
                    <span className="text-kumo-default">{formatDate(selectedUser.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-kumo-subtle">Xác thực email:</span>{' '}
                    <span className="text-kumo-default">
                      {selectedUser.emailVerifiedAt ? 'Đã xác thực' : 'Chưa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Update Account Status */}
              <div className="space-y-3 border-b border-kumo-line pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-kumo-default">
                      Trạng thái tài khoản
                    </span>
                    <div className="text-xs text-kumo-subtle">
                      Đình chỉ hoặc vô hiệu hóa sẽ lập tức hủy bỏ các phiên làm việc đang hoạt động.
                    </div>
                  </div>
                </div>

                {selectedUser.id === currentAdmin?.id && (
                  <div className="p-3 bg-kumo-warning-tint text-kumo-warning rounded-lg text-xs flex items-center gap-2">
                    <WarningCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Bạn đang quản lý tài khoản của chính mình. Hệ thống bảo mật cấm tự khóa tài
                      khoản của bản thân.
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="w-full sm:w-56">
                    <Select
                      aria-label="Chọn trạng thái mới"
                      value={editStatus}
                      onValueChange={(val) => val && setEditStatus(val as UserStatus)}
                      items={[
                        { value: UserStatus.ACTIVE, label: 'Hoạt động (ACTIVE)' },
                        { value: UserStatus.SUSPENDED, label: 'Tạm ngưng (SUSPENDED)' },
                        { value: UserStatus.DISABLED, label: 'Vô hiệu hóa (DISABLED)' },
                      ]}
                      disabled={selectedUser.id === currentAdmin?.id}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="base"
                    onClick={handleSaveStatus}
                    loading={isUpdatingStatus}
                    disabled={
                      editStatus === selectedUser.status || selectedUser.id === currentAdmin?.id
                    }
                  >
                    Lưu trạng thái
                  </Button>
                </div>
              </div>

              {/* Section 2: Active Role Assignments */}
              <div className="space-y-3 border-b border-kumo-line pb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-kumo-default">
                    Danh sách vai trò hiện tại ({selectedUser.roles?.length || 0})
                  </span>
                  {isRefreshingDetail && (
                    <span className="text-xs text-kumo-subtle flex items-center gap-1">
                      <ArrowsClockwise className="w-3 h-3 animate-spin" /> Đang cập nhật...
                    </span>
                  )}
                </div>

                {selectedUser.roles && selectedUser.roles.length > 0 ? (
                  <div className="space-y-2">
                    {selectedUser.roles.map((assignment) => {
                      const facilityName = assignment.facilityId
                        ? facilityNameMap.get(assignment.facilityId) || assignment.facilityId
                        : null;

                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-kumo-control ring ring-kumo-line text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getRoleBadge(assignment.role)}
                              {facilityName ? (
                                <span className="font-medium text-kumo-default flex items-center gap-1">
                                  <Warehouse className="w-3.5 h-3.5 text-kumo-brand" />
                                  {facilityName}
                                </span>
                              ) : (
                                <span className="text-kumo-subtle">Toàn hệ thống</span>
                              )}
                            </div>
                            <div className="text-[11px] text-kumo-subtle flex items-center gap-2">
                              <span>Hiệu lực: {formatDate(assignment.startsAt)}</span>
                              <span>→</span>
                              <span>
                                {assignment.endsAt
                                  ? formatDate(assignment.endsAt)
                                  : 'Không thời hạn'}
                              </span>
                            </div>
                          </div>

                          <Button
                            variant="destructive"
                            size="sm"
                            icon={<Trash className="w-3.5 h-3.5" />}
                            onClick={() => setAssignmentToRevoke(assignment)}
                            aria-label={`Thu hồi vai trò ${getRoleTitle(assignment.role)}`}
                            title="Thu hồi vai trò"
                          >
                            Thu hồi
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-kumo-subtle bg-kumo-control rounded-lg ring ring-kumo-line">
                    Người dùng này chưa được gán vai trò nào.
                  </div>
                )}
              </div>

              {/* Section 3: Grant New Role Form */}
              <form onSubmit={handleAssignRole} className="space-y-4">
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-kumo-default flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-kumo-brand" />
                    Cấp thêm vai trò mới cho người dùng
                  </span>
                  <Text variant="secondary" size="xs">
                    Nhân viên cơ sở hoặc Quản lý cơ sở bắt buộc phải được gắn với một kho cụ thể.
                  </Text>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Role */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="select-role"
                      className="block text-xs font-medium text-kumo-default"
                    >
                      Chọn vai trò
                    </label>
                    <Select
                      id="select-role"
                      aria-label="Chọn vai trò mới"
                      value={newRole}
                      onValueChange={(val) => val && setNewRole(val as UserRole)}
                      items={assignRoleOptions}
                    />
                  </div>

                  {/* Select Facility (if facility-scoped role) */}
                  {roleRequiresFacility ? (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="select-facility"
                        className="block text-xs font-medium text-kumo-default"
                      >
                        Cơ sở phụ trách <span className="text-kumo-danger">*</span>
                      </label>
                      <Select
                        id="select-facility"
                        aria-label="Chọn cơ sở phụ trách"
                        value={newFacilityId}
                        onValueChange={(val) => val && setNewFacilityId(String(val))}
                        items={facilities.map((f) => ({
                          value: f.id,
                          label: `${f.name} (${f.code})`,
                        }))}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-kumo-subtle">
                        Phạm vi áp dụng
                      </span>
                      <div className="h-9 px-3 flex items-center bg-kumo-control rounded-md text-xs text-kumo-subtle">
                        Toàn hệ thống (Không gắn với cơ sở riêng)
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional startsAt and endsAt dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="input-starts-at"
                      className="block text-xs font-medium text-kumo-default"
                    >
                      Ngày bắt đầu hiệu lực (Tùy chọn)
                    </label>
                    <input
                      id="input-starts-at"
                      type="date"
                      aria-label="Ngày bắt đầu hiệu lực"
                      value={newStartsAt}
                      onChange={(e) => setNewStartsAt(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-kumo-line bg-kumo-base text-xs text-kumo-default focus:outline-none focus:ring-1 focus:ring-kumo-focus"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="input-ends-at"
                      className="block text-xs font-medium text-kumo-default"
                    >
                      Ngày kết thúc hiệu lực (Tùy chọn)
                    </label>
                    <input
                      id="input-ends-at"
                      type="date"
                      aria-label="Ngày kết thúc hiệu lực"
                      value={newEndsAt}
                      onChange={(e) => setNewEndsAt(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-kumo-line bg-kumo-base text-xs text-kumo-default focus:outline-none focus:ring-1 focus:ring-kumo-focus"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<UserCheck className="w-4 h-4" />}
                    loading={isAssigningRole}
                  >
                    Xác nhận gán vai trò
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Dialog>
      </Dialog.Root>

      {/* Modal 2: Confirm Revoke Role Dialog */}
      <Dialog.Root
        open={Boolean(assignmentToRevoke)}
        onOpenChange={(open) => !open && setAssignmentToRevoke(null)}
      >
        <Dialog size="base" className="p-6 max-w-md w-full">
          {assignmentToRevoke && selectedUser && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 text-kumo-danger">
                <div className="w-10 h-10 rounded-full bg-kumo-danger-tint flex items-center justify-center shrink-0">
                  <WarningCircle className="w-6 h-6 text-kumo-danger" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-kumo-default">
                    Thu hồi vai trò người dùng
                  </Dialog.Title>
                  <div className="text-xs">
                    <Text variant="secondary">Hành động này sẽ xóa quyền hạn ngay lập tức</Text>
                  </div>
                </div>
              </div>

              <div className="text-xs text-kumo-default space-y-2">
                <p>
                  Bạn có chắc chắn muốn thu hồi vai trò{' '}
                  <span className="font-semibold">{getRoleTitle(assignmentToRevoke.role)}</span> của
                  người dùng <span className="font-semibold">{selectedUser.fullName}</span> không?
                </p>
                {assignmentToRevoke.facilityId && (
                  <p className="text-kumo-subtle">
                    Cơ sở ảnh hưởng:{' '}
                    {facilityNameMap.get(assignmentToRevoke.facilityId) ||
                      assignmentToRevoke.facilityId}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-kumo-line">
                <Button
                  variant="secondary"
                  onClick={() => setAssignmentToRevoke(null)}
                  disabled={isRevokingRole}
                >
                  Hủy bỏ
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmRevoke}
                  loading={isRevokingRole}
                >
                  Xác nhận thu hồi
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
