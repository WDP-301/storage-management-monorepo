import { Button, Dialog, Text } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { AmenitiesApi } from '../../lib/amenities-api';
import { useAppToast } from '../../lib/toast';
import type { Amenity } from '../../types/amenity';
import { describeAmenityError } from './amenity-form';

interface Props {
  amenity: Amenity | null;
  onClose: () => void;
  onDone: () => void;
}

export const AmenityDeactivateDialog: React.FC<Props> = ({ amenity, onClose, onDone }) => {
  const toast = useAppToast();
  const [isSaving, setIsSaving] = useState(false);

  const amenityId = amenity?.id ?? null;

  // Saving belongs to one amenity's request; reset when the target changes so it cannot leak across.
  useEffect(() => {
    setIsSaving(false);
  }, [amenityId]);

  const requestClose = () => {
    // Closing mid-request would let its completion dismiss a dialog opened for another amenity.
    if (!isSaving) onClose();
  };

  const confirm = async () => {
    if (!amenity || isSaving) return;
    setIsSaving(true);
    try {
      await AmenitiesApi.update(amenity.id, { isActive: false });
      toast.info('Ngừng dùng tiện ích', `Đã ngừng dùng tiện ích ${amenity.code}.`);
      onDone();
    } catch (err) {
      toast.error('Không thể ngừng dùng tiện ích', describeAmenityError(err, 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={Boolean(amenity)} onOpenChange={(open) => !open && requestClose()}>
      <Dialog size="base" className={`${DIALOG_SHELL} max-w-md w-full`}>
        {amenity && (
          <>
            <DialogHeader className="justify-start">
              <div className="w-10 h-10 rounded-full bg-kumo-warning-tint flex items-center justify-center shrink-0">
                <WarningCircle className="w-6 h-6 text-kumo-warning" />
              </div>
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Ngừng dùng tiện ích {amenity.name}
              </Dialog.Title>
            </DialogHeader>
            <DialogBody>
              <Text variant="secondary" size="sm">
                Tiện ích sẽ ẩn khỏi bộ lọc và danh sách chọn. Ngừng dùng không gỡ tiện ích khỏi các
                kho đang có — nếu thiết bị đã được tháo khỏi một kho cụ thể, hãy gỡ tiện ích trong
                phần sửa kho đó.
              </Text>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={requestClose} disabled={isSaving}>
                Hủy bỏ
              </Button>
              <Button variant="destructive" onClick={confirm} loading={isSaving}>
                Xác nhận ngừng dùng
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </Dialog.Root>
  );
};
