import { Badge, Button, Empty, LayerCard, Text } from '@cloudflare/kumo';
import {
  Buildings,
  CheckCircle,
  Lifebuoy,
  Stack,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChangeRequestsApi, type UnitChangeRequestRecord, WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { Warehouse } from '../../types/warehouse';
import { ChangeRequestsTable } from './manager/ChangeRequestsTable';
import { ManagedWarehousesTable } from './manager/ManagedWarehousesTable';

const KpiCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  badge: React.ReactNode;
}> = ({ label, value, icon, badge }) => (
  <LayerCard className="px-5 py-4 ring ring-kumo-line">
    <div className="flex items-center justify-between">
      <Text variant="secondary">{label}</Text>
      {icon}
    </div>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-2xl font-semibold text-kumo-default">{value}</span>
      {badge}
    </div>
  </LayerCard>
);

export const FacilityManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useAppToast();
  const { user, activeRole } = useAuth();
  const isAdmin = (activeRole ?? user?.roles?.[0]) === UserRole.ADMIN;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [requests, setRequests] = useState<UnitChangeRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchWarehouses = useCallback(
    async () =>
      isAdmin
        ? (await WarehousesApi.listAdmin({ limit: 100 })).warehouses
        : WarehousesApi.listMine(),
    [isAdmin],
  );

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchWarehouses(), ChangeRequestsApi.list()])
      .then(([list, requestsData]) => {
        // Requests are scoped to the caller's warehouses; admins see every request.
        const ids = new Set(list.map((w) => w.id));
        setWarehouses(list);
        setRequests(
          isAdmin
            ? requestsData.requests
            : requestsData.requests.filter((r) => r.facility_id && ids.has(r.facility_id)),
        );
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [fetchWarehouses, isAdmin]);

  const toggleMaintenance = async (w: Warehouse) => {
    const next = w.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setBusyId(w.id);
    try {
      const updated = await WarehousesApi.updateStatus(w.id, next);
      setWarehouses((prev) => prev.map((x) => (x.id === w.id ? updated : x)));
      toast.info(
        'Cập nhật trạng thái kho',
        `Đã cập nhật kho ${w.code} thành: ${next === 'MAINTENANCE' ? 'Đang bảo trì' : 'Sẵn sàng thuê'}`,
      );
    } catch (err) {
      toast.error(
        'Không cập nhật được trạng thái kho',
        err instanceof Error ? err.message : 'Vui lòng thử lại.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusyId(requestId);
    try {
      const { request } = await ChangeRequestsApi.decide(requestId, decision);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? request : r)));
      if (decision === 'APPROVED') setWarehouses(await fetchWarehouses());
      toast.info(
        'Xử lý yêu cầu',
        decision === 'APPROVED' ? 'Đã phê duyệt yêu cầu đổi kho.' : 'Đã từ chối yêu cầu đổi kho.',
      );
    } catch (err) {
      toast.error(
        'Không xử lý được yêu cầu',
        err instanceof Error ? err.message : 'Vui lòng thử lại.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return warehouses.filter(
      (w) =>
        (statusFilter === 'ALL' || w.status === statusFilter) &&
        (term === '' || w.code.toLowerCase().includes(term) || w.name.toLowerCase().includes(term)),
    );
  }, [warehouses, searchTerm, statusFilter]);

  const count = (...s: Warehouse['status'][]) =>
    warehouses.filter((w) => s.includes(w.status)).length;
  const occupied = count('RENTED', 'BOOKED', 'HELD', 'PENDING_INSPECTION');
  const occupancy =
    warehouses.length > 0 ? ((occupied / warehouses.length) * 100).toFixed(1) : '0.0';
  const pendingRequests = requests.filter((r) => r.status === 'REQUESTED').length;

  if (isLoading) {
    return <Text variant="secondary">Đang tải danh sách kho...</Text>;
  }

  if (!error && warehouses.length === 0) {
    return (
      <Empty
        icon={<Buildings className="w-8 h-8" />}
        title={isAdmin ? 'Chưa có kho nào' : 'Chưa được gán kho'}
        description={
          isAdmin
            ? 'Hệ thống chưa có kho nào. Vui lòng thêm kho mới.'
            : 'Tài khoản của bạn chưa được gán quản lý kho nào. Liên hệ quản trị viên để được cấp quyền.'
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Quản lý cơ sở kho
          </Text>
          <Text variant="secondary">
            Theo dõi kho phụ trách, trạng thái bảo trì và duyệt yêu cầu đổi kho của khách hàng.
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<Lifebuoy className="w-4 h-4" />}
            onClick={() => navigate('/facility-manager/tickets')}
          >
            Vé sự cố & Phân công
          </Button>
          <Badge variant="neutral" appearance="dot">
            {user?.fullName}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center gap-2">
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Kho đang cho thuê"
          value={occupied}
          icon={<Stack className="w-4 h-4 text-kumo-success" />}
          badge={<Badge variant="success">{occupancy}% lấp đầy</Badge>}
        />
        <KpiCard
          label="Kho sẵn sàng trống"
          value={count('AVAILABLE')}
          icon={<CheckCircle className="w-4 h-4 text-kumo-brand" />}
          badge={<Badge variant="primary">Có thể thuê ngay</Badge>}
        />
        <KpiCard
          label="Yêu cầu đổi kho chờ duyệt"
          value={pendingRequests}
          icon={<WarningCircle className="w-4 h-4 text-kumo-warning" />}
          badge={<Badge variant="warning">Cần xử lý</Badge>}
        />
        <KpiCard
          label="Đang bảo trì / ngừng"
          value={count('MAINTENANCE', 'INACTIVE')}
          icon={<Wrench className="w-4 h-4 text-kumo-danger" />}
          badge={<Badge variant="neutral">Kho bảo dưỡng</Badge>}
        />
      </div>

      <ChangeRequestsTable requests={requests} busyId={busyId} onDecide={handleDecision} />

      <ManagedWarehousesTable
        warehouses={filtered}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        busyId={busyId}
        onToggleMaintenance={toggleMaintenance}
      />
    </div>
  );
};
