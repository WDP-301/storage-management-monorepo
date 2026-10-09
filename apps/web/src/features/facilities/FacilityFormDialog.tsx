import { Button, Dialog, Input, Select } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import { FacilitiesApi, type FacilityRecord, LocationsApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { Province } from '../../types/warehouse';
import {
  buildFacilityCreate,
  buildFacilityPatch,
  describeFacilityError,
  EMPTY_FACILITY_FORM,
  type FacilityFormState,
  NO_REGION,
  toFacilityForm,
  validateFacilityForm,
} from './facility-form';

interface Props {
  open: boolean;
  /** Facility being edited; null opens the create form. */
  facility: FacilityRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export const FacilityFormDialog: React.FC<Props> = ({ open, facility, onClose, onSaved }) => {
  const toast = useAppToast();
  const [form, setForm] = useState<FacilityFormState>(EMPTY_FACILITY_FORM);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = facility !== null;

  useEffect(() => {
    if (!open) return;
    setForm(facility ? toFacilityForm(facility) : EMPTY_FACILITY_FORM);
    LocationsApi.provinces()
      .then(setProvinces)
      .catch(() => toast.error('Lỗi tải dữ liệu', 'Không tải được danh sách tỉnh/thành.'));
  }, [open, facility, toast]);

  const set = <K extends keyof FacilityFormState>(key: K, value: FacilityFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateFacilityForm(form);
    if (problem) {
      toast.warning('Thông tin chưa hợp lệ', problem);
      return;
    }
    setIsSaving(true);
    try {
      if (facility) {
        const patch = buildFacilityPatch(form, facility);
        if (Object.keys(patch).length > 0) await FacilitiesApi.update(facility.id, patch);
        toast.notifyUpdated('cơ sở', form.code.trim());
      } else {
        await FacilitiesApi.create(buildFacilityCreate(form));
        toast.notifyCreated('cơ sở', form.code.trim());
      }
      onSaved();
    } catch (err) {
      toast.error(
        isEdit ? 'Lỗi cập nhật cơ sở' : 'Lỗi tạo cơ sở',
        describeFacilityError(err, 'Không thể lưu cơ sở. Vui lòng thử lại.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const regionItems = [
    { value: NO_REGION, label: 'Không chọn' },
    ...provinces.map((p) => ({ value: p.code, label: p.name })),
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog size="lg" className="p-6 sm:p-7 sm:w-[520px] w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center justify-between border-b border-kumo-line pb-3.5">
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              {isEdit ? `Chỉnh sửa cơ sở ${facility.code}` : 'Thêm cơ sở mới'}
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
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Input
              label="Mã cơ sở"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
            />
            <Input
              label="Tên cơ sở"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
            <Select
              label="Khu vực (tỉnh/thành, không bắt buộc)"
              value={form.provinceCode}
              onValueChange={(v) => set('provinceCode', String(v))}
              items={regionItems}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-kumo-line">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Hủy bỏ
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              {isEdit ? 'Lưu thay đổi' : 'Tạo cơ sở'}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
