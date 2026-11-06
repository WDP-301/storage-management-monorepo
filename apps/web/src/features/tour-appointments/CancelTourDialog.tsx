import { Button, Dialog, Text, Textarea } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import type { TourAppointmentRecord } from '@storage/types';
import React, { useState } from 'react';
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

const QUICK_REASONS = [
  'Đã đợi 30 phút, gọi điện khách không nghe máy (No-show)',
  'Khách gọi điện xin hủy hẹn vì bận việc đột xuất',
  'Không thể liên lạc được với khách hàng qua số điện thoại/email',
  'Khách đã tìm được giải pháp lưu trữ khác',
];

export const CancelTourDialog: React.FC<Props> = ({ open, appointment, onClose, onSuccess }) => {
  const toast = useAppToast();
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      toast.warning(
        'Thiếu lý do',
        'Vui lòng nhập lý do hủy lịch hẹn hoặc ghi chú khách không đến.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await TourAppointmentsApi.cancel(appointment.id, {
        cancellationReason: cancellationReason.trim(),
      });
      toast.success('Hủy lịch thành công', 'Đã cập nhật trạng thái hủy cuộc hẹn.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        'Không thể hủy',
        err instanceof Error ? err.message : 'Vui lòng kiểm tra lại trạng thái cuộc hẹn.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <Dialog size="base" className={`${DIALOG_SHELL} max-w-md w-full`}>
        <form onSubmit={handleSubmit} className={DIALOG_FORM}>
          <DialogHeader>
            <div className="grid gap-0.5">
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Hủy lịch hẹn / Báo khách vắng (No-show)
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
              <div>
                <label className="block text-xs font-medium text-kumo-default mb-1.5">
                  Gợi ý lý do nhanh:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setCancellationReason(reason)}
                      className="text-xs px-2.5 py-1 rounded bg-kumo-subtle/10 hover:bg-kumo-subtle/20 border border-kumo-line text-kumo-default text-left transition-colors cursor-pointer"
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-medium text-kumo-default mb-1.5">
                  Lý do hủy hoặc ghi chú vắng mặt <span className="text-kumo-danger">*</span>
                </label>
                <Textarea
                  rows={3}
                  placeholder="Nhập chi tiết lý do hủy..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  required
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Quay lại
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={isSubmitting}
              disabled={!cancellationReason.trim()}
            >
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
