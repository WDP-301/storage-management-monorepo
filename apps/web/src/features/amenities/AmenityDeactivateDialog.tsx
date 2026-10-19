import { Button, Dialog, Text } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import React, { useState } from 'react';
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

  const confirm = async () => {
    if (!amenity) return;
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
    <Dialog.Root open={Boolean(amenity)} onOpenChange={(open) => !open && onClose()}>
      <Dialog size="base" className="p-6 max-w-md w-full">
        {amenity && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-kumo-warning-tint flex items-center justify-center shrink-0">
                <WarningCircle className="w-6 h-6 text-kumo-warning" />
              </div>
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Ngừng dùng tiện ích {amenity.name}
              </Dialog.Title>
            </div>
            <Text variant="secondary" size="sm">
              Tiện ích sẽ ẩn khỏi bộ lọc và danh sách chọn; các kho đang gắn vẫn giữ.
            </Text>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                Hủy bỏ
              </Button>
              <Button variant="destructive" onClick={confirm} loading={isSaving}>
                Xác nhận ngừng dùng
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Dialog.Root>
  );
};
