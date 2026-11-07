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

export const CompleteTourDialog: React.FC<Props> = ({ open, appointment, onClose, onSuccess }) => {
  const toast = useAppToast();
  const [staffResultNotes, setStaffResultNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffResultNotes.trim()) {
      toast.warning('Thiếu ghi chú', 'Vui lòng nhập ghi chú kết quả tư vấn sau ca dẫn khách.');
      return;
    }

    setIsSubmitting(true);
    try {
      await TourAppointmentsApi.complete(appointment.id, {
        staffResultNotes: staffResultNotes.trim(),
      });
      toast.success('Hoàn tất thành công', 'Đã ghi nhận kết quả ca dẫn khách tham quan kho.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        'Không thể hoàn tất',
        err instanceof Error ? err.message : 'Vui lòng kiểm tra lại quyền hạn hoặc trạng thái.',
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
                Hoàn tất ca dẫn khách
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
                <span className="block text-xs font-medium text-kumo-default mb-1.5">
                  Ghi chú kết quả tư vấn & Phản hồi của khách{' '}
                  <span className="text-kumo-danger">*</span>
                </span>
                <Textarea
                  rows={4}
                  placeholder="Ví dụ: Khách ưng ý phòng U-102 và độ an ninh. Khách dự kiến ký hợp đồng vào ngày mai..."
                  value={staffResultNotes}
                  onChange={(e) => setStaffResultNotes(e.target.value)}
                  required
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!staffResultNotes.trim()}
            >
              Lưu hoàn tất
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
