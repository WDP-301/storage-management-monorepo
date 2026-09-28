import { Badge, Button, LayerCard, Table, Text } from '@cloudflare/kumo';
import { UserRole, UserStatus } from '@storage/types';
import {
  Building2,
  CheckCircle,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_CONFIGS } from '../../lib/roles';

interface SystemUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

const INITIAL_USERS: SystemUser[] = [
  {
    id: 'usr-001',
    fullName: 'Lê Hoàng',
    email: 'admin@storage.vn',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    createdAt: '2026-01-15',
  },
  {
    id: 'usr-002',
    fullName: 'Trần Văn Vận Hành',
    email: 'ops@storage.vn',
    role: UserRole.OPERATIONS_MANAGER,
    status: UserStatus.ACTIVE,
    createdAt: '2026-02-01',
  },
  {
    id: 'usr-003',
    fullName: 'Phạm Thị Quản Lý Cơ Sở',
    email: 'manager@storage.vn',
    role: UserRole.FACILITY_MANAGER,
    status: UserStatus.ACTIVE,
    createdAt: '2026-02-10',
  },
  {
    id: 'usr-004',
    fullName: 'Nguyễn Văn Nhân Viên Kho',
    email: 'staff@storage.vn',
    role: UserRole.FACILITY_STAFF,
    status: UserStatus.ACTIVE,
    createdAt: '2026-02-18',
  },
  {
    id: 'usr-005',
    fullName: 'Hoàng Minh (Khách hàng VIP)',
    email: 'customer@storage.vn',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    createdAt: '2026-03-05',
  },
];

const AUDIT_LOGS = [
  {
    id: 'log-1',
    action: 'Phân quyền vai trò FACILITY_MANAGER',
    target: 'manager@storage.vn',
    timestamp: '10 phút trước',
    performer: 'admin@storage.vn',
  },
  {
    id: 'log-2',
    action: 'Cập nhật cấu hình bảo mật phiên (Session TTL)',
    target: 'System Settings',
    timestamp: '2 giờ trước',
    performer: 'admin@storage.vn',
  },
  {
    id: 'log-3',
    action: 'Kích hoạt tài khoản nhân viên mới',
    target: 'staff@storage.vn',
    timestamp: '1 ngày trước',
    performer: 'admin@storage.vn',
  },
];

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_USERS);
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  const toggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus =
            u.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
          setNotice(`Đã cập nhật trạng thái tài khoản ${u.email} sang: ${nextStatus}`);
          setTimeout(() => setNotice(null), 4000);
          return { ...u, status: nextStatus };
        }
        return u;
      }),
    );
  };

  const cycleUserRole = (userId: string) => {
    const roleKeys: UserRole[] = [
      UserRole.CUSTOMER,
      UserRole.FACILITY_STAFF,
      UserRole.FACILITY_MANAGER,
      UserRole.OPERATIONS_MANAGER,
      UserRole.ADMIN,
    ];
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentIndex = roleKeys.indexOf(u.role);
          const nextRole = roleKeys[(currentIndex + 1) % roleKeys.length];
          setNotice(`Đã chuyển vai trò của ${u.fullName} thành: ${ROLE_CONFIGS[nextRole].title}`);
          setTimeout(() => setNotice(null), 4000);
          return { ...u, role: nextRole };
        }
        return u;
      }),
    );
  };

  const filteredUsers = users.filter((u) => {
    if (filterRole === 'ALL') return true;
    return u.role === filterRole;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <Shield className="w-5 h-5" />
            </span>
            <Text as="h2">System administration</Text>
            <Badge variant="purple">Admin workspace</Badge>
          </div>
          <Text variant="secondary">
            Quản trị toàn diện người dùng, phân quyền các cấp, giám sát bảo mật và thiết lập hệ
            thống.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" appearance="dot">
            Phiên quản trị viên: {user?.email}
          </Badge>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-kumo-info-tint text-kumo-info rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tổng tài khoản</Text>
            <Users className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{users.length}</span>
            <Badge variant="neutral">Toàn hệ thống</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Cơ sở kho hoạt động</Text>
            <Building2 className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">6</span>
            <Badge variant="success">100% Online</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Vai trò quản trị & nhân sự</Text>
            <ShieldCheck className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">
              {users.filter((u) => u.role !== UserRole.CUSTOMER).length}
            </span>
            <Badge variant="purple">Internal staff</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tình trạng hệ thống</Text>
            <UserCheck className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">99.98%</span>
            <Badge variant="success">Ổn định</Badge>
          </div>
        </LayerCard>
      </div>

      {/* User & Role Management Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid gap-1">
            <Text as="h3" variant="heading">
              Phân quyền tài khoản người dùng
            </Text>
            <Text variant="secondary">
              Quản lý danh sách người dùng, chuyển đổi vai trò trực tiếp và kích hoạt/tạm khóa tài
              khoản.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <Text variant="secondary" size="xs">
              Lọc vai trò:
            </Text>
            <select
              aria-label="Lọc theo vai trò"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-8 text-xs px-2.5 rounded-md bg-kumo-base border border-kumo-line text-kumo-default"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
              <option value={UserRole.OPERATIONS_MANAGER}>Quản lý vận hành</option>
              <option value={UserRole.FACILITY_MANAGER}>Quản lý cơ sở</option>
              <option value={UserRole.FACILITY_STAFF}>Nhân viên cơ sở</option>
              <option value={UserRole.CUSTOMER}>Khách hàng</option>
            </select>
          </div>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Họ và tên</Table.Head>
                <Table.Head>Email tài khoản</Table.Head>
                <Table.Head>Vai trò hiện tại (Role)</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head>Ngày tạo</Table.Head>
                <Table.Head className="text-right">Hành động phân quyền</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredUsers.map((u) => {
                const config = ROLE_CONFIGS[u.role];
                return (
                  <Table.Row key={u.id}>
                    <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                      {u.fullName}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                      {u.email}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      <Badge variant={config.badgeVariant}>{config.title}</Badge>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      {u.status === UserStatus.ACTIVE ? (
                        <Badge variant="success" appearance="dot">
                          Đang hoạt động
                        </Badge>
                      ) : (
                        <Badge variant="error" appearance="dot">
                          Tạm khóa
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                      {u.createdAt}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                          onClick={() => cycleUserRole(u.id)}
                          title="Đổi vai trò người dùng"
                        >
                          Đổi vai trò
                        </Button>
                        <Button
                          variant={u.status === UserStatus.ACTIVE ? 'destructive' : 'primary'}
                          size="sm"
                          onClick={() => toggleUserStatus(u.id)}
                        >
                          {u.status === UserStatus.ACTIVE ? 'Khóa' : 'Kích hoạt'}
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>

      {/* Security & Audit Feed */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Nhật ký bảo mật & phân quyền gần đây
          </Text>
          <Text variant="secondary">
            Ghi nhận các hoạt động cấp quyền và thay đổi cấu hình bảo mật.
          </Text>
        </div>

        <LayerCard className="p-0 overflow-hidden ring ring-kumo-line">
          <div className="divide-y divide-kumo-line">
            {AUDIT_LOGS.map((log) => (
              <div key={log.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-kumo-brand" />
                  <div>
                    <Text as="strong" bold>
                      {log.action}
                    </Text>
                    <div>
                      <Text variant="secondary" size="xs">
                        Mục tiêu: {log.target} • Thực hiện bởi: {log.performer}
                      </Text>
                    </div>
                  </div>
                </div>
                <Badge variant="neutral">{log.timestamp}</Badge>
              </div>
            ))}
          </div>
        </LayerCard>
      </div>
    </div>
  );
};
