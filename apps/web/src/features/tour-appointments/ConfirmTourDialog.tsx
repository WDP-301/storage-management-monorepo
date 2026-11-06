import { Button, Dialog, Input, Text, Textarea } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import type { TourAppointmentRecord } from '@storage/types';
import React, { useEffect, useState } from 'react';
import {
  DIALOG_FORM,
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { useAppToast } from '../../lib/toast';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';

interface Props {
  open: boolean;
  appointment: TourAppointmentRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConfirmTourDialog: React.FC<Props> = ({ open, appointment, onClose, onSuccess }) => {
  const toast = useAppToast();
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (appointment) {
      setPreferredDate(appointment.preferredDate || '');
      setPreferredTimeSlot(appointment.preferredTimeSlot || '');
      setManagerNotes(appointment.managerNotes || '');
    }
  }, [appointment]);

  if (!appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferredDate) {
      toast.warning('Thiếu ngày hẹn', 'Vui lòng chọn ngày hẹn chính thức.');
      return;
    }

    setIsSubmitting(true);
    try {
      await TourAppointmentsApi.confirm(appointment.id, {
        preferredDate,
        preferredTimeSlot: preferredTimeSlot.trim() || undefined,
        managerNotes: managerNotes.trim() || undefined,
      });
      toast.success('Xác nhận thành công', 'Đã cập nhật và xác nhận lịch hẹn với khách hàng.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        'Không thể xác nhận',
        err instanceof Error ? err.message : 'Vui lòng thử lại sau.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <Dialog size="base" className={`${DIALOG_SHELL} max-w-lg w-full`}>
        <form onSubmit={handleSubmit} className={DIALOG_FORM}>
          <DialogHeader>
            <div className="grid gap-0.5">
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Xác nhận lịch hẹn xem kho
              </Dialog.Title>
              <Text variant="secondary" size="xs">
                Khách hàng: {appointment.fullName} · {appointment.phone}
              </Text>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Đóng"
              icon={<X />}
              onClick={onClose}
            />
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              <div className="p-3 bg-kumo-subtle/10 rounded-md border border-kumo-line text-xs space-y-1">
                <div>
                  <span className="text-kumo-secondary font-medium">Chi nhánh: </span>
                  <span className="text-kumo-default">{appointment.facility?.name || '—'}</span>
                </div>
                {appointment.storageUnit && (
                  <div>
                    <span className="text-kumo-secondary font-medium">Kho mẫu: </span>
                    <span className="text-kumo-default">
                      {appointment.storageUnit.name} ({appointment.storageUnit.code})
                    </span>
                  </div>
                )}
                {appointment.customerNotes && (
                  <div>
                    <span className="text-kumo-secondary font-medium">Lời nhắn của khách: </span>
                    <span className="text-kumo-default">{appointment.customerNotes}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="block text-xs font-medium text-kumo-default mb-1.5">
                  Ngày hẹn chính thức <span className="text-kumo-danger">*</span>
                </span>
                <Input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-kumo-default mb-1.5">
                  Khung giờ hẹn đã thống nhất
                </span>
                <Input
                  type="text"
                  placeholder="Ví dụ: 09:30 - 10:30 hoặc Sáng 10h"
                  value={preferredTimeSlot}
                  onChange={(e) => setPreferredTimeSlot(e.target.value)}
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-kumo-default mb-1.5">
                  Ghi chú của Quản lý chi nhánh
                </span>
                <Textarea
                  rows={3}
                  placeholder="Nội dung đã trao đổi với khách, yêu cầu đặc biệt..."
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Lưu xác nhận
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
