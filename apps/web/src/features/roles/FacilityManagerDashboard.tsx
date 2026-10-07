import {
  Badge,
  Button,
  Empty,
  InputGroup,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import {
  Buildings,
  CheckCircle,
  Lifebuoy,
  MagnifyingGlass,
  Stack,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import {
  ChangeRequestsApi,
  type ManagedUnit,
  type UnitChangeRequestRecord,
  UnitsApi,
} from '../../lib/api';
import { useAppToast } from '../../lib/toast';

const UNITS_PAGE_SIZE = 20;

const formatVnd = (value: number | string) => `${Number(value).toLocaleString('vi-VN')} đ/tháng`;
const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const UNIT_STATUS_LABEL: Record<
  ManagedUnit['status'],
  { label: string; variant: 'success' | 'primary' | 'error' | 'warning' | 'neutral' }
> = {
  AVAILABLE: { label: 'Sẵn sàng', variant: 'success' },
  HELD: { label: 'Đang giữ chỗ', variant: 'warning' },
  BOOKED: { label: 'Đã đặt', variant: 'primary' },
  RENTED: { label: 'Đang thuê', variant: 'primary' },
  PENDING_INSPECTION: { label: 'Chờ kiểm tra', variant: 'warning' },
  MAINTENANCE: { label: 'Đang bảo trì', variant: 'error' },
  INACTIVE: { label: 'Ngưng dùng', variant: 'neutral' },
};

const REQUEST_STATUS_LABEL: Record<
  UnitChangeRequestRecord['status'],
  { label: string; variant: 'success' | 'primary' | 'error' | 'warning' | 'neutral' }
> = {
  REQUESTED: { label: 'Chờ duyệt', variant: 'warning' },
  PROPOSED: { label: 'Đề xuất', variant: 'primary' },
  APPROVED: { label: 'Đã duyệt', variant: 'success' },
  TRANSITIONING: { label: 'Đang chuyển', variant: 'primary' },
  COMPLETED: { label: 'Hoàn tất', variant: 'success' },
  REJECTED: { label: 'Từ chối', variant: 'error' },
  CANCELLED: { label: 'Đã hủy', variant: 'neutral' },
};

export const FacilityManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { facilities, selectedFacility, isLoading: facilitiesLoading } = useFacility();
  const selectedFacilityId = selectedFacility?.id;
  const [units, setUnits] = useState<ManagedUnit[]>([]);
  const [unitsMeta, setUnitsMeta] = useState<{ page: number; limit: number; total: number } | null>(
    null,
  );
  const [kpiUnits, setKpiUnits] = useState<ManagedUnit[]>([]);
  const [requests, setRequests] = useState<UnitChangeRequestRecord[]>([]);
  const toast = useAppToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [unitsPage, setUnitsPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadFacilityData = useCallback(async (facilityId: string, page: number, status: string) => {
    const [unitsData, requestsData] = await Promise.all([
      UnitsApi.managed(facilityId, {
        page,
        limit: UNITS_PAGE_SIZE,
        ...(status !== 'ALL' ? { status: status as ManagedUnit['status'] } : {}),
      }),
      ChangeRequestsApi.list(),
    ]);
    // ponytail: requests fetch limit=50 then filter client-side — silent
    // truncation past 50 open items; upgrade path = facilityId param on the list API.
    setUnits(unitsData.units);
    setUnitsMeta(unitsData.meta);
    setRequests(requestsData.requests.filter((r) => r.facility_id === facilityId));
  }, []);

  useEffect(() => {
    if (!selectedFacilityId) return;
    setIsLoading(true);
    loadFacilityData(selectedFacilityId, unitsPage, statusFilter)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [selectedFacilityId, unitsPage, statusFilter, loadFacilityData]);

  // KPI snapshot — status-agnostic, capped at 100 (same ceiling as the old unpaged fetch).
  const refreshKpi = useCallback(() => {
    if (!selectedFacilityId) return;
    UnitsApi.managed(selectedFacilityId, { limit: 100 })
      .then((d) => setKpiUnits(d.units))
      .catch(() => setKpiUnits([]));
  }, [selectedFacilityId]);

  useEffect(() => {
    setUnitsPage(1);
    refreshKpi();
  }, [refreshKpi]);

  const toggleMaintenance = async (unit: ManagedUnit) => {
    const next = unit.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setBusyId(unit.id);
    try {
      await UnitsApi.updateStatus(unit.id, next);
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, status: next } : u)));
      refreshKpi();
      toast.info(
        'Cập nhật trạng thái kho',
        `Đã cập nhật kho ${unit.code} thành: ${next === 'MAINTENANCE' ? 'Đang bảo trì' : 'Sẵn sàng thuê'}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái kho');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusyId(requestId);
    try {
      const { request } = await ChangeRequestsApi.decide(requestId, decision);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? request : r)));
      if (decision === 'APPROVED' && selectedFacilityId) {
        const unitsData = await UnitsApi.managed(selectedFacilityId, {
          page: unitsPage,
          limit: UNITS_PAGE_SIZE,
        });
        setUnits(unitsData.units);
        setUnitsMeta(unitsData.meta);
        refreshKpi();
      }
      toast.info(
        'Xử lý yêu cầu',
        decision === 'APPROVED' ? 'Đã phê duyệt yêu cầu đổi kho.' : 'Đã từ chối yêu cầu đổi kho.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xử lý được yêu cầu');
    } finally {
      setBusyId(null);
    }
  };

  // Status is filtered server-side; search stays client-side on the current page.
  const filteredUnits = units.filter(
    (u) =>
      u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.unitType.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const rentedCount = kpiUnits.filter((u) => u.status === 'RENTED').length;
  const availableCount = kpiUnits.filter((u) => u.status === 'AVAILABLE').length;
  const maintenanceCount = kpiUnits.filter((u) => u.status === 'MAINTENANCE').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'REQUESTED').length;
  const occupancy =
    kpiUnits.length > 0 ? ((rentedCount / kpiUnits.length) * 100).toFixed(1) : '0.0';

  if (facilitiesLoading || (isLoading && facilities.length === 0)) {
    return <Text variant="secondary">Đang tải danh sách cơ sở...</Text>;
  }

  if (facilities.length === 0) {
    return (
      <Empty
        icon={<Buildings className="w-8 h-8" />}
        title="Chưa được gán cơ sở"
        description="Tài khoản của bạn chưa được gán quản lý cơ sở nào. Liên hệ quản trị viên để được cấp quyền."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Text as="h1" variant="heading" size="lg">
              Quản lý cơ sở kho
            </Text>
            {selectedFacility && (
              <Badge variant="neutral">{`${selectedFacility.name} (${selectedFacility.code})`}</Badge>
            )}
          </div>
          <Text variant="secondary">
            Quản lý danh mục các ô kho, trạng thái bảo trì, duyệt yêu cầu chuyển kho của khách hàng.
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Kho đang cho thuê</Text>
            <Stack className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{rentedCount}</span>
            <Badge variant="success">{occupancy}% lấp đầy</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Kho sẵn sàng trống</Text>
            <CheckCircle className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{availableCount}</span>
            <Badge variant="primary">Có thể thuê ngay</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Yêu cầu đổi kho chờ duyệt</Text>
            <WarningCircle className="w-4 h-4 text-kumo-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{pendingRequestsCount}</span>
            <Badge variant="warning">Cần xử lý</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đang bảo trì / Sửa chữa</Text>
            <Wrench className="w-4 h-4 text-kumo-danger" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{maintenanceCount}</span>
            <Badge variant="neutral">Kho bảo dưỡng</Badge>
          </div>
        </LayerCard>
      </div>

      {/* Customer Change Requests Approval Queue */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Yêu cầu nâng cấp & đổi kho từ khách hàng
          </Text>
          <Text variant="secondary">
            Phê duyệt hoặc từ chối đơn chuyển đổi đơn vị kho của người thuê.
          </Text>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Khách hàng</Table.Head>
                <Table.Head>Kho hiện tại</Table.Head>
                <Table.Head>Kho muốn chuyển đến</Table.Head>
                <Table.Head>Chênh lệch</Table.Head>
                <Table.Head>Lý do chuyển</Table.Head>
                <Table.Head>Ngày gửi</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Quyết định</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {requests.length === 0 && (
                <Table.Row>
                  <Table.Cell className="p-0" colSpan={8}>
                    <Empty
                      size="sm"
                      title="Chưa có yêu cầu nào"
                      description="Chưa có yêu cầu nào tại cơ sở này."
                    />
                  </Table.Cell>
                </Table.Row>
              )}
              {requests.map((req) => (
                <Table.Row key={req.id}>
                  <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                    {req.requester?.full_name ?? '—'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {req.old_unit?.code ?? '—'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs text-kumo-brand font-semibold">
                    {req.new_unit?.code ?? '—'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {req.rent_difference === 0
                      ? '—'
                      : `${req.rent_difference > 0 ? '+' : ''}${Number(req.rent_difference).toLocaleString('vi-VN')} đ`}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {req.reason}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {formatDate(req.created_at)}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <Badge variant={REQUEST_STATUS_LABEL[req.status].variant}>
                      {REQUEST_STATUS_LABEL[req.status].label}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    {req.status === 'REQUESTED' ? (
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busyId === req.id}
                          onClick={() => handleDecision(req.id, 'APPROVED')}
                        >
                          Duyệt
                        </Button>
                        <Button
                          variant="secondary-destructive"
                          size="sm"
                          disabled={busyId === req.id}
                          onClick={() => handleDecision(req.id, 'REJECTED')}
                        >
                          Từ chối
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-kumo-subtle">Đã xử lý</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>

      {/* Unit Inventory Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid gap-1">
            <Text as="h3" variant="heading">
              Danh sách đơn vị kho tại chi nhánh
            </Text>
            <Text variant="secondary">
              Cập nhật giá niêm yết, chuyển trạng thái bảo trì và quản lý hiện trạng kho.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-56">
              <InputGroup size="sm">
                <InputGroup.Addon align="start">
                  <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
                </InputGroup.Addon>
                <InputGroup.Input
                  type="text"
                  aria-label="Tìm mã kho hoặc loại kho"
                  placeholder="Tìm mã kho hoặc loại..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </div>
            <div className="w-48">
              <Select
                aria-label="Lọc trạng thái kho"
                size="sm"
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as string);
                  setUnitsPage(1);
                }}
                items={[
                  { value: 'ALL', label: 'Tất cả trạng thái' },
                  { value: 'AVAILABLE', label: 'Sẵn sàng (Trống)' },
                  { value: 'RENTED', label: 'Đang thuê' },
                  { value: 'HELD', label: 'Đang giữ chỗ' },
                  { value: 'BOOKED', label: 'Đã đặt' },
                  { value: 'MAINTENANCE', label: 'Bảo trì' },
                ]}
              />
            </div>
          </div>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã ô kho</Table.Head>
                <Table.Head>Khu</Table.Head>
                <Table.Head>Quy cách kho</Table.Head>
                <Table.Head>Diện tích</Table.Head>
                <Table.Head>Đơn giá tháng</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Thao tác quản lý</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredUnits.map((u) => (
                <Table.Row key={u.id}>
                  <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                    {u.code}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {u.zone ?? '—'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                    {u.unitType.name}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default">
                    {Number(u.areaM2)} m²
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default font-medium">
                    {formatVnd(u.unitType.monthlyPrice)}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <Badge variant={UNIT_STATUS_LABEL[u.status].variant}>
                      {UNIT_STATUS_LABEL[u.status].label}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    {(u.status === 'AVAILABLE' || u.status === 'MAINTENANCE') && (
                      <Button
                        variant={u.status === 'MAINTENANCE' ? 'secondary' : 'outline'}
                        size="sm"
                        icon={<Wrench className="w-3.5 h-3.5" />}
                        disabled={busyId === u.id}
                        onClick={() => toggleMaintenance(u)}
                      >
                        {u.status === 'MAINTENANCE' ? 'Mở lại kho' : 'Báo bảo trì'}
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
              {filteredUnits.length === 0 && (
                <Table.Row>
                  <Table.Cell className="p-0" colSpan={7}>
                    <Empty
                      size="sm"
                      title="Không có kho nào"
                      description="Không có kho nào khớp bộ lọc hiện tại."
                    />
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </LayerCard>

        {unitsMeta && unitsMeta.total > 0 && (
          <Pagination
            page={unitsPage}
            setPage={setUnitsPage}
            perPage={unitsMeta.limit}
            totalCount={unitsMeta.total}
          >
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        )}
      </div>
    </div>
  );
};
