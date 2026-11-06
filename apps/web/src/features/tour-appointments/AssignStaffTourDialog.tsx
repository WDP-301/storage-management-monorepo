import { Button, Dialog, Text } from '@cloudflare/kumo';
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
import { StaffSelect } from '../../components/StaffSelect';
import { FacilitiesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import type { FacilityStaffMember } from '../../types/inspection';
import { formatTourDate } from './tour-display';

interface Props {
  open: boolean;
  appointment: TourAppointmentRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignStaffTourDialog: React.FC<Props> = ({
  open,
  appointment,
  onClose,
  onSuccess,
}) => {
  const toast = useAppToast();
  const [staffList, setStaffList] = useState<FacilityStaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !appointment) return;
    setSelectedStaffId(appointment.assignedTo || '');
    setIsLoadingStaff(true);
    FacilitiesApi.listStaff(appointment.facilityId)
      .then(setStaffList)
      .catch((err) =>
        toast.error(
          'Không tải được danh sách nhân viên',
          err instanceof Error ? err.message : 'Vui lòng thử lại.',
        ),
      )
      .finally(() => setIsLoadingStaff(false));
  }, [open, appointment, toast]);

  if (!appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      toast.warning('Chưa chọn nhân viên', 'Vui lòng chọn nhân viên phụ trách đón khách.');
      return;
    }

    setIsSubmitting(true);
    try {
      await TourAppointmentsApi.assign(appointment.id, { assignedTo: selectedStaffId });
      toast.success('Phân công thành công', 'Đã phân công nhân viên phụ trách ca dẫn khách.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        'Không thể phân công',
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
                Phân công nhân viên dẫn khách
              </Dialog.Title>
              <Text variant="secondary" size="xs">
                {appointment.fullName} · {formatTourDate(appointment.preferredDate)}{' '}
                {appointment.preferredTimeSlot ? `(${appointment.preferredTimeSlot})` : ''}
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
              </div>

              <div>
                <span className="block text-xs font-medium text-kumo-default mb-1.5">
                  Nhân viên phụ trách đón & dẫn khách <span className="text-kumo-danger">*</span>
                </span>
                {isLoadingStaff ? (
                  <Text variant="secondary" size="xs">
                    Đang tải danh sách nhân viên chi nhánh...
                  </Text>
                ) : (
                  <StaffSelect
                    ariaLabel="Chọn nhân viên dẫn khách"
                    staff={staffList}
                    value={selectedStaffId}
                    onChange={setSelectedStaffId}
                    placeholder="Chọn nhân viên trực ca"
                  />
                )}
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
              disabled={!selectedStaffId || isLoadingStaff}
            >
              Lưu phân công
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
