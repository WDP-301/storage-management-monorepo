import {
  Badge,
  Button,
  DropdownMenu,
  Empty,
  Input,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CalendarBlank,
  CalendarCheck,
  CheckCircle,
  Clock,
  DotsThree,
  Eye,
  MagnifyingGlass,
  MapPin,
  Phone,
  UserCheck,
  UserPlus,
  Warehouse,
  XCircle,
} from '@phosphor-icons/react';
import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus, UserRole } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import { useAppToast } from '../../lib/toast';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import { AssignStaffTourDialog } from './AssignStaffTourDialog';
import { CancelTourDialog } from './CancelTourDialog';
import { CompleteTourDialog } from './CompleteTourDialog';
import { ConfirmTourDialog } from './ConfirmTourDialog';
import { TourAppointmentDetailDialog } from './TourAppointmentDetailDialog';
import {
  formatTourDate,
  formatTourDateTime,
  TOUR_STATUS_LABELS,
  TOUR_STATUS_VARIANTS,
} from './tour-display';

const PAGE_SIZE = 20;

export const TourAppointmentsPage: React.FC = () => {
  const toast = useAppToast();
  const { user, activeRole } = useAuth();
  const { selectedFacility } = useFacility();
  const role = activeRole ?? user?.roles?.[0];
  const isFacilityManager = role === UserRole.FACILITY_MANAGER;
  const facilityId = selectedFacility?.id;

  const [appointments, setAppointments] = useState<TourAppointmentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dialog States
  const [selectedAppointment, setSelectedAppointment] = useState<TourAppointmentRecord | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const latestRequest = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++latestRequest.current;
    if (isFacilityManager && !facilityId) {
      setAppointments([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await TourAppointmentsApi.list({
        page: currentPage,
        limit: PAGE_SIZE,
        facilityId: facilityId || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as TourAppointmentStatus) : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      if (requestId === latestRequest.current) {
        setAppointments(res.appointments || []);
        setTotal(res.meta?.total || 0);
      }
    } catch (err) {
      if (requestId === latestRequest.current) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách lịch xem kho.');
      }
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, facilityId, isFacilityManager, statusFilter, fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Client-side search filter over loaded page for fast responsiveness
  const filteredAppointments = useMemo(() => {
    if (!search.trim()) return appointments;
    const q = search.trim().toLowerCase();
    return appointments.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.storageUnit?.name && a.storageUnit.name.toLowerCase().includes(q)) ||
        (a.storageUnit?.code && a.storageUnit.code.toLowerCase().includes(q)),
    );
  }, [appointments, search]);

  // Counts for KPI
  const kpiCounts = useMemo(() => {
    const pending = appointments.filter((a) => a.status === TourAppointmentStatus.PENDING).length;
    const ongoing = appointments.filter(
      (a) =>
        a.status === TourAppointmentStatus.CONFIRMED || a.status === TourAppointmentStatus.ASSIGNED,
    ).length;
    const completed = appointments.filter(
      (a) => a.status === TourAppointmentStatus.COMPLETED,
    ).length;
    return { pending, ongoing, completed, total };
  }, [appointments, total]);

  const openAction = (
    apt: TourAppointmentRecord,
    action: 'detail' | 'confirm' | 'assign' | 'complete' | 'cancel',
  ) => {
    setSelectedAppointment(apt);
    if (action === 'detail') setIsDetailOpen(true);
    if (action === 'confirm') setIsConfirmOpen(true);
    if (action === 'assign') setIsAssignOpen(true);
    if (action === 'complete') setIsCompleteOpen(true);
    if (action === 'cancel') setIsCancelOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1">
          <Text as="h1" variant="heading" size="lg">
            Lịch hẹn xem kho mẫu
          </Text>
          <Text variant="secondary">
            Tiếp nhận yêu cầu tham quan kho của khách hàng, chốt lịch hẹn và phân công nhân viên dẫn
            khách.
          </Text>
        </div>
        <Button
          variant="secondary"
          icon={<ArrowsClockwise />}
          onClick={() => void loadData()}
          loading={isLoading}
        >
          Làm mới
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <LayerCard className="p-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary" size="xs">
              Tổng lượt hẹn
            </Text>
            <CalendarBlank className="w-4 h-4 text-kumo-secondary" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-kumo-default">{kpiCounts.total}</div>
        </LayerCard>

        <LayerCard className="p-4 ring ring-kumo-line border-l-4 border-l-kumo-warning">
          <div className="flex items-center justify-between">
            <Text variant="secondary" size="xs">
              Chờ tiếp nhận
            </Text>
            <Badge variant="warning">{kpiCounts.pending}</Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold text-kumo-warning">{kpiCounts.pending}</div>
        </LayerCard>

        <LayerCard className="p-4 ring ring-kumo-line border-l-4 border-l-kumo-brand">
          <div className="flex items-center justify-between">
            <Text variant="secondary" size="xs">
              Đã chốt & Đang chờ dẫn
            </Text>
            <Badge variant="info">{kpiCounts.ongoing}</Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold text-kumo-brand">{kpiCounts.ongoing}</div>
        </LayerCard>

        <LayerCard className="p-4 ring ring-kumo-line border-l-4 border-l-kumo-success">
          <div className="flex items-center justify-between">
            <Text variant="secondary" size="xs">
              Đã hoàn tất
            </Text>
            <Badge variant="success">{kpiCounts.completed}</Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold text-kumo-success">{kpiCounts.completed}</div>
        </LayerCard>
      </div>

      {/* Filter Bar */}
      <LayerCard className="p-4 ring ring-kumo-line">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Input
              type="text"
              placeholder="Tìm theo tên, SĐT, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            <MagnifyingGlass className="w-4 h-4 text-kumo-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div>
            <Select
              aria-label="Lọc trạng thái"
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(String(val));
                setCurrentPage(1);
              }}
              items={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: TourAppointmentStatus.PENDING, label: 'Chờ liên hệ (PENDING)' },
                { value: TourAppointmentStatus.CONFIRMED, label: 'Đã xác nhận (CONFIRMED)' },
                { value: TourAppointmentStatus.ASSIGNED, label: 'Đã gán nhân viên (ASSIGNED)' },
                { value: TourAppointmentStatus.COMPLETED, label: 'Đã hoàn tất (COMPLETED)' },
                { value: TourAppointmentStatus.CANCELLED, label: 'Đã hủy (CANCELLED)' },
              ]}
            />
          </div>

          <div>
            <Input
              type="date"
              aria-label="Từ ngày"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Từ ngày"
            />
          </div>

          <div>
            <Input
              type="date"
              aria-label="Đến ngày"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Đến ngày"
            />
          </div>
        </div>
      </LayerCard>

      {/* Table List */}
      <LayerCard className="p-0 ring ring-kumo-line overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-kumo-danger space-y-3">
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              Thử lại
            </Button>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="py-12">
            <Empty
              icon={<CalendarCheck className="w-8 h-8 text-kumo-secondary" />}
              title="Chưa có lịch hẹn xem kho nào"
              description="Các yêu cầu hẹn xem kho của khách hàng tại chi nhánh sẽ hiển thị tại đây."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Khách hàng</Table.Head>
                  <Table.Head>Chi nhánh & Kho</Table.Head>
                  <Table.Head>Ngày & Giờ hẹn</Table.Head>
                  <Table.Head>Nhân viên tiếp đón</Table.Head>
                  <Table.Head>Trạng thái</Table.Head>
                  <Table.Head className="text-right">Thao tác</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredAppointments.map((apt) => {
                  const isTerminal =
                    apt.status === TourAppointmentStatus.COMPLETED ||
                    apt.status === TourAppointmentStatus.CANCELLED;

                  return (
                    <Table.Row key={apt.id}>
                      {/* Customer Info */}
                      <Table.Cell>
                        <div className="grid gap-0.5">
                          <span className="font-medium text-kumo-default">{apt.fullName}</span>
                          <a
                            href={`tel:${apt.phone}`}
                            className="text-xs text-kumo-brand hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {apt.phone}
                          </a>
                        </div>
                      </Table.Cell>

                      {/* Facility & Target Warehouse */}
                      <Table.Cell>
                        <div className="grid gap-0.5">
                          <span className="text-xs text-kumo-secondary flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-kumo-secondary" />
                            {apt.facility?.name || '—'}
                          </span>
                          <span className="font-medium text-xs text-kumo-default flex items-center gap-1">
                            <Warehouse className="w-3 h-3 text-kumo-secondary" />
                            {apt.storageUnit
                              ? `${apt.storageUnit.name} (${apt.storageUnit.code})`
                              : 'Xem tổng quan cơ sở'}
                          </span>
                        </div>
                      </Table.Cell>

                      {/* Scheduled Time */}
                      <Table.Cell>
                        <div className="grid gap-0.5">
                          <span className="font-medium text-xs text-kumo-default">
                            {formatTourDate(apt.preferredDate)}
                          </span>
                          <span className="text-xs text-kumo-secondary flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {apt.preferredTimeSlot || 'Chưa định giờ'}
                          </span>
                        </div>
                      </Table.Cell>

                      {/* Staff Assignee */}
                      <Table.Cell>
                        {apt.assignee ? (
                          <div className="grid gap-0.5">
                            <span className="font-medium text-xs text-kumo-default flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-kumo-brand" />
                              {apt.assignee.fullName}
                            </span>
                            {apt.assignee.phone && (
                              <span className="text-[11px] text-kumo-secondary">
                                {apt.assignee.phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-kumo-secondary italic">Chưa phân công</span>
                        )}
                      </Table.Cell>

                      {/* Status */}
                      <Table.Cell>
                        <Badge variant={TOUR_STATUS_VARIANTS[apt.status]}>
                          {TOUR_STATUS_LABELS[apt.status]}
                        </Badge>
                      </Table.Cell>

                      {/* Actions */}
                      <Table.Cell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Eye />}
                            onClick={() => openAction(apt, 'detail')}
                          >
                            Xem
                          </Button>

                          {!isTerminal && (
                            <DropdownMenu>
                              <DropdownMenu.Trigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<DotsThree className="w-4 h-4" />}
                                  aria-label="Thao tác khác"
                                />
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content align="end" className="w-44">
                                {apt.status === TourAppointmentStatus.PENDING && (
                                  <DropdownMenu.Item onClick={() => openAction(apt, 'confirm')}>
                                    <CalendarCheck className="w-4 h-4 mr-2 text-kumo-info" />
                                    Xác nhận lịch
                                  </DropdownMenu.Item>
                                )}

                                {(apt.status === TourAppointmentStatus.CONFIRMED ||
                                  apt.status === TourAppointmentStatus.ASSIGNED) && (
                                  <DropdownMenu.Item onClick={() => openAction(apt, 'confirm')}>
                                    <Clock className="w-4 h-4 mr-2 text-kumo-info" />
                                    Đổi ngày/giờ hẹn
                                  </DropdownMenu.Item>
                                )}

                                <DropdownMenu.Item onClick={() => openAction(apt, 'assign')}>
                                  <UserPlus className="w-4 h-4 mr-2 text-kumo-brand" />
                                  {apt.assignedTo ? 'Đổi nhân viên' : 'Gán nhân viên'}
                                </DropdownMenu.Item>

                                {(apt.status === TourAppointmentStatus.ASSIGNED ||
                                  apt.status === TourAppointmentStatus.CONFIRMED) && (
                                  <DropdownMenu.Item onClick={() => openAction(apt, 'complete')}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-kumo-success" />
                                    Hoàn tất ca
                                  </DropdownMenu.Item>
                                )}

                                <DropdownMenu.Item
                                  onClick={() => openAction(apt, 'cancel')}
                                  className="text-kumo-danger"
                                >
                                  <XCircle className="w-4 h-4 mr-2 text-kumo-danger" />
                                  Hủy lịch hẹn
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="p-4 border-t border-kumo-line flex items-center justify-between">
            <Text variant="secondary" size="xs">
              Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
              {Math.min(currentPage * PAGE_SIZE, total)} trên {total} lịch hẹn
            </Text>
            <Pagination
              page={currentPage}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </LayerCard>

      {/* Dialogs */}
      <TourAppointmentDetailDialog
        open={isDetailOpen}
        appointment={selectedAppointment}
        onClose={() => setIsDetailOpen(false)}
        onConfirm={(apt) => openAction(apt, 'confirm')}
        onAssign={(apt) => openAction(apt, 'assign')}
        onComplete={(apt) => openAction(apt, 'complete')}
        onCancel={(apt) => openAction(apt, 'cancel')}
      />

      <ConfirmTourDialog
        open={isConfirmOpen}
        appointment={selectedAppointment}
        onClose={() => setIsConfirmOpen(false)}
        onSuccess={() => void loadData()}
      />

      <AssignStaffTourDialog
        open={isAssignOpen}
        appointment={selectedAppointment}
        onClose={() => setIsAssignOpen(false)}
        onSuccess={() => void loadData()}
      />

      <CompleteTourDialog
        open={isCompleteOpen}
        appointment={selectedAppointment}
        onClose={() => setIsCompleteOpen(false)}
        onSuccess={() => void loadData()}
      />

      <CancelTourDialog
        open={isCancelOpen}
        appointment={selectedAppointment}
        onClose={() => setIsCancelOpen(false)}
        onSuccess={() => void loadData()}
      />
    </div>
  );
};
