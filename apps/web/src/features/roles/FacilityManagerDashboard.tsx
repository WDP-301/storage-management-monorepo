import { Badge, Button, LayerCard, Table, Text } from '@cloudflare/kumo';
import { AlertCircle, Building2, CheckCircle, Layers, Wrench } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import {
  ChangeRequestsApi,
  type ManagedUnit,
  type ServiceTicketRecord,
  TicketsApi,
  type UnitChangeRequestRecord,
  UnitsApi,
} from '../../lib/api';

const formatVnd = (value: number | string) => `${Number(value).toLocaleString('vi-VN')} đ/tháng`;
const formatDate = (iso: string) =>
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

const TICKET_STATUS_LABEL: Record<
  ServiceTicketRecord['status'],
  { label: string; variant: 'success' | 'primary' | 'error' | 'warning' | 'neutral' }
> = {
  OPEN: { label: 'Mới', variant: 'warning' },
  ASSIGNED: { label: 'Đã giao', variant: 'primary' },
  IN_PROGRESS: { label: 'Đang xử lý', variant: 'primary' },
  RESOLVED: { label: 'Đã xong', variant: 'success' },
  CLOSED: { label: 'Đóng', variant: 'neutral' },
  CANCELLED: { label: 'Đã hủy', variant: 'neutral' },
};

export const FacilityManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { facilities, selectedFacility, isLoading: facilitiesLoading } = useFacility();
  const selectedFacilityId = selectedFacility?.id;
  const [units, setUnits] = useState<ManagedUnit[]>([]);
  const [requests, setRequests] = useState<UnitChangeRequestRecord[]>([]);
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionAlert, setActionAlert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const notify = (message: string) => {
    setActionAlert(message);
    setTimeout(() => setActionAlert(null), 4000);
  };

  const loadFacilityData = useCallback(async (facilityId: string) => {
    const [unitsData, requestsData, ticketsData] = await Promise.all([
      UnitsApi.managed(facilityId),
      ChangeRequestsApi.list(),
      TicketsApi.list(),
    ]);
    // ponytail: requests/tickets fetch limit=50 then filter client-side — silent
    // truncation past 50 open items; upgrade path = facilityId param on those list APIs.
    setUnits(unitsData.units);
    setRequests(requestsData.requests.filter((r) => r.facility_id === facilityId));
    setTickets(ticketsData.tickets.filter((t) => t.facility?.id === facilityId));
  }, []);

  useEffect(() => {
    if (!selectedFacilityId) return;
    setIsLoading(true);
    loadFacilityData(selectedFacilityId)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [selectedFacilityId, loadFacilityData]);

  const toggleMaintenance = async (unit: ManagedUnit) => {
    const next = unit.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setBusyId(unit.id);
    try {
      await UnitsApi.updateStatus(unit.id, next);
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, status: next } : u)));
      notify(
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
        const unitsData = await UnitsApi.managed(selectedFacilityId);
        setUnits(unitsData.units);
      }
      notify(
        decision === 'APPROVED' ? 'Đã phê duyệt yêu cầu đổi kho.' : 'Đã từ chối yêu cầu đổi kho.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xử lý được yêu cầu');
    } finally {
      setBusyId(null);
    }
  };

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.unitType.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const rentedCount = units.filter((u) => u.status === 'RENTED').length;
  const availableCount = units.filter((u) => u.status === 'AVAILABLE').length;
  const maintenanceCount = units.filter((u) => u.status === 'MAINTENANCE').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'REQUESTED').length;
  const occupancy = units.length > 0 ? ((rentedCount / units.length) * 100).toFixed(1) : '0.0';

  if (facilitiesLoading || (isLoading && facilities.length === 0)) {
    return <Text variant="secondary">Đang tải danh sách cơ sở...</Text>;
  }

  if (facilities.length === 0) {
    return (
      <div className="space-y-3">
        <Text as="h2">Facility management</Text>
        <Text variant="secondary">
          Tài khoản của bạn chưa được gán quản lý cơ sở nào. Liên hệ quản trị viên để được cấp
          quyền.
        </Text>
        {error && <Text variant="secondary">{error}</Text>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-lh flex items-center text-kumo-brand">
              <Building2 className="w-5 h-5" />
            </span>
            <Text as="h2">Facility management</Text>
            {selectedFacility && (
              <Badge variant="teal">{`Đang xem: ${selectedFacility.name} (${selectedFacility.code})`}</Badge>
            )}
          </div>
          <Text variant="secondary">
            Quản lý danh mục các ô kho, trạng thái bảo trì, duyệt yêu cầu chuyển kho của khách hàng.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" appearance="dot">
            Quản lý trực: {user?.fullName}
          </Badge>
        </div>
      </div>

      {actionAlert && (
        <div className="p-3 bg-kumo-info-tint text-kumo-info rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionAlert}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Kho đang cho thuê</Text>
            <Layers className="w-4 h-4 text-kumo-success" />
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
            <AlertCircle className="w-4 h-4 text-kumo-warning" />
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
                  <Table.Cell className="text-kumo-subtle" colSpan={8}>
                    Chưa có yêu cầu nào tại cơ sở này.
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
            <input
              type="text"
              placeholder="Tìm mã kho hoặc loại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs px-2.5 rounded-md bg-kumo-base border border-kumo-line text-kumo-default w-48"
            />
            <select
              aria-label="Lọc trạng thái kho"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs px-2.5 rounded-md bg-kumo-base border border-kumo-line text-kumo-default"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AVAILABLE">Sẵn sàng (Trống)</option>
              <option value="RENTED">Đang thuê</option>
              <option value="HELD">Đang giữ chỗ</option>
              <option value="BOOKED">Đã đặt</option>
              <option value="MAINTENANCE">Bảo trì</option>
            </select>
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
                  <Table.Cell className="text-kumo-subtle" colSpan={7}>
                    Không có kho nào khớp bộ lọc.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>

      {/* Service Tickets */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Ticket dịch vụ tại cơ sở
          </Text>
          <Text variant="secondary">Các yêu cầu hỗ trợ / bảo trì khách gửi tới cơ sở này.</Text>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã ticket</Table.Head>
                <Table.Head>Chủ đề</Table.Head>
                <Table.Head>Khách hàng</Table.Head>
                <Table.Head>Nhân viên xử lý</Table.Head>
                <Table.Head>Ưu tiên</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head>Ngày tạo</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tickets.length === 0 && (
                <Table.Row>
                  <Table.Cell className="text-kumo-subtle" colSpan={7}>
                    Chưa có ticket nào tại cơ sở này.
                  </Table.Cell>
                </Table.Row>
              )}
              {tickets.map((t) => (
                <Table.Row key={t.id}>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {t.ticket_no}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                    {t.subject}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {t.customer?.full_name ?? '—'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {t.assignee?.full_name ?? 'Chưa giao'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <Badge
                      variant={
                        t.priority === 'URGENT' || t.priority === 'HIGH' ? 'error' : 'neutral'
                      }
                    >
                      {t.priority}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <Badge variant={TICKET_STATUS_LABEL[t.status].variant}>
                      {TICKET_STATUS_LABEL[t.status].label}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {formatDate(t.created_at)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>
    </div>
  );
};
