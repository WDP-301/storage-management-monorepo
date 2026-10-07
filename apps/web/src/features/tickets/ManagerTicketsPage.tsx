import {
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  InputGroup,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
  Textarea,
} from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  DotsThree,
  Eye,
  Lifebuoy,
  MagnifyingGlass,
  Paperclip,
  Trash,
  UserCheck,
  UserPlus,
  WarningCircle,
  Wrench,
  X,
  XCircle,
} from '@phosphor-icons/react';
import { TicketPriority, TicketStatus, UserRole } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TicketsApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type {
  ServiceTicketRecord,
  TicketUserInfo,
  UpdateTicketDto,
} from '../../types/service-tickets';

const PAGE_SIZE = 20;

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Chờ phân công',
  [TicketStatus.ASSIGNED]: 'Đã gán ca',
  [TicketStatus.IN_PROGRESS]: 'Đang xử lý',
  [TicketStatus.RESOLVED]: 'Đã giải quyết',
  [TicketStatus.CLOSED]: 'Đã đóng',
  [TicketStatus.CANCELLED]: 'Đã hủy',
};

const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.URGENT]: 'Khẩn cấp',
  [TicketPriority.HIGH]: 'Ưu tiên cao',
  [TicketPriority.NORMAL]: 'Bình thường',
  [TicketPriority.LOW]: 'Thấp',
};

/** Workflow order mirrored from the API — updates only move a ticket forward. */
const TICKET_STATUS_FLOW: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
];

/** Terminal tickets are immutable — same rule as the API's update endpoint. */
const TERMINAL_STATUSES: readonly TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

/** Tickets still being worked can be cancelled — mirrors the API's ASSIGNABLE_STATUSES. */
const CANCELLABLE_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];

const formatFileSize = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

interface AttachmentView {
  name: string;
  url?: string;
  size?: number;
}

/** Attachments are free-form file refs ({name, key, url|publicUrl, size} or a bare string). */
const toAttachmentView = (a: unknown, idx: number): AttachmentView => {
  if (typeof a === 'string') {
    return { name: a.split('/').pop() || a, url: a };
  }
  if (a && typeof a === 'object') {
    const o = a as Record<string, unknown>;
    const url = (o.url ?? o.publicUrl ?? o.href) as string | undefined;
    const rawName = o.name ?? o.fileName ?? o.filename ?? o.key ?? url;
    const name = String(rawName ?? `Tệp đính kèm ${idx + 1}`);
    return {
      name: name.split('/').pop() || name,
      url: url ? String(url) : undefined,
      size: typeof o.size === 'number' ? o.size : undefined,
    };
  }
  return { name: `Tệp đính kèm ${idx + 1}` };
};

