import {
  Badge,
  Button,
  Dialog,
  InputGroup,
  LayerCard,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import { TicketPriority, TicketStatus } from '@storage/types';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TicketsApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { ServiceTicketRecord, TicketUserInfo } from '../../types/service-tickets';

export const ManagerTicketsPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useAppToast();
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Modal states
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicketRecord | null>(null);
  const [assignModalTicket, setAssignModalTicket] = useState<ServiceTicketRecord | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<ServiceTicketRecord | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const availableStaff = useMemo(() => {
    const existingAssignees = tickets
      .map((t) => t.assignee)
      .filter((a): a is TicketUserInfo => Boolean(a?.id));
    return Array.from(new Map(existingAssignees.map((a) => [a.id, a])).values());
  }, [tickets]);

  const loadTickets = async () => {
    setIsLoading(true);
    setActionErrorMessage(null);
    try {
      const res = await TicketsApi.getAll();
      setTickets(res?.tickets || []);
    } catch (err: unknown) {
      setTickets([]);
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Không thể tải danh sách phiếu sự cố từ hệ thống.';
      setActionErrorMessage(msg);
      toast.error('Lỗi tải dữ liệu', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleOpenDetailModal = async (ticket: ServiceTicketRecord) => {
    setSelectedTicket(ticket);
    setIsLoadingDetail(true);
    try {
      const freshTicket = await TicketsApi.getOne(ticket.id);
      setSelectedTicket(freshTicket);
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
      const chosenStaff = availableStaff.find((s) => s.id === selectedStaffId);
      const staffName = chosenStaff?.full_name || 'Nhân viên';
      const updatedTicket = await TicketsApi.assign(assignModalTicket.id, selectedStaffId);

      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === assignModalTicket.id) {
            const nextStatus = t.status === TicketStatus.OPEN ? TicketStatus.ASSIGNED : t.status;
            return {
              ...t,
              ...updatedTicket,
              assigned_to: selectedStaffId,
              status: updatedTicket?.status ?? nextStatus,
              assignee: updatedTicket?.assignee ??
                chosenStaff ?? {
                  id: selectedStaffId,
                  full_name: staffName,
                  email: 'staff@storagehub.vn',
                },
              history: updatedTicket?.history ?? [
                ...(t.history || []),
                {
                  action: 'ASSIGNED',
                  to: staffName,
                  at: new Date().toISOString(),
                  by: user?.fullName || 'Manager',
                },
              ],
            };
          }
          return t;
        }),
      );

      const successMsg = `Đã phân công vé ${assignModalTicket.ticket_no} cho nhân viên ${staffName} thành công.`;
      setActionSuccessMessage(successMsg);
      toast.success('Phân công thành công', successMsg);
      setAssignModalTicket(null);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      let msg = 'Lỗi khi phân công nhân viên.';
      if (axios.isAxiosError(err)) {
        const serverMsg = err.response?.data?.message;
        if (typeof serverMsg === 'string') {
          msg = serverMsg;
        } else if (Array.isArray(serverMsg) && serverMsg.length > 0) {
          msg = serverMsg.join(', ');
        } else if (err.response?.status === 403) {
          msg = 'Tài khoản không có quyền phân công (yêu cầu vai trò Quản lý cơ sở của cơ sở này).';
        } else if (err.response?.status === 404) {
          msg = 'Không tìm thấy phiếu sự cố hoặc nhân viên kỹ thuật trên hệ thống.';
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
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

      setTickets((prev) => prev.filter((t) => t.id !== targetTicket.id));
      const deleteMsg = `Đã xóa phiếu sự cố ${targetTicket.ticket_no} thành công.`;
      setActionSuccessMessage(deleteMsg);
      toast.notifyDeleted('phiếu sự cố', targetTicket.ticket_no);
      setTicketToDelete(null);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      let msg = 'Lỗi khi xóa vé sự cố.';
      if (axios.isAxiosError(err)) {
        const serverMsg = err.response?.data?.message;
        if (err.response?.status === 403) {
          msg =
            'Tài khoản không có quyền xóa phiếu sự cố này (yêu cầu vai trò Quản trị viên hoặc Quản lý cơ sở của cơ sở này).';
        } else if (typeof serverMsg === 'string') {
          msg = serverMsg;
        } else if (Array.isArray(serverMsg) && serverMsg.length > 0) {
          msg = serverMsg.join(', ');
        } else if (err.response?.status === 404) {
          msg = 'Không tìm thấy phiếu sự cố trên hệ thống.';
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setActionErrorMessage(msg);
      toast.error('Xóa vé thất bại', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics calculation
  const totalTickets = tickets.length;
  const unassignedCount = tickets.filter(
    (t) => t.status === TicketStatus.OPEN || !t.assigned_to,
  ).length;
  const inProgressCount = tickets.filter(
    (t) => t.status === TicketStatus.ASSIGNED || t.status === TicketStatus.IN_PROGRESS,
  ).length;
  const resolvedCount = tickets.filter(
    (t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED,
  ).length;

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        t.ticket_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(t.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        Boolean(t.storage_unit?.code?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'UNASSIGNED' && (!t.assigned_to || t.status === TicketStatus.OPEN)) ||
        t.status === statusFilter;

      const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

      return matchSearch && matchStatus && matchPriority;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case TicketPriority.URGENT:
        return (
          <Badge
            variant="neutral"
            className="bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200/80 font-semibold"
          >
            Khẩn cấp
          </Badge>
        );
      case TicketPriority.HIGH:
        return (
          <Badge
            variant="neutral"
            className="bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200/80 font-medium"
          >
            Ưu tiên cao
          </Badge>
        );
      case TicketPriority.NORMAL:
        return (
          <Badge
            variant="neutral"
            className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 font-medium"
          >
            Bình thường
          </Badge>
        );
      case TicketPriority.LOW:
        return (
          <Badge variant="neutral" className="text-kumo-subtle font-medium">
            Thấp
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" className="text-kumo-subtle font-medium">
            Bình thường
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.OPEN:
        return (
          <Badge
            variant="neutral"
            className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 font-medium"
          >
            Chờ phân công
          </Badge>
        );
      case TicketStatus.ASSIGNED:
        return (
          <Badge
            variant="neutral"
            className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 font-medium"
          >
            Đã gán ca
          </Badge>
        );
      case TicketStatus.IN_PROGRESS:
        return (
          <Badge
            variant="neutral"
            className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 font-medium"
          >
            Đang xử lý
          </Badge>
        );
      case TicketStatus.RESOLVED:
        return (
          <Badge variant="success" className="font-medium">
            Đã giải quyết
          </Badge>
        );
      case TicketStatus.CLOSED:
        return (
          <Badge
            variant="neutral"
            className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium"
          >
            Đã đóng
          </Badge>
        );
      case TicketStatus.CANCELLED:
        return (
          <Badge
            variant="neutral"
            className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 font-medium"
          >
            Đã hủy
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const statusOptions = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'UNASSIGNED', label: 'Chờ phân công' },
    { value: TicketStatus.ASSIGNED, label: 'Đã gán ca' },
    { value: TicketStatus.IN_PROGRESS, label: 'Đang xử lý' },
    { value: TicketStatus.RESOLVED, label: 'Đã giải quyết' },
    { value: TicketStatus.CLOSED, label: 'Đã đóng' },
  ];

  const priorityOptions = [
    { value: 'ALL', label: 'Tất cả mức độ' },
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
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <LifeBuoy className="w-5 h-5" />
            </span>
            <Text as="h2">Quản lý sự cố & Phiếu dịch vụ</Text>
            <Badge
              variant="neutral"
              className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 font-medium"
            >
              Manager Tickets
            </Badge>
          </div>
          <Text variant="secondary">
            Tiếp nhận báo cáo sự cố kho từ khách hàng, theo dõi tiến độ và phân công nhân viên kỹ
            thuật giải quyết.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadTickets}
            disabled={isLoading}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-kumo-info-tint text-kumo-info rounded-lg text-sm flex items-center gap-2.5 ring ring-kumo-line">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-kumo-brand" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-3.5 bg-red-500/10 text-red-500 rounded-lg text-sm flex items-center gap-2.5 ring ring-red-500/20">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span className="font-medium">{actionErrorMessage}</span>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tổng số phiếu sự cố</Text>
            <LifeBuoy className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{totalTickets}</span>
            <span className="text-xs text-kumo-subtle">vé ghi nhận</span>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Chờ phân công</Text>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {unassignedCount}
            </span>
            <Badge
              variant="neutral"
              className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 font-medium"
            >
              Cần gán ca
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đang tiến hành xử lý</Text>
            <Wrench className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-sky-600 dark:text-sky-400">
              {inProgressCount}
            </span>
            <Badge
              variant="neutral"
              className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 font-medium"
            >
              Kỹ thuật đang làm
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đã xử lý dứt điểm</Text>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {resolvedCount}
            </span>
            <Badge variant="success" className="font-medium">
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
              onValueChange={(val) => val && setStatusFilter(String(val))}
              items={statusOptions}
              renderValue={(val) =>
                statusOptions.find((o) => o.value === val)?.label || 'Trạng thái'
              }
            >
              {statusOptions.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Priority Select */}
          <div className="w-44">
            <Select
              aria-label="Lọc mức độ ưu tiên"
              value={priorityFilter}
              onValueChange={(val) => val && setPriorityFilter(String(val))}
              items={priorityOptions}
              renderValue={(val) =>
                priorityOptions.find((o) => o.value === val)?.label || 'Độ ưu tiên'
              }
            >
              {priorityOptions.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>

        {/* Search Input using Kumo InputGroup */}
        <div className="w-full sm:w-72">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <Search className="w-4 h-4 text-kumo-subtle" />
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
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span
                            className="truncate max-w-[140px]"
                            title={ticket.assignee.full_name}
                          >
                            {ticket.assignee.full_name.split(' (')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium italic flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          Chưa phân công
                        </span>
                      )}
                    </Table.Cell>

                    {/* Actions */}
                    <Table.Cell className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => handleOpenDetailModal(ticket)}
                        >
                          Chi tiết
                        </Button>

                        <Button
                          size="xs"
                          variant={hasAssignee ? 'secondary' : 'primary'}
                          icon={<UserPlus className="w-3 h-3" />}
                          onClick={() => handleOpenAssignModal(ticket)}
                        >
                          {hasAssignee ? 'Đổi ca' : 'Phân công'}
                        </Button>

                        <Button
                          size="xs"
                          variant="secondary-destructive"
                          icon={<Trash2 className="w-3 h-3" />}
                          onClick={() => setTicketToDelete(ticket)}
                          aria-label={`Xóa vé ${ticket.ticket_no}`}
                        >
                          Xóa
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </LayerCard>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-kumo-subtle pt-2 border-t border-kumo-line">
        <span>
          Đang hiển thị {filteredTickets.length} / {totalTickets} phiếu sự cố
        </span>
      </div>

      {/* Modal 1: Assign Staff Dialog */}
      <Dialog.Root
        open={Boolean(assignModalTicket)}
        onOpenChange={(open) => !open && setAssignModalTicket(null)}
      >
        <Dialog size="xl" className="p-6 sm:p-7 max-w-2xl sm:w-[640px] w-full">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-kumo-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-kumo-brand/10 text-kumo-brand flex items-center justify-center shrink-0">
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
                    <span className="font-mono font-bold text-sm text-kumo-brand">
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
                  <div className="text-xs text-kumo-subtle bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg border border-blue-200/60 dark:border-blue-800/60 flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
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
        <Dialog
          size="xl"
          className="p-6 sm:p-8 max-w-3xl sm:w-[768px] w-full max-h-[88vh] overflow-y-auto"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-kumo-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-kumo-brand/10 text-kumo-brand flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-5 h-5" />
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
                  <RefreshCw className="w-4 h-4 text-kumo-brand animate-spin ml-2" />
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

            {selectedTicket && (
              <div className="space-y-4">
                {/* Header Information Card */}
                <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-base text-kumo-brand">
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
                    <span className="text-sm font-bold text-kumo-brand font-mono block whitespace-nowrap">
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

                {/* Resolution note if any */}
                {selectedTicket.resolution && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                      Kết quả xử lý & Ghi chú kỹ thuật:
                    </span>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm leading-relaxed">
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
                            {h.action === 'ASSIGNED' && `Phân công: ${h.to || ''}`}
                            {h.action === 'STATUS_CHANGED' && `Chuyển trạng thái: ${h.to || ''}`}
                            {h.action === 'RESOLVED' && 'Đã xử lý xong'}
                            {!['CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'RESOLVED'].includes(
                              h.action,
                            ) && h.action}
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

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-kumo-line">
                  <Button variant="secondary" onClick={() => setSelectedTicket(null)}>
                    Đóng
                  </Button>
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
                </div>
              </div>
            )}
          </div>
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
                <span className="h-lh flex items-center text-kumo-danger">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </span>
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

                <div className="p-3 bg-red-500/10 rounded-lg ring ring-red-500/20 text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono font-semibold text-red-700 dark:text-red-400">
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
                    icon={<Trash2 className="w-4 h-4" />}
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
    </div>
  );
};
