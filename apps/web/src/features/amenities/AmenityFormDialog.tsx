import { Button, Dialog, Input, InputArea } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import {
  DIALOG_FORM,
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { AmenitiesApi } from '../../lib/amenities-api';
import { useAppToast } from '../../lib/toast';
import type { Amenity } from '../../types/amenity';
import {
  type AmenityFormState,
  buildAmenityPatch,
  buildAmenityPayload,
  describeAmenityError,
  EMPTY_AMENITY_FORM,
  MAX_DESCRIPTION,
  MAX_NAME,
  normalizeCode,
  toAmenityFormState,
  validateAmenityForm,
} from './amenity-form';

interface Props {
  open: boolean;
  /** Amenity being edited; null opens the create form. */
  amenity: Amenity | null;
  onClose: () => void;
  onSaved: (saved: Amenity, created: boolean) => void;
}

export const AmenityFormDialog: React.FC<Props> = ({ open, amenity, onClose, onSaved }) => {
  const toast = useAppToast();
  const [form, setForm] = useState<AmenityFormState>(EMPTY_AMENITY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = amenity !== null;

  useEffect(() => {
    if (open) setForm(amenity ? toAmenityFormState(amenity) : EMPTY_AMENITY_FORM);
  }, [open, amenity]);

  const set = <K extends keyof AmenityFormState>(key: K, value: AmenityFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateAmenityForm(form, isEdit);
    if (problem) {
      toast.warning('Thông tin chưa hợp lệ', problem);
      return;
    }
    // Nothing edited: skip the request instead of sending an empty PATCH.
    const patch = amenity ? buildAmenityPatch(form, amenity) : null;
    if (amenity && patch && Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      const saved =
        amenity && patch
          ? await AmenitiesApi.update(amenity.id, patch)
          : await AmenitiesApi.create(buildAmenityPayload(form));
      onSaved(saved, !isEdit);
    } catch (err) {
      toast.error(
        isEdit ? 'Lỗi cập nhật tiện ích' : 'Lỗi tạo tiện ích',
        describeAmenityError(err, 'Không thể lưu tiện ích. Vui lòng thử lại.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog size="base" className={`${DIALOG_SHELL} max-w-lg w-full`}>
        <form onSubmit={handleSubmit} className={DIALOG_FORM}>
          <DialogHeader>
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              {isEdit ? `Chỉnh sửa tiện ích ${amenity.code}` : 'Thêm tiện ích'}
            </Dialog.Title>
            <Dialog.Close
              render={(props) => (
                <button
                  type="button"
                  {...props}
                  className="p-1.5 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-control cursor-pointer transition"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            />
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Input
              label="Mã tiện ích"
              className="w-full"
              value={form.code}
              disabled={isEdit}
              maxLength={50}
              description={isEdit ? 'Mã không đổi được sau khi tạo.' : 'Ví dụ: AIR_CON, CCTV.'}
              onChange={(e) => set('code', normalizeCode(e.target.value))}
            />
            <Input
              label="Tên tiện ích"
              className="w-full"
              value={form.name}
              maxLength={MAX_NAME}
              onChange={(e) => set('name', e.target.value)}
            />
            <InputArea
              label="Mô tả"
              value={form.description}
              minRows={2}
              maxLength={MAX_DESCRIPTION}
              onChange={(e) => set('description', e.target.value)}
            />
            <Input
              label="Thứ tự hiển thị"
              className="w-full"
              type="number"
              min="0"
              max="9999"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Hủy bỏ
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              {isEdit ? 'Lưu thay đổi' : 'Thêm tiện ích'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
