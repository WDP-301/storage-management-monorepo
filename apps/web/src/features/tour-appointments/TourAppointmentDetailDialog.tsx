import { Badge, Button, Dialog, Text } from '@cloudflare/kumo';
import {
  CalendarBlank,
  CheckCircle,
  Clock,
  Envelope,
  MapPin,
  Phone,
  User,
  UserCheck,
  UserPlus,
  Warehouse,
  X,
  XCircle,
} from '@phosphor-icons/react';
import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
import React from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import {
  formatTourDate,
  formatTourDateTime,
  TOUR_STATUS_LABELS,
  TOUR_STATUS_VARIANTS,
} from './tour-display';

interface Props {
  open: boolean;
  appointment: TourAppointmentRecord | null;
  onClose: () => void;
  onConfirm: (apt: TourAppointmentRecord) => void;
  onAssign: (apt: TourAppointmentRecord) => void;
  onComplete: (apt: TourAppointmentRecord) => void;
  onCancel: (apt: TourAppointmentRecord) => void;
}

export const TourAppointmentDetailDialog: React.FC<Props> = ({
  open,
  appointment,
  onClose,
  onConfirm,
  onAssign,
  onComplete,
  onCancel,
}) => {
  if (!appointment) return null;

  const isTerminal =
    appointment.status === TourAppointmentStatus.COMPLETED ||
    appointment.status === TourAppointmentStatus.CANCELLED;
  const canConfirm = !isTerminal;
  const canAssign = !isTerminal;
  const canComplete =
    appointment.status === TourAppointmentStatus.ASSIGNED ||
    appointment.status === TourAppointmentStatus.CONFIRMED;
  const canCancel = !isTerminal;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      className={`${DIALOG_SHELL} max-w-xl`}
    >
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Text variant="heading" size="md">
            Chi tiết lịch xem kho
          </Text>
          <Badge variant={TOUR_STATUS_VARIANTS[appointment.status]}>
            {TOUR_STATUS_LABELS[appointment.status]}
          </Badge>
        </div>
        <Button type="button" variant="ghost" aria-label="Đóng" icon={<X />} onClick={onClose} />
      </DialogHeader>

      <DialogBody>
        <div className="space-y-5">
          {/* Section 1: Customer Contact */}
          <div className="rounded-lg border border-kumo-line bg-kumo-subtle/5 p-4 space-y-3">
            <Text
              variant="heading"
              size="xs"
              className="text-kumo-default flex items-center gap-1.5"
            >
              <User className="w-4 h-4 text-kumo-brand" />
              Thông tin khách hàng
            </Text>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-kumo-secondary block">Họ và tên</span>
                <span className="font-medium text-kumo-default">{appointment.fullName}</span>
              </div>
              <div>
                <span className="text-xs text-kumo-secondary block">Số điện thoại</span>
                <a
                  href={`tel:${appointment.phone}`}
                  className="font-medium text-kumo-brand hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {appointment.phone}
                </a>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs text-kumo-secondary block">Email liên hệ</span>
                <a
                  href={`mailto:${appointment.email}`}
                  className="font-medium text-kumo-brand hover:underline flex items-center gap-1"
                >
                  <Envelope className="w-3.5 h-3.5" />
                  {appointment.email}
                </a>
              </div>
            </div>
          </div>

          {/* Section 2: Appointment Time & Target Warehouse */}
          <div className="rounded-lg border border-kumo-line bg-kumo-subtle/5 p-4 space-y-3">
            <Text
              variant="heading"
              size="xs"
              className="text-kumo-default flex items-center gap-1.5"
            >
              <CalendarBlank className="w-4 h-4 text-kumo-brand" />
              Thời gian & Địa điểm tham quan
            </Text>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-kumo-secondary block">Chi nhánh</span>
                <span className="font-medium text-kumo-default flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-kumo-secondary" />
                  {appointment.facility?.name || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-kumo-secondary block">Phòng kho mẫu quan tâm</span>
                <span className="font-medium text-kumo-default flex items-center gap-1">
                  <Warehouse className="w-3.5 h-3.5 text-kumo-secondary" />
                  {appointment.storageUnit
                    ? `${appointment.storageUnit.name} (${appointment.storageUnit.code})`
                    : 'Xem tổng thể chi nhánh'}
                </span>
              </div>
              <div>
                <span className="text-xs text-kumo-secondary block">Ngày hẹn</span>
                <span className="font-medium text-kumo-default">
                  {formatTourDate(appointment.preferredDate)}
                </span>
              </div>
              <div>
                <span className="text-xs text-kumo-secondary block">Khung giờ hẹn</span>
                <span className="font-medium text-kumo-default flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-kumo-secondary" />
                  {appointment.preferredTimeSlot || 'Chưa định khung giờ'}
                </span>
              </div>
            </div>
            {appointment.customerNotes && (
              <div className="pt-2 border-t border-kumo-line text-sm">
                <span className="text-xs text-kumo-secondary block mb-1">Lời nhắn của khách:</span>
                <p className="p-2.5 rounded bg-kumo-base border border-kumo-line text-kumo-default italic text-xs">
                  "{appointment.customerNotes}"
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Manager Confirmation & Notes */}
          {appointment.managerNotes && (
            <div className="rounded-lg border border-kumo-info/30 bg-kumo-info/5 p-4 space-y-1.5">
              <span className="text-xs font-medium text-kumo-info block">
                Ghi chú của Quản lý chi nhánh:
              </span>
              <p className="text-sm text-kumo-default">{appointment.managerNotes}</p>
            </div>
          )}

          {/* Section 4: Assignee Info */}
          <div className="rounded-lg border border-kumo-line bg-kumo-subtle/5 p-4 space-y-2">
            <Text
              variant="heading"
              size="xs"
              className="text-kumo-default flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-kumo-brand" />
              Nhân viên phụ trách đón tiếp
            </Text>
            {appointment.assignee ? (
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-kumo-default">
                    {appointment.assignee.fullName}
                  </span>
                  <span className="text-xs text-kumo-secondary block">
                    {appointment.assignee.email}
                  </span>
                </div>
                {appointment.assignee.phone && (
                  <a
                    href={`tel:${appointment.assignee.phone}`}
                    className="text-xs font-medium text-kumo-brand hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {appointment.assignee.phone}
                  </a>
                )}
              </div>
            ) : (
              <Text variant="secondary" size="xs">
                Chưa phân công nhân viên phụ trách ca này.
              </Text>
            )}
          </div>

          {/* Section 5: Staff Result Notes (if completed) */}
          {appointment.staffResultNotes && (
            <div className="rounded-lg border border-kumo-success/30 bg-kumo-success/5 p-4 space-y-1.5">
              <span className="text-xs font-medium text-kumo-success flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Kết quả ca tư vấn dẫn khách:
              </span>
              <p className="text-sm text-kumo-default">{appointment.staffResultNotes}</p>
            </div>
          )}

          {/* Section 6: Cancellation Reason (if cancelled) */}
          {appointment.cancellationReason && (
            <div className="rounded-lg border border-kumo-danger/30 bg-kumo-danger/5 p-4 space-y-1.5">
              <span className="text-xs font-medium text-kumo-danger flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                Lý do hủy / Báo vắng mặt (No-show):
              </span>
              <p className="text-sm text-kumo-default">{appointment.cancellationReason}</p>
            </div>
          )}

          <div className="text-[11px] text-kumo-secondary flex justify-between pt-1">
            <span>Thời gian gửi yêu cầu: {formatTourDateTime(appointment.createdAt)}</span>
            <span>Cập nhật lần cuối: {formatTourDateTime(appointment.updatedAt)}</span>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <div className="flex items-center justify-between w-full">
          <div>
            {canCancel && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  onClose();
                  onCancel(appointment);
                }}
              >
                Hủy lịch hẹn
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canConfirm && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  onConfirm(appointment);
                }}
              >
                {appointment.status === TourAppointmentStatus.PENDING
                  ? 'Xác nhận lịch'
                  : 'Đổi giờ hẹn'}
              </Button>
            )}
            {canAssign && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<UserPlus />}
                onClick={() => {
                  onClose();
                  onAssign(appointment);
                }}
              >
                {appointment.assignedTo ? 'Đổi nhân viên' : 'Gán nhân viên'}
              </Button>
            )}
            {canComplete && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<CheckCircle />}
                onClick={() => {
                  onClose();
                  onComplete(appointment);
                }}
              >
                Hoàn tất ca
              </Button>
            )}
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
};
