import { Badge, Button, Empty, LayerCard, Text } from '@cloudflare/kumo';
import {
  Buildings,
  CalendarCheck,
  CalendarX,
  CheckCircle,
  HandCoins,
  Lifebuoy,
  Money,
  Receipt,
  Rows,
  Stack,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react';
import { TourAppointmentStatus, UserRole } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import { AnalyticsApi, type FacilityKpis } from '../../lib/analytics-api';
import {
  type ApiError,
  ChangeRequestsApi,
  type UnitChangeRequestRecord,
  WarehousesApi,
} from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import type { Warehouse } from '../../types/warehouse';
import { ShelfManagementDialog } from '../warehouses/ShelfManagementDialog';
import { WarehouseOverviewMap } from '../warehouses/WarehouseOverviewMap';
import { isShelfWarehouse } from '../warehouses/warehouse-display';
import { ChangeRequestsTable } from './manager/ChangeRequestsTable';
import { MaintenanceToggleButton } from './manager/MaintenanceToggleButton';
import { ManagedWarehousesTable } from './manager/ManagedWarehousesTable';

const KpiCard: React.FC<{
  label: string;
  value: number | string;
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
  const apiErr = err as ApiError | undefined;
  const status = apiErr?.status;
  const details = apiErr?.details;
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu. Danh sách đã được làm mới.';
  if (status === 409) {
    if (Array.isArray(details?.shelfIds) && details.shelfIds.length > 0) {
      return `Kho kệ đang có ${details.shelfIds.length} kệ đang được thuê hoặc giữ chỗ nên không thể báo bảo trì. Danh sách đã được làm mới.`;
    }
    return 'Dữ liệu đã thay đổi hoặc đã được xử lý. Danh sách đã được làm mới.';
  }
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
  const [pendingTours, setPendingTours] = useState(0);
  const [kpis, setKpis] = useState<FacilityKpis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [managingShelves, setManagingShelves] = useState<Warehouse | null>(null);
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
        setKpis(null);
        setIsLoading(false);
        return;
      }
      if (showSpinner) setIsLoading(true);
      try {
        const [list, requestsData, toursData, kpisData] = await Promise.all([
          fetchWarehouses(),
          ChangeRequestsApi.list(),
          TourAppointmentsApi.list({
            facilityId: facilityId || undefined,
            status: TourAppointmentStatus.PENDING,
            limit: 1,
          }).catch(() => ({
            appointments: [],
            meta: { total: 0, page: 1, limit: 1, totalPages: 0 },
          })),
          AnalyticsApi.facilityKpis(facilityId || undefined).catch(() => null),
        ]);
        if (request !== latestRequest.current) return;
        setPendingTours(toursData.meta?.total || 0);
        setKpis(kpisData);
        // Requests may touch the facility on either side — the old unit's or the held target's.
        const facilityIds = new Set(list.map((w) => w.facility.id));
        setWarehouses(list);
        setRequests(
          requestsData.requests.filter((r) => {
            const ids = [r.facility_id, r.new_unit?.facility_id].filter(Boolean);
            return facilityId
              ? ids.includes(facilityId)
              : isAdmin || ids.some((id) => facilityIds.has(id as string));
          }),
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

  const handleDecision = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    options?: { moveAt?: string; decisionNote?: string },
  ) => {
    setBusyId(requestId);
    try {
      const { request } = await ChangeRequestsApi.decide(requestId, decision, options);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? request : r)));
      toast.info(
        'Xử lý yêu cầu',
        decision === 'APPROVED'
          ? 'Đã duyệt — kho đích được giữ chỗ đến ngày chuyển.'
          : 'Đã từ chối yêu cầu đổi kho.',
      );
      if (decision === 'APPROVED') await load(false);
    } catch (err) {
      toast.error('Không xử lý được yêu cầu', describeActionError(err));
      await load(false);
    } finally {
      setBusyId(null);
    }
  };

  const handleChangeAction = async (
    requestId: string,
    action: 'start' | 'complete' | 'cancel',
    done: string,
  ) => {
    setBusyId(requestId);
    try {
      const { request } = await ChangeRequestsApi[action](requestId);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? request : r)));
      toast.info('Cập nhật đổi kho', done);
      if (action !== 'start') await load(false);
    } catch (err) {
      toast.error('Không cập nhật được', describeActionError(err));
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
              ? 'Chưa được gán chi nhánh'
              : 'Chi nhánh chưa có kho'
        }
        description={
          isAdmin
            ? 'Chưa có kho nào trong phạm vi đã chọn. Vui lòng thêm kho mới.'
            : waitingForFacility
              ? 'Tài khoản của bạn chưa được gán phụ trách chi nhánh nào. Liên hệ quản trị viên để được cấp quyền.'
              : 'Chi nhánh này chưa có kho nào. Liên hệ quản trị viên để thêm kho.'
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Kho của chi nhánh
          </Text>
          <Text variant="secondary">
            {selectedFacility ? `${selectedFacility.name}: ` : 'Tất cả chi nhánh: '}
            theo dõi kho, trạng thái bảo trì, sơ đồ kệ và duyệt yêu cầu đổi kho của khách hàng.
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<CalendarCheck className="w-4 h-4" />}
            onClick={() => navigate('/facility-manager/tour-appointments')}
          >
            Lịch xem kho {pendingTours > 0 ? `(${pendingTours})` : ''}
          </Button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
        <Link className="cursor-pointer" to="/facility-manager/tour-appointments?status=PENDING">
          <KpiCard
            label="Lịch xem kho chờ xử lý"
            value={pendingTours}
            icon={<CalendarCheck className="w-4 h-4 text-kumo-warning" />}
            badge={
              <Badge variant={pendingTours > 0 ? 'warning' : 'neutral'}>
                {pendingTours > 0 ? 'Cần liên hệ' : 'Đã xử lý hết'}
              </Badge>
            }
          />
        </Link>
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

      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={`Doanh thu tháng ${kpis.revenue.month}`}
            value={`${kpis.revenue.received.toLocaleString('vi-VN')}₫`}
            icon={<Money className="w-4 h-4 text-kumo-success" />}
            badge={<Badge variant="success">Đã thu trên hóa đơn</Badge>}
          />
          <KpiCard
            label="Hóa đơn quá hạn"
            value={kpis.receivables.overdue_invoice_count}
            icon={<Receipt className="w-4 h-4 text-kumo-warning" />}
            badge={
              <Badge variant={kpis.receivables.overdue_invoice_count > 0 ? 'warning' : 'neutral'}>
                {kpis.receivables.overdue_invoice_count > 0
                  ? `Còn thiếu ${kpis.receivables.overdue_due.toLocaleString('vi-VN')}₫`
                  : 'Không có nợ'}
              </Badge>
            }
          />
          <KpiCard
            label="Hoàn cọc đang treo"
            value={kpis.refunds.pending_count}
            icon={<HandCoins className="w-4 h-4 text-kumo-warning" />}
            badge={
              <Badge variant={kpis.refunds.pending_count > 0 ? 'warning' : 'neutral'}>
                {kpis.refunds.pending_count > 0
                  ? `Phải trả ${kpis.refunds.pending_amount.toLocaleString('vi-VN')}₫`
                  : 'Không nợ khách'}
              </Badge>
            }
          />
          <KpiCard
            label="Hợp đồng hết hạn trong 30 ngày"
            value={kpis.contracts.expiring_within_30_days}
            icon={<CalendarX className="w-4 h-4 text-kumo-brand" />}
            badge={<Badge variant="neutral">{kpis.contracts.active} hợp đồng đang hiệu lực</Badge>}
          />
        </div>
      )}

      <ChangeRequestsTable
        requests={requests}
        busyId={busyId}
        onDecide={handleDecision}
        onStart={(id) => void handleChangeAction(id, 'start', 'Đã bắt đầu chuyển kho.')}
        onComplete={(id) =>
          void handleChangeAction(id, 'complete', 'Đã hoàn tất — hợp đồng chuyển sang kho mới.')
        }
        onCancel={(id) =>
          void handleChangeAction(id, 'cancel', 'Đã thu hồi — kho giữ chỗ được giải phóng.')
        }
      />

      <ManagedWarehousesTable
        warehouses={filtered}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        busyId={busyId}
        onToggleMaintenance={toggleMaintenance}
        onManageShelves={(w) => navigate(`/admin/warehouses/${w.id}`)}
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
                  <div className="flex items-center gap-2">
                    {isShelfWarehouse(w) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Rows className="h-3.5 w-3.5" />}
                        onClick={() => navigate(`/admin/warehouses/${w.id}`)}
                      >
                        Kệ & Sơ đồ
                      </Button>
                    )}
                    <MaintenanceToggleButton
                      warehouse={w}
                      busy={busyId === w.id}
                      onToggle={toggleMaintenance}
                    />
                  </div>
                )}
              />
            </div>
          )
        }
      />

      <ShelfManagementDialog
        warehouse={managingShelves}
        canManageShelves={isAdmin}
        onClose={() => setManagingShelves(null)}
        onChanged={() => void load(false)}
      />
    </div>
  );
};
