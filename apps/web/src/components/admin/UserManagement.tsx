import { Badge, Button, Input, Table, Text } from '@cloudflare/kumo';
import { CheckCircle, Envelope, Lock, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import React, { useState } from 'react';

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  assignedFacility: string;
  status: 'ACTIVE' | 'LOCKED';
  lastLogin: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<MockUser[]>([
    {
      id: 'usr-01',
      name: 'Nguyễn Quốc Bảo',
      email: 'bao.nguyen@storagehub.vn',
      role: 'FACILITY_MANAGER',
      roleLabel: 'Trưởng cơ sở Sala',
      assignedFacility: 'StorageHub Sala Mega Center',
      status: 'ACTIVE',
      lastLogin: '2026-09-22 08:30 (IP: 118.69.182.45)',
    },
    {
      id: 'usr-02',
      name: 'Trần Minh Tâm',
      email: 'tam.tran@storagehub.vn',
      role: 'OPERATIONS_MANAGER',
      roleLabel: 'Giám đốc Vận hành',
      assignedFacility: 'Toàn bộ chi nhánh',
      status: 'ACTIVE',
      lastLogin: '2026-09-22 08:15 (IP: 14.161.22.10)',
    },
    {
      id: 'usr-03',
      name: 'Lê Minh Quân',
      email: 'quan.le@storagehub.vn',
      role: 'FACILITY_STAFF',
      roleLabel: 'Nhân viên lễ tân',
      assignedFacility: 'StorageHub Sala Mega Center',
      status: 'ACTIVE',
      lastLogin: '2026-09-22 06:55 (IP: 172.16.10.4)',
    },
    {
      id: 'usr-04',
      name: 'Trần Đình Trọng',
      email: 'trong.tran@storagehub.vn',
      role: 'FACILITY_MANAGER',
      roleLabel: 'Trưởng cơ sở Times City',
      assignedFacility: 'StorageHub Times City Park',
      status: 'ACTIVE',
      lastLogin: '2026-09-21 17:40 (IP: 113.190.234.12)',
    },
    {
      id: 'usr-05',
      name: 'Lý Kiến Quốc (Cựu nhân viên)',
      email: 'kienquoc.old@storagehub.vn',
      role: 'FACILITY_STAFF',
      roleLabel: 'Nhân viên kho cũ',
      assignedFacility: 'Không gán',
      status: 'LOCKED',
      lastLogin: '2026-08-10 11:20 (Đã khóa tài khoản)',
    },
  ]);

  const [search, setSearch] = useState('');

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' } : u,
      ),
    );
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.assignedFacility.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Quản trị người dùng & tài khoản
          </Text>
          <Text variant="secondary" size="sm">
            Tài khoản nhân sự, phân quyền cơ sở và trạng thái truy cập
          </Text>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus />}
          onClick={() => alert('Mở form tạo tài khoản nhân sự mới.')}
        >
          Tạo tài khoản mới
        </Button>
      </div>

      {/* Search */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4">
        <div className="relative">
          <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-kumo-placeholder z-10" />
          <Input
            aria-label="Tìm nhân sự"
            placeholder="Tìm theo tên nhân sự, email hoặc cơ sở phụ trách..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Người dùng</Table.Head>
                <Table.Head>Vai trò hệ thống</Table.Head>
                <Table.Head>Cơ sở phụ trách</Table.Head>
                <Table.Head>Đăng nhập lần cuối</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Khóa / Mở</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((user) => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <div>
                      <p className="font-semibold text-kumo-strong">{user.name}</p>
                      <p className="text-xs text-kumo-subtle flex items-center gap-1 mt-0.5">
                        <Envelope className="w-3 h-3" />
                        {user.email}
                      </p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      variant={
                        user.role === 'ADMIN'
                          ? 'purple'
                          : user.role === 'OPERATIONS_MANAGER'
                            ? 'primary'
                            : 'neutral'
                      }
                    >
                      {user.roleLabel}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="font-medium">{user.assignedFacility}</Table.Cell>
                  <Table.Cell className="font-mono text-xs text-kumo-subtle">
                    {user.lastLogin}
                  </Table.Cell>
                  <Table.Cell>
                    {user.status === 'ACTIVE' ? (
                      <Badge variant="success" icon={<CheckCircle />}>
                        Hoạt động
                      </Badge>
                    ) : (
                      <Badge variant="error" icon={<Lock />}>
                        Đã khóa
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button
                      variant={user.status === 'ACTIVE' ? 'destructive' : 'secondary'}
                      size="xs"
                      onClick={() => toggleUserStatus(user.id)}
                    >
                      {user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>
    </div>
  );
};