export const ManagerTicketsPage: React.FC = () => {
  const toast = useAppToast();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canAssign = roles.includes(UserRole.FACILITY_MANAGER);
  const canDelete = roles.includes(UserRole.ADMIN);
  const canEdit = canAssign || canDelete;
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [counts, setCounts] = useState({ total: 0, unassigned: 0, inProgress: 0, resolved: 0 });
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Modal states
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicketRecord | null>(null);
  const [assignModalTicket, setAssignModalTicket] = useState<ServiceTicketRecord | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<ServiceTicketRecord | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<ServiceTicketRecord | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Edit form state (detail modal)
  const [editStatus, setEditStatus] = useState<TicketStatus>(TicketStatus.OPEN);
  const [editPriority, setEditPriority] = useState<TicketPriority>(TicketPriority.NORMAL);
  const [editResolution, setEditResolution] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const availableStaff = useMemo(() => {
    const existingAssignees = tickets
      .map((t) => t.assignee)
      .filter((a): a is TicketUserInfo => Boolean(a?.id));
    return Array.from(new Map(existingAssignees.map((a) => [a.id, a])).values());
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setActionErrorMessage(null);
    const countByStatus = (s: TicketStatus) =>
      TicketsApi.getAll({ status: s, limit: 1 }).then((r) => r?.meta?.total ?? 0);
    try {
      const [res, total, open, assigned, inProgress, resolved, closed] = await Promise.all([
        TicketsApi.getAll({
          page,
          limit: PAGE_SIZE,
          ...(statusFilter !== 'ALL' && statusFilter !== 'UNASSIGNED'
            ? { status: statusFilter as TicketStatus }
            : {}),
          ...(priorityFilter !== 'ALL' ? { priority: priorityFilter as TicketPriority } : {}),
        }),
        TicketsApi.getAll({ limit: 1 }).then((r) => r?.meta?.total ?? 0),
        countByStatus(TicketStatus.OPEN),
        countByStatus(TicketStatus.ASSIGNED),
        countByStatus(TicketStatus.IN_PROGRESS),
        countByStatus(TicketStatus.RESOLVED),
        countByStatus(TicketStatus.CLOSED),
      ]);
      setTickets(res?.tickets || []);
      setMeta(res?.meta ?? null);
      setCounts({
        total,
        unassigned: open,
        inProgress: assigned + inProgress,
        resolved: resolved + closed,
      });
    } catch (err: unknown) {
      setTickets([]);
      setMeta(null);
      const msg =
        err instanceof Error ? err.message : 'Không thể tải danh sách phiếu sự cố từ hệ thống.';
      setActionErrorMessage(msg);
      toast.error('Lỗi tải dữ liệu', msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, priorityFilter, toast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const syncEditState = (ticket: ServiceTicketRecord) => {
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditResolution(ticket.resolution ?? '');
  };

  const handleOpenDetailModal = async (ticket: ServiceTicketRecord) => {
    setSelectedTicket(ticket);
    syncEditState(ticket);
    setIsLoadingDetail(true);
    try {
      const freshTicket = await TicketsApi.getOne(ticket.id);
      setSelectedTicket(freshTicket);
      syncEditState(freshTicket);
    } catch (err: unknown) {
      console.warn('Failed to fetch ticket detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenAssignModal = (ticket: ServiceTicketRecord) => {
    setAssignModalTicket(ticket);
    setSelectedStaffId(ticket.assigned_to || '');
  };

  const handleConfirmAssign = async () => {
    if (!assignModalTicket || !selectedStaffId) return;

    setIsAssigning(true);
    setActionErrorMessage(null);
    try {
      const updatedTicket = await TicketsApi.assign(assignModalTicket.id, selectedStaffId);
      setTickets((prev) =>
        prev.map((t) => (t.id === assignModalTicket.id ? { ...t, ...updatedTicket } : t)),
      );

      const staffName =
        updatedTicket.assignee?.full_name ??
        availableStaff.find((s) => s.id === selectedStaffId)?.full_name ??
        'nhân viên mới';
      const successMsg = `Đã phân công vé ${assignModalTicket.ticket_no} cho nhân viên ${staffName} thành công.`;
      setActionSuccessMessage(successMsg);
      toast.success('Phân công thành công', successMsg);
      setAssignModalTicket(null);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 403
          ? 'Tài khoản không có quyền phân công (yêu cầu vai trò Quản lý cơ sở của cơ sở này).'
          : status === 404
            ? 'Không tìm thấy phiếu sự cố hoặc nhân viên kỹ thuật trên hệ thống.'
            : err instanceof Error
              ? err.message
              : 'Lỗi khi phân công nhân viên.';
      setActionErrorMessage(msg);
      toast.error('Phân công thất bại', msg);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;

    setIsDeleting(true);
    setActionErrorMessage(null);
    const targetTicket = ticketToDelete;

    try {
      await TicketsApi.remove(targetTicket.id);

      await loadTickets();
      const deleteMsg = `Đã xóa phiếu sự cố ${targetTicket.ticket_no} thành công.`;
      setActionSuccessMessage(deleteMsg);
      toast.notifyDeleted('phiếu sự cố', targetTicket.ticket_no);
      setTicketToDelete(null);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 403
          ? 'Tài khoản không có quyền xóa phiếu sự cố này (yêu cầu vai trò Quản trị viên hoặc Quản lý cơ sở của cơ sở này).'
          : status === 404
            ? 'Không tìm thấy phiếu sự cố trên hệ thống.'
            : err instanceof Error
              ? err.message
              : 'Lỗi khi xóa vé sự cố.';
      setActionErrorMessage(msg);
      toast.error('Xóa vé thất bại', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!ticketToCancel) return;

    setIsCancelling(true);
    setActionErrorMessage(null);
    const targetTicket = ticketToCancel;

    try {
      const updated = await TicketsApi.cancel(targetTicket.id);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      if (selectedTicket?.id === updated.id) {
        setSelectedTicket(updated);
        syncEditState(updated);
      }
      const cancelMsg = `Đã hủy phiếu ${targetTicket.ticket_no} thành công.`;
      setActionSuccessMessage(cancelMsg);
      toast.success('Hủy phiếu thành công', cancelMsg);
      setTicketToCancel(null);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 403
          ? 'Tài khoản không có quyền hủy phiếu sự cố này (yêu cầu vai trò Quản lý cơ sở của cơ sở này).'
          : status === 404
            ? 'Không tìm thấy phiếu sự cố trên hệ thống.'
            : status === 409
              ? 'Phiếu không còn ở trạng thái có thể hủy.'
              : err instanceof Error
                ? err.message
                : 'Lỗi khi hủy phiếu.';
      setActionErrorMessage(msg);
      toast.error('Hủy phiếu thất bại', msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const hasEditChanges =
    selectedTicket != null &&
    (editStatus !== selectedTicket.status ||
      editPriority !== selectedTicket.priority ||
      editResolution.trim() !== (selectedTicket.resolution ?? '').trim());

  const statusEditOptions = useMemo(() => {
    if (!selectedTicket) return [];
    const idx = TICKET_STATUS_FLOW.indexOf(selectedTicket.status);
    const allowed = [
      selectedTicket.status,
      ...(idx >= 0 ? TICKET_STATUS_FLOW.slice(idx + 1) : []),
      TicketStatus.CLOSED,
    ];
    return [...new Set(allowed)].map((value) => ({
      value,
      label: TICKET_STATUS_LABELS[value],
    }));
  }, [selectedTicket]);

  const priorityEditOptions = useMemo(
    () =>
      (Object.values(TicketPriority) as TicketPriority[]).map((value) => ({
        value,
        label: TICKET_PRIORITY_LABELS[value],
      })),
    [],
  );

  const handleSaveEdit = async () => {
    if (!selectedTicket || !hasEditChanges) return;

    const dto: UpdateTicketDto = {};
    if (editStatus !== selectedTicket.status) dto.status = editStatus;
    if (editPriority !== selectedTicket.priority) dto.priority = editPriority;
    const trimmedResolution = editResolution.trim();
    if (trimmedResolution !== (selectedTicket.resolution ?? '')) {
      dto.resolution = trimmedResolution || null;
    }
    if (Object.keys(dto).length === 0) return;

    setIsSavingEdit(true);
    setActionErrorMessage(null);
    try {
      const updated = await TicketsApi.update(selectedTicket.id, dto);
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      syncEditState(updated);
      const msg = `Đã cập nhật phiếu ${updated.ticket_no} thành công.`;
      setActionSuccessMessage(msg);
      toast.success('Cập nhật thành công', msg);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 403
          ? 'Tài khoản không có quyền cập nhật phiếu sự cố này.'
          : status === 409
            ? 'Phiếu đã ở trạng thái kết thúc, không thể cập nhật.'
            : err instanceof Error
              ? err.message
              : 'Lỗi khi cập nhật phiếu sự cố.';
      setActionErrorMessage(msg);
      toast.error('Cập nhật thất bại', msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Metrics come from server-side counts (limit=1 reads meta.total), not the
  // current page. "Chờ phân công" uses OPEN as the closest server proxy for unassigned.
  const totalTickets = counts.total;
  const unassignedCount = counts.unassigned;
  const inProgressCount = counts.inProgress;
  const resolvedCount = counts.resolved;

  // Status/priority are filtered server-side; search and the pseudo-status
  // UNASSIGNED stay client-side on the current page.
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        t.ticket_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(t.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        Boolean(t.storage_unit?.code?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter !== 'UNASSIGNED' || !t.assigned_to || t.status === TicketStatus.OPEN;

      return matchSearch && matchStatus;
    });
  }, [tickets, searchQuery, statusFilter]);

  const getPriorityBadge = (priority: TicketPriority) => {
    const label = TICKET_PRIORITY_LABELS[priority] ?? priority;
    switch (priority) {
      case TicketPriority.URGENT:
        return (
          <Badge variant="error" appearance="dot">
            {label}
          </Badge>
        );
      case TicketPriority.HIGH:
        return (
          <Badge variant="warning" appearance="dot">
            {label}
          </Badge>
        );
      default:
        return <Badge variant="neutral">{label}</Badge>;
    }
  };

  // History ASSIGNED entries store the staff id (old rows) or name (new rows) in
  // `to` — resolve ids to names where we know them, else show the raw value.
  const resolveStaffLabel = (idOrName?: string | null) => {
    if (!idOrName) return '';
    if (selectedTicket?.assignee?.id === idOrName) return selectedTicket.assignee.full_name;
    return availableStaff.find((s) => s.id === idOrName)?.full_name ?? idOrName;
  };

  const getStatusBadge = (status: TicketStatus) => {
    const label = TICKET_STATUS_LABELS[status] ?? status;
    switch (status) {
      case TicketStatus.OPEN:
        return (
          <Badge variant="warning" appearance="dot">
            {label}
          </Badge>
        );
      case TicketStatus.ASSIGNED:
        return (
          <Badge variant="primary" appearance="dot">
            {label}
          </Badge>
        );
      case TicketStatus.IN_PROGRESS:
        return (
          <Badge variant="info" appearance="dot">
            {label}
          </Badge>
        );
      case TicketStatus.RESOLVED:
        return (
          <Badge variant="success" appearance="dot">
            {label}
          </Badge>
        );
      default:
        return <Badge variant="neutral">{label}</Badge>;
    }
  };

  const statusOptions = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'UNASSIGNED', label: 'Chờ phân công' },
    { value: TicketStatus.ASSIGNED, label: 'Đã gán ca' },
    { value: TicketStatus.IN_PROGRESS, label: 'Đang xử lý' },
    { value: TicketStatus.RESOLVED, label: 'Đã giải quyết' },
    { value: TicketStatus.CLOSED, label: 'Đã đóng' },
  ];

  const priorityOptions = [
    { value: 'ALL', label: 'Tất cả' },
    { value: TicketPriority.URGENT, label: 'Khẩn cấp' },
    { value: TicketPriority.HIGH, label: 'Ưu tiên cao' },
    { value: TicketPriority.NORMAL, label: 'Bình thường' },
    { value: TicketPriority.LOW, label: 'Thấp' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Quản lý sự cố & Phiếu dịch vụ
          </Text>
          <Text variant="secondary">
            Tiếp nhận báo cáo sự cố kho từ khách hàng, theo dõi tiến độ và phân công nhân viên kỹ
            thuật giải quyết.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className="w-4 h-4" />}
            onClick={loadTickets}
            loading={isLoading}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccessMessage && (
        <div
          role="alert"
          className="p-3.5 bg-kumo-success-tint text-kumo-success rounded-lg text-sm flex items-center gap-2.5"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {actionErrorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center gap-2.5"
        >
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{actionErrorMessage}</span>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tổng số phiếu sự cố</Text>
            <Lifebuoy className="w-4 h-4 text-kumo-subtle" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{totalTickets}</span>
            <span className="text-xs text-kumo-subtle">vé ghi nhận</span>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Chờ phân công</Text>
            <Clock className="w-4 h-4 text-kumo-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{unassignedCount}</span>
            <Badge variant="warning" appearance="dot">
              Cần gán ca
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đang tiến hành xử lý</Text>
            <Wrench className="w-4 h-4 text-kumo-info" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{inProgressCount}</span>
            <Badge variant="info" appearance="dot">
              Kỹ thuật đang làm
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đã xử lý dứt điểm</Text>
            <CheckCircle className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{resolvedCount}</span>
            <Badge variant="success" appearance="dot">
              Hoàn tất
            </Badge>
          </div>
        </LayerCard>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Select */}
          <div className="w-48">
            <Select
              aria-label="Lọc trạng thái vé"
              value={statusFilter}
              onValueChange={(val) => {
                if (val) {
                  setStatusFilter(String(val));
                  setPage(1);
                }
              }}
              items={statusOptions}
              renderValue={(v) =>
                `Trạng thái: ${statusOptions.find((o) => o.value === v)?.label ?? String(v)}`
              }
            />
          </div>

          {/* Priority Select */}
          <div className="w-44">
            <Select
              aria-label="Lọc mức độ ưu tiên"
              value={priorityFilter}
              onValueChange={(val) => {
                if (val) {
                  setPriorityFilter(String(val));
                  setPage(1);
                }
              }}
              items={priorityOptions}
              renderValue={(v) =>
                `Mức độ: ${priorityOptions.find((o) => o.value === v)?.label ?? String(v)}`
              }
            />
          </div>
        </div>

        {/* Search Input using Kumo InputGroup */}
        <div className="w-full sm:w-72">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Tìm mã vé, sự cố, khách..."
              aria-label="Tìm kiếm vé sự cố"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </InputGroup>
        </div>
      </div>

      {/* Tickets Table */}
      <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Mã phiếu</Table.Head>
              <Table.Head>Sự cố & Đơn vị kho</Table.Head>
              <Table.Head>Khách hàng báo</Table.Head>
              <Table.Head>Mức ưu tiên</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head>Nhân viên phụ trách</Table.Head>
              <Table.Head className="text-right">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredTickets.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7} className="text-center py-10 text-kumo-subtle">
                  Không tìm thấy phiếu sự cố nào phù hợp với bộ lọc hiện tại.
                </Table.Cell>
              </Table.Row>
            ) : (
              filteredTickets.map((ticket) => {
                const hasAssignee = Boolean(ticket.assigned_to);

                return (
                  <Table.Row key={ticket.id}>
                    {/* Ticket No & Date */}
                    <Table.Cell className="whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-kumo-default">
                        {ticket.ticket_no}
                      </div>
                      <div className="text-[11px] text-kumo-subtle mt-0.5">
                        {new Date(ticket.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </Table.Cell>

                    {/* Subject, Unit & Facility */}
                    <Table.Cell className="min-w-[240px] max-w-sm">
                      <div className="font-medium text-kumo-default text-xs line-clamp-1">
                        {ticket.subject}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-kumo-subtle whitespace-nowrap">
                        {ticket.storage_unit && (
                          <>
                            <span className="font-mono font-semibold text-kumo-brand whitespace-nowrap shrink-0">
                              {ticket.storage_unit.code}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span className="whitespace-nowrap truncate">
                          {ticket.facility?.name || 'Chi nhánh'}
                        </span>
                        {ticket.type && (
                          <>
                            <span>•</span>
                            <span className="italic whitespace-nowrap">{ticket.type.name}</span>
                          </>
                        )}
                      </div>
                    </Table.Cell>

                    {/* Customer */}
                    <Table.Cell className="whitespace-nowrap">
                      <div className="font-medium text-xs text-kumo-default">
                        {ticket.customer?.full_name || 'Khách hàng'}
                      </div>
                      <div className="text-[11px] text-kumo-subtle">
                        {ticket.customer?.email || 'N/A'}
                      </div>
                    </Table.Cell>

                    {/* Priority */}
                    <Table.Cell className="whitespace-nowrap">
                      {getPriorityBadge(ticket.priority)}
                    </Table.Cell>

                    {/* Status */}
                    <Table.Cell className="whitespace-nowrap">
                      {getStatusBadge(ticket.status)}
                    </Table.Cell>

                    {/* Assignee */}
                    <Table.Cell className="whitespace-nowrap">
                      {hasAssignee && ticket.assignee ? (
                        <div className="flex items-center gap-1.5 text-xs text-kumo-default font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-kumo-brand shrink-0" />
                          <span
                            className="truncate max-w-[140px]"
                            title={ticket.assignee.full_name}
                          >
                            {ticket.assignee.full_name.split(' (')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-kumo-warning font-medium italic flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          Chưa phân công
                        </span>
                      )}
                    </Table.Cell>

                    {/* Actions */}
                    <Table.Cell className="whitespace-nowrap text-right">
                      <DropdownMenu>
                        <DropdownMenu.Trigger
                          render={(props) => (
                            <Button
                              {...props}
                              size="sm"
                              variant="ghost"
                              shape="square"
                              icon={<DotsThree weight="bold" />}
                              aria-label={`Thao tác vé ${ticket.ticket_no}`}
                              title={`Thao tác vé ${ticket.ticket_no}`}
                            />
                          )}
                        />
                        <DropdownMenu.Content align="end" sideOffset={4}>
                          <DropdownMenu.Item
                            icon={Eye}
                            onClick={() => handleOpenDetailModal(ticket)}
                          >
                            Chi tiết
                          </DropdownMenu.Item>
                          {canAssign && (
                            <DropdownMenu.Item
                              icon={UserPlus}
                              onClick={() => handleOpenAssignModal(ticket)}
                            >
                              {hasAssignee ? 'Đổi ca trực' : 'Phân công'}
                            </DropdownMenu.Item>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                variant="danger"
                                icon={Trash}
                                onClick={() => setTicketToDelete(ticket)}
                              >
                                Xóa vé
                              </DropdownMenu.Item>
                            </>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </LayerCard>

      {/* Footer: Pagination */}
      {meta && meta.total > 0 && (
        <div className="pt-2 border-t border-kumo-line">
          <Pagination page={page} setPage={setPage} perPage={meta.limit} totalCount={meta.total}>
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        </div>
      )}

      {/* Modal 1: Assign Staff Dialog */}
      <Dialog.Root
        open={Boolean(assignModalTicket)}
        onOpenChange={(open) => !open && setAssignModalTicket(null)}
      >
        <Dialog size="xl" className="p-6 sm:p-7 max-w-2xl sm:w-[640px] w-full">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-kumo-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-kumo-fill text-kumo-default flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-kumo-default">
                    Phân công kỹ thuật viên phụ trách
                  </Dialog.Title>
                  <div className="text-xs">
                    <Text variant="secondary">
                      Chỉ định nhân viên chịu trách nhiệm xử lý sự cố tại cơ sở
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
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              />
            </div>

            {assignModalTicket && (
              <div className="space-y-4">
                {/* Ticket Context Pill */}
                <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-sm text-kumo-brand">
                      {assignModalTicket.ticket_no}
                    </span>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(assignModalTicket.priority)}
                      {getStatusBadge(assignModalTicket.status)}
                    </div>
                  </div>
                  <div className="font-medium text-sm text-kumo-default leading-snug">
                    {assignModalTicket.subject}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-kumo-line text-xs text-kumo-subtle">
                    <div>
                      Kho:{' '}
                      <strong className="text-kumo-default font-mono whitespace-nowrap">
                        {assignModalTicket.storage_unit?.code || 'Chung'}
                      </strong>
                    </div>
                    <div>
                      Cơ sở:{' '}
                      <strong className="text-kumo-default">
                        {assignModalTicket.facility?.name}
                      </strong>
                    </div>
                    <div>
                      Khách hàng:{' '}
                      <strong className="text-kumo-default">
                        {assignModalTicket.customer?.full_name || 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Staff Selection */}
                <div className="space-y-3">
                  <label
                    htmlFor="staff-select"
                    className="block text-xs font-semibold text-kumo-default"
                  >
                    Chọn nhân viên tiếp nhận ca trực
                  </label>
                  {availableStaff.length > 0 && (
                    <select
                      id="staff-select"
                      aria-label="Chọn nhân viên tiếp nhận ca trực"
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-kumo-base border border-kumo-line text-kumo-default rounded-lg focus:outline-none focus:ring-2 focus:ring-kumo-brand/30"
                    >
                      <option value="">
                        -- Chọn từ danh sách nhân viên kỹ thuật ({availableStaff.length} người) --
                      </option>
                      {availableStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name} ({staff.email})
                        </option>
                      ))}
                    </select>
                  )}
                  <div>
                    <label
                      htmlFor="manual-staff-uuid"
                      className="block text-xs text-kumo-subtle mb-1"
                    >
                      {availableStaff.length > 0
                        ? 'Hoặc nhập trực tiếp mã UUID nhân viên kỹ thuật:'
                        : 'Nhập mã UUID nhân viên kỹ thuật (Staff User ID):'}
                    </label>
                    <input
                      id="manual-staff-uuid"
                      type="text"
                      placeholder="VD: 01925b6a-9b10-7e8c-e001-000000000001"
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value.trim())}
                      className="w-full h-10 px-3 text-xs bg-kumo-base border border-kumo-line text-kumo-default rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-kumo-brand/30"
                    />
                  </div>
                </div>

                {/* Current Assignee Note */}
                {assignModalTicket.assignee && (
                  <div className="text-xs text-kumo-subtle bg-kumo-info-tint p-3 rounded-lg flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-kumo-info shrink-0" />
                    <span>
                      Hiện đang phân công cho:{' '}
                      <strong className="text-kumo-default">
                        {assignModalTicket.assignee.full_name}
                      </strong>
                      . Chọn nhân viên mới để chuyển giao ca.
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-kumo-line">
                  <Button
                    variant="secondary"
                    onClick={() => setAssignModalTicket(null)}
                    disabled={isAssigning}
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!selectedStaffId || isAssigning}
                    loading={isAssigning}
                    icon={<UserCheck className="w-4 h-4" />}
                    onClick={handleConfirmAssign}
                  >
                    Xác nhận phân công
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Modal 2: Ticket Detail View Dialog */}
      <Dialog.Root
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <Dialog size="xl" className="p-0 max-w-3xl sm:w-[768px] w-full max-h-[88vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-kumo-line px-6 sm:px-8 pt-6 sm:pt-8 pb-3.5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-kumo-fill text-kumo-default flex items-center justify-center shrink-0">
                <Lifebuoy className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-kumo-default">
                  Chi tiết phiếu sự cố dịch vụ
                </Dialog.Title>
                <div className="text-xs">
                  <Text variant="secondary">
                    Xem thông tin đầy đủ, lịch sử xử lý và trạng thái phiếu
                  </Text>
                </div>
              </div>
              {isLoadingDetail && (
                <ArrowsClockwise className="w-4 h-4 text-kumo-brand animate-spin ml-2" />
              )}
            </div>
            <Dialog.Close
              render={(props) => (
                <button
                  type="button"
                  {...props}
                  className="p-1.5 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-control cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-5">
            {selectedTicket && (
              <div className="space-y-4">
                {/* Header Information Card */}
                <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-base text-kumo-brand">
                      {selectedTicket.ticket_no}
                    </span>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(selectedTicket.priority)}
                      {getStatusBadge(selectedTicket.status)}
                    </div>
                  </div>
                  <div className="text-base font-semibold text-kumo-default leading-snug">
                    {selectedTicket.subject}
                  </div>
                </div>

                {/* 4-Item Grid Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-kumo-tint rounded-lg ring ring-kumo-line">
                  <div className="space-y-1">
                    <span className="text-xs text-kumo-subtle block font-medium">
                      Khách hàng gửi yêu cầu:
                    </span>
                    <span className="text-sm font-semibold text-kumo-default block">
                      {selectedTicket.customer?.full_name || 'Khách hàng'}
                    </span>
                    <span className="text-xs text-kumo-subtle block font-mono">
                      {selectedTicket.customer?.email || 'N/A'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-kumo-subtle block font-medium">
                      Vị trí kho ảnh hưởng:
                    </span>
                    <span className="text-sm font-semibold text-kumo-brand font-mono block whitespace-nowrap">
                      {selectedTicket.storage_unit?.code || 'Khu vực chung'}
                    </span>
                    <span className="text-xs text-kumo-subtle block">
                      {selectedTicket.facility?.name || 'Chi nhánh'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-kumo-subtle block font-medium">
                      Thời gian tạo phiếu:
                    </span>
                    <span className="text-sm font-medium text-kumo-default block">
                      {new Date(selectedTicket.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-kumo-subtle block font-medium">
                      Nhân viên phụ trách:
                    </span>
                    <span className="text-sm font-semibold text-kumo-default block">
                      {selectedTicket.assignee
                        ? selectedTicket.assignee.full_name
                        : 'Chưa phân công'}
                    </span>
                    {selectedTicket.assignee?.email && (
                      <span className="text-xs text-kumo-subtle block font-mono">
                        {selectedTicket.assignee.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Problem Description */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-kumo-default block">
                    Nội dung mô tả sự cố:
                  </span>
                  <div className="p-4 bg-kumo-base rounded-lg border border-kumo-line text-kumo-default text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Attachments */}
                {selectedTicket.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-kumo-default block">
                      Tệp đính kèm:
                    </span>
                    <div className="space-y-1.5">
                      {selectedTicket.attachments.map((a, idx) => {
                        const att = toAttachmentView(a, idx);
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2.5 bg-kumo-control rounded-lg border border-kumo-line text-xs"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-kumo-subtle shrink-0" />
                            {att.url ? (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-kumo-brand hover:underline truncate"
                              >
                                {att.name}
                              </a>
                            ) : (
                              <span className="font-medium text-kumo-default truncate">
                                {att.name}
                              </span>
                            )}
                            {att.size != null && (
                              <span className="ml-auto text-kumo-subtle shrink-0">
                                {formatFileSize(att.size)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Resolution note if any */}
                {selectedTicket.resolution && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-kumo-success block">
                      Kết quả xử lý & Ghi chú kỹ thuật:
                    </span>
                    <div className="p-4 bg-kumo-success-tint rounded-lg text-kumo-default text-sm leading-relaxed">
                      {selectedTicket.resolution}
                    </div>
                  </div>
                )}

                {/* History Timeline */}
                {selectedTicket.history && selectedTicket.history.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-semibold text-kumo-default block">
                      Nhật ký xử lý:
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedTicket.history.map((h, idx) => (
                        <div
                          key={`${h.at}-${idx}`}
                          className="flex items-center justify-between text-xs p-2.5 bg-kumo-control rounded-lg border border-kumo-line"
                        >
                          <span className="font-medium text-kumo-default">
                            {h.action === 'CREATED' && 'Tạo phiếu sự cố'}
                            {h.action === 'ASSIGNED' && `Phân công: ${resolveStaffLabel(h.to)}`}
                            {h.action === 'STATUS_CHANGED' &&
                              `Chuyển trạng thái: ${TICKET_STATUS_LABELS[h.to as TicketStatus] ?? h.to ?? ''}`}
                            {h.action === 'RESOLVED' && 'Đã xử lý xong'}
                            {h.action === 'PRIORITY_CHANGED' &&
                              `Đổi mức độ: ${TICKET_PRIORITY_LABELS[h.to as TicketPriority] ?? h.to ?? ''}`}
                            {![
                              'CREATED',
                              'ASSIGNED',
                              'STATUS_CHANGED',
                              'RESOLVED',
                              'PRIORITY_CHANGED',
                            ].includes(h.action) && h.action}
                          </span>
                          <span className="text-kumo-subtle font-mono text-[11px]">
                            {new Date(h.at).toLocaleDateString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit panel — managers/admins update processing fields */}
                {canEdit && !TERMINAL_STATUSES.includes(selectedTicket.status) && (
                  <div className="space-y-3 p-4 bg-kumo-control rounded-lg ring ring-kumo-line">
                    <span className="text-xs font-semibold text-kumo-default block">
                      Cập nhật xử lý
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select
                        label="Trạng thái"
                        value={editStatus}
                        onValueChange={(val) => val && setEditStatus(val as TicketStatus)}
                        items={statusEditOptions}
                      />
                      <Select
                        label="Mức độ ưu tiên"
                        value={editPriority}
                        onValueChange={(val) => val && setEditPriority(val as TicketPriority)}
                        items={priorityEditOptions}
                      />
                    </div>
                    <Textarea
                      label="Kết quả xử lý / Ghi chú kỹ thuật"
                      rows={3}
                      value={editResolution}
                      onChange={(e) => setEditResolution(e.target.value)}
                      placeholder="Ghi chú kết quả xử lý gửi khách hàng..."
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={!hasEditChanges}
                        loading={isSavingEdit}
                      >
                        Lưu thay đổi
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons — pinned footer, never scrolls away */}
          {selectedTicket && (
            <div className="px-6 sm:px-8 py-4 border-t border-kumo-line flex items-center justify-end gap-3 shrink-0">
              <Button variant="secondary" onClick={() => setSelectedTicket(null)}>
                Đóng
              </Button>
              {canAssign && CANCELLABLE_STATUSES.includes(selectedTicket.status) && (
                <Button
                  variant="secondary-destructive"
                  icon={<XCircle className="w-4 h-4" />}
                  onClick={() => setTicketToCancel(selectedTicket)}
                >
                  Hủy phiếu
                </Button>
              )}
              {canAssign && (
                <Button
                  variant="primary"
                  icon={<UserPlus className="w-4 h-4" />}
                  onClick={() => {
                    const t = selectedTicket;
                    setSelectedTicket(null);
                    handleOpenAssignModal(t);
                  }}
                >
                  {selectedTicket.assigned_to ? 'Chuyển ca trực' : 'Phân công ngay'}
                </Button>
              )}
            </div>
          )}
        </Dialog>
      </Dialog.Root>

      {/* Modal 3: Delete Confirmation Dialog */}
      <Dialog.Root
        open={Boolean(ticketToDelete)}
        onOpenChange={(open) => !open && !isDeleting && setTicketToDelete(null)}
      >
        <Dialog size="lg" className="p-6 max-w-lg sm:w-[500px] w-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-kumo-line pb-3">
              <div className="flex items-center gap-2">
                <WarningCircle className="w-5 h-5 text-kumo-danger" />
                <Dialog.Title className="text-base font-semibold text-kumo-default">
                  Xác nhận xóa phiếu sự cố
                </Dialog.Title>
              </div>
              <Dialog.Close
                render={(props) => (
                  <button
                    type="button"
                    {...props}
                    disabled={isDeleting}
                    className="p-1 rounded-md text-kumo-subtle hover:text-kumo-default cursor-pointer transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              />
            </div>

            {ticketToDelete && (
              <div className="space-y-3">
                <Text variant="secondary">
                  Bạn có chắc chắn muốn xóa vĩnh viễn phiếu sự cố này không? Thao tác này sẽ xóa
                  toàn bộ dữ liệu phiếu khỏi hệ thống và không thể hoàn tác.
                </Text>

                <div className="p-3 bg-kumo-danger-tint rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono font-semibold text-kumo-danger">
                    <span className="whitespace-nowrap">{ticketToDelete.ticket_no}</span>
                    <span className="whitespace-nowrap">
                      Kho: {ticketToDelete.storage_unit?.code || 'Chung'}
                    </span>
                  </div>
                  <div className="text-kumo-default font-medium line-clamp-2">
                    {ticketToDelete.subject}
                  </div>
                  <div className="text-kumo-subtle text-[11px]">
                    Khách báo: {ticketToDelete.customer?.full_name || 'Khách vãng lai'}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-kumo-line">
                  <Button
                    variant="secondary"
                    onClick={() => setTicketToDelete(null)}
                    disabled={isDeleting}
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    variant="destructive"
                    loading={isDeleting}
                    disabled={isDeleting}
                    icon={<Trash className="w-4 h-4" />}
                    onClick={handleConfirmDelete}
                  >
                    Xác nhận xóa
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Modal 4: Cancel Ticket Confirmation Dialog */}
      <Dialog.Root
        open={Boolean(ticketToCancel)}
        onOpenChange={(open) => !open && !isCancelling && setTicketToCancel(null)}
      >
        <Dialog size="lg" className="p-6 max-w-lg sm:w-[500px] w-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-kumo-line pb-3">
              <div className="flex items-center gap-2">
                <WarningCircle className="w-5 h-5 text-kumo-warning" />
                <Dialog.Title className="text-base font-semibold text-kumo-default">
                  Xác nhận hủy phiếu sự cố
                </Dialog.Title>
              </div>
              <Dialog.Close
                render={(props) => (
                  <button
                    type="button"
                    {...props}
                    disabled={isCancelling}
                    className="p-1 rounded-md text-kumo-subtle hover:text-kumo-default cursor-pointer transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              />
            </div>

            {ticketToCancel && (
              <div className="space-y-3">
                <Text variant="secondary">
                  Bạn có chắc chắn muốn hủy phiếu sự cố này không? Phiếu sẽ chuyển sang trạng thái
                  "Đã hủy" và không thể tiếp tục xử lý.
                </Text>

                <div className="p-3 bg-kumo-warning-tint rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono font-semibold text-kumo-warning">
                    <span className="whitespace-nowrap">{ticketToCancel.ticket_no}</span>
                    <span className="whitespace-nowrap">
                      Kho: {ticketToCancel.storage_unit?.code || 'Chung'}
                    </span>
                  </div>
                  <div className="text-kumo-default font-medium line-clamp-2">
                    {ticketToCancel.subject}
                  </div>
                  <div className="text-kumo-subtle text-[11px]">
                    Khách báo: {ticketToCancel.customer?.full_name || 'Khách vãng lai'}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-kumo-line">
                  <Button
                    variant="secondary"
                    onClick={() => setTicketToCancel(null)}
                    disabled={isCancelling}
                  >
                    Quay lại
                  </Button>
                  <Button
                    variant="destructive"
                    loading={isCancelling}
                    disabled={isCancelling}
                    icon={<XCircle className="w-4 h-4" />}
                    onClick={handleConfirmCancel}
                  >
                    Xác nhận hủy phiếu
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
