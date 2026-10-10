import { Button, Dialog, Text } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import React, { useState } from 'react';
import { FacilitiesApi, type FacilityRecord } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import { describeFacilityError } from './facility-form';

interface Props {
  facility: FacilityRecord | null;
  onClose: () => void;
  onDone: () => void;
}

export const FacilityDeactivateDialog: React.FC<Props> = ({ facility, onClose, onDone }) => {
  const toast = useAppToast();
  const [isSaving, setIsSaving] = useState(false);

  const confirm = async () => {
    if (!facility) return;
    setIsSaving(true);
    try {
      await FacilitiesApi.update(facility.id, { status: 'INACTIVE' });
      toast.info('Ngừng hoạt động chi nhánh', `Đã ngừng hoạt động chi nhánh ${facility.code}.`);
      onDone();
    } catch (err) {
      toast.error(
        'Không thể ngừng hoạt động chi nhánh',
        describeFacilityError(err, 'Vui lòng thử lại.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={Boolean(facility)} onOpenChange={(open) => !open && onClose()}>
      <Dialog size="base" className="p-6 max-w-md w-full">
        {facility && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-kumo-warning-tint flex items-center justify-center shrink-0">
                <WarningCircle className="w-6 h-6 text-kumo-warning" />
              </div>
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Ngừng hoạt động chi nhánh
              </Dialog.Title>
            </div>
            <Text variant="secondary" size="sm">
              Các kho của chi nhánh <strong>{facility.name}</strong> sẽ không còn hiển thị cho khách
              đặt thuê hay hẹn xem kho. Hợp đồng đang chạy không bị ảnh hưởng. Có thể kích hoạt lại
              bất cứ lúc nào.
            </Text>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                Hủy bỏ
              </Button>
              <Button variant="destructive" onClick={confirm} loading={isSaving}>
                Ngừng hoạt động
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Dialog.Root>
  );
};
