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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import {
  type ApiError,
  ChangeRequestsApi,
  type UnitChangeRequestRecord,
  WarehousesApi,
} from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { Warehouse } from '../../types/warehouse';
import { WarehouseOverviewMap } from '../warehouses/WarehouseOverviewMap';
import { ChangeRequestsTable } from './manager/ChangeRequestsTable';
import { MaintenanceToggleButton } from './manager/MaintenanceToggleButton';
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

/** Vietnamese reason for a failed manager action; the list is refreshed afterwards. */
const describeActionError = (err: unknown): string => {
  const status = (err as ApiError | undefined)?.status;
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu. Danh sách đã được làm mới.';
  if (status === 409) return 'Dữ liệu đã thay đổi hoặc đã được xử lý. Danh sách đã được làm mới.';
  return 'Không thể thực hiện thao tác. Danh sách đã được làm mới, vui lòng thử lại.';
};

export const FacilityManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useAppToast();
  const { user, activeRole } = useAuth();
  const { selectedFacility, isLoading: facilityLoading } = useFacility();
  const isAdmin = (activeRole ?? user?.roles?.[0]) === UserRole.ADMIN;
  const facilityId = selectedFacility?.id;
  // A manager always works inside one facility; wait for the picker instead of fetching all.
  const waitingForFacility = !isAdmin && !facilityId;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [requests, setRequests] = useState<UnitChangeRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  // Once opened, the map stays mounted (hidden in list view) so toggling does not reload it.
  const [mapOpened, setMapOpened] = useState(false);
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(null);

  // Switching facility rebuilds the map; an old focus must not pull the camera back.
  useEffect(() => {
    setFocusedWarehouseId(null);
  }, [facilityId]);
  const latestRequest = useRef(0);

  const fetchWarehouses = useCallback(
    async () =>
      isAdmin ? WarehousesApi.listAdminAll({ facilityId }) : WarehousesApi.listMine({ facilityId }),
    [isAdmin, facilityId],
  );

  /** Reloads warehouses and change requests; stale responses from a previous facility are dropped. */
  const load = useCallback(
    async (showSpinner: boolean) => {
      const request = ++latestRequest.current;
      if (waitingForFacility) {
        setWarehouses([]);
        setRequests([]);
        setIsLoading(false);
        return;
      }
      if (showSpinner) setIsLoading(true);
      try {
        const [list, requestsData] = await Promise.all([
          fetchWarehouses(),
          ChangeRequestsApi.list(),
        ]);
        if (request !== latestRequest.current) return;
        // Requests belong to the facility of the warehouse being left.
        const facilityIds = new Set(list.map((w) => w.facility.id));
        setWarehouses(list);
        setRequests(
          requestsData.requests.filter((r) =>
            facilityId
              ? r.facility_id === facilityId
              : isAdmin || (r.facility_id !== null && facilityIds.has(r.facility_id)),
          ),
        );
        setError(null);
      } catch (err) {
        if (request === latestRequest.current) {
          setError(err instanceof Error ? err.message : 'Không tải được dữ liệu.');
        }
      } finally {
        if (request === latestRequest.current) setIsLoading(false);
      }
    },
    [fetchWarehouses, waitingForFacility, facilityId, isAdmin],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const toggleMaintenance = async (w: Warehouse) => {
    const next = w.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setBusyId(w.id);
    try {
      const updated = await WarehousesApi.updateStatus(w.id, next);
      setWarehouses((prev) => prev.map((x) => (x.id === w.id ? updated : x)));
      // A status filter can now exclude the warehouse; say why it vanished from the list/map.
      const hidden = statusFilter !== 'ALL' && statusFilter !== updated.status;
      toast.info(
        'Cập nhật trạng thái kho',
        `Đã cập nhật kho ${w.code} thành: ${next === 'MAINTENANCE' ? 'Đang bảo trì' : 'Sẵn sàng thuê'}${hidden ? '. Kho không còn khớp bộ lọc trạng thái nên đã được ẩn.' : ''}`,
      );
    } catch (err) {
      toast.error('Không cập nhật được trạng thái kho', describeActionError(err));
      await load(false);
    } finally {
      setBusyId(null);
    }
  };

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusyId(requestId);
    try {
      const { request } = await ChangeRequestsApi.decide(requestId, decision);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? request : r)));
      toast.info(
        'Xử lý yêu cầu',
        decision === 'APPROVED' ? 'Đã phê duyệt yêu cầu đổi kho.' : 'Đã từ chối yêu cầu đổi kho.',
      );
      if (decision === 'APPROVED') await load(false);
    } catch (err) {
      toast.error('Không xử lý được yêu cầu', describeActionError(err));
      await load(false);
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

  const changeView = (next: 'list' | 'map') => {
    // Clearing the focus lets the same warehouse be focused again from the table.
    setFocusedWarehouseId(null);
    if (next === 'map') setMapOpened(true);
    setView(next);
  };

  const viewOnMap = (w: Warehouse) => {
    setFocusedWarehouseId(w.id);
    setMapOpened(true);
    setView('map');
  };

  const count = (...s: Warehouse['status'][]) =>
    warehouses.filter((w) => s.includes(w.status)).length;
  const occupied = count('RENTED', 'BOOKED', 'HELD', 'PENDING_INSPECTION');
  const occupancy =
    warehouses.length > 0 ? ((occupied / warehouses.length) * 100).toFixed(1) : '0.0';
  const pendingRequests = requests.filter((r) => r.status === 'REQUESTED').length;

  if (isLoading || (waitingForFacility && facilityLoading)) {
    return <Text variant="secondary">Đang tải danh sách kho...</Text>;
  }

  if (waitingForFacility || (!error && warehouses.length === 0)) {
    return (
      <Empty
        icon={<Buildings className="w-8 h-8" />}
        title={
          isAdmin
            ? 'Chưa có kho nào'
            : waitingForFacility
              ? 'Chưa được gán cơ sở'
              : 'Cơ sở chưa có kho'
        }
        description={
          isAdmin
            ? 'Chưa có kho nào trong phạm vi đã chọn. Vui lòng thêm kho mới.'
            : waitingForFacility
              ? 'Tài khoản của bạn chưa được gán phụ trách cơ sở nào. Liên hệ quản trị viên để được cấp quyền.'
              : 'Cơ sở này chưa có kho nào. Liên hệ quản trị viên để thêm kho.'
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Kho của cơ sở
          </Text>
          <Text variant="secondary">
            {selectedFacility ? `${selectedFacility.name}: ` : 'Tất cả cơ sở: '}
            theo dõi kho, trạng thái bảo trì và duyệt yêu cầu đổi kho của khách hàng.
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
        view={view}
        onViewChange={changeView}
        onViewMap={viewOnMap}
        mapPanel={
          mapOpened && (
            <div hidden={view !== 'map'}>
              <WarehouseOverviewMap
                warehouses={filtered}
                visible={view === 'map'}
                focusedWarehouseId={focusedWarehouseId}
                renderActions={(w) => (
                  <MaintenanceToggleButton
                    warehouse={w}
                    busy={busyId === w.id}
                    onToggle={toggleMaintenance}
                  />
                )}
              />
            </div>
          )
        }
      />
    </div>
  );
};
