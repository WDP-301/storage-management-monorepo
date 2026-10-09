import { Button, Dialog, Input, InputArea, Select, Text } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type FacilityRecord, LocationsApi, WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { Province, Ward, Warehouse } from '../../types/warehouse';
import { WarehouseAddressPicker } from './WarehouseAddressPicker';
import { WarehouseFacilityField } from './WarehouseFacilityField';
import { WarehouseLocationMap } from './WarehouseLocationMap';
import {
  describeWarehouseError,
  formatArea,
  formatVolume,
  WAREHOUSE_STATUS_LABEL,
} from './warehouse-display';
import {
  buildPatch,
  buildPayload,
  computeDerived,
  DEPOSIT_DEFAULT,
  EMPTY_FORM,
  isIdleStatus,
  toFormState,
  validateForm,
  type WarehouseFormState,
} from './warehouse-form';

interface Props {
  open: boolean;
  /** Warehouse being edited; null opens the create form. */
  warehouse: Warehouse | null;
  /** Facility pre-selected when creating (e.g. the page filter). */
  defaultFacilityId?: string;
  facilities: FacilityRecord[];
  onClose: () => void;
  onSaved: () => void;
}

const DEPOSIT_ITEMS = [
  { value: DEPOSIT_DEFAULT, label: 'Mặc định (theo cấu hình hệ thống)' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} tháng` })),
];

const STATUS_ITEMS = (['AVAILABLE', 'MAINTENANCE', 'INACTIVE'] as const).map((s) => ({
  value: s,
  label: WAREHOUSE_STATUS_LABEL[s].label,
}));

export const WarehouseFormDialog: React.FC<Props> = ({
  open,
  warehouse,
  defaultFacilityId,
  facilities,
  onClose,
  onSaved,
}) => {
  const toast = useAppToast();
  const [form, setForm] = useState<WarehouseFormState>(EMPTY_FORM);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pinMoved, setPinMoved] = useState(false);

  const isEdit = warehouse !== null;
  const frozen = isEdit && !isIdleStatus(warehouse.status);

  useEffect(() => {
    if (!open) return;
    setForm(
      warehouse ? toFormState(warehouse) : { ...EMPTY_FORM, facilityId: defaultFacilityId ?? '' },
    );
    setPinMoved(false);
    LocationsApi.provinces()
      .then(setProvinces)
      .catch(() => toast.error('Lỗi tải dữ liệu', 'Không tải được danh sách tỉnh/thành.'));
  }, [open, warehouse, defaultFacilityId, toast]);

  useEffect(() => {
    if (!open || !form.provinceCode) {
      setWards([]);
      return;
    }
    let cancelled = false;
    LocationsApi.wards(form.provinceCode)
      .then((list) => !cancelled && setWards(list))
      .catch(() => !cancelled && setWards([]));
    return () => {
      cancelled = true;
    };
  }, [open, form.provinceCode]);

  const set = <K extends keyof WarehouseFormState>(key: K, value: WarehouseFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleMapPointChange = useCallback((point: { latitude: number; longitude: number }) => {
    setForm((prev) => ({
      ...prev,
      latitude: String(Number(point.latitude.toFixed(6))),
      longitude: String(Number(point.longitude.toFixed(6))),
    }));
    setPinMoved(true);
  }, []);

  const mapPoint = useMemo(
    () =>
      form.latitude.trim() !== '' && form.longitude.trim() !== ''
        ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
        : null,
    [form.latitude, form.longitude],
  );

  const { area, volume } = computeDerived(form);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateForm(form, frozen);
    if (problem) {
      toast.warning('Thông tin chưa hợp lệ', problem);
      return;
    }
    setIsSaving(true);
    try {
      if (warehouse) {
        await WarehousesApi.update(warehouse.id, buildPatch(form, warehouse));
        toast.notifyUpdated('kho', warehouse.code);
      } else {
        await WarehousesApi.create(buildPayload(form));
        toast.notifyCreated('kho', form.code.trim());
      }
      onSaved();
    } catch (err) {
      toast.error(
        isEdit ? 'Lỗi cập nhật kho' : 'Lỗi tạo kho',
        describeWarehouseError(err, 'Không thể lưu kho. Vui lòng thử lại.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog size="xl" className="p-6 sm:p-7 sm:w-[720px] w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center justify-between border-b border-kumo-line pb-3.5">
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              {isEdit ? `Chỉnh sửa kho ${warehouse.code}` : 'Thêm kho mới'}
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

          {frozen && (
            <div className="p-3 bg-kumo-warning-tint text-kumo-warning rounded-lg text-xs">
              Kho đang {WAREHOUSE_STATUS_LABEL[warehouse.status].label.toLowerCase()} nên không thể
              đổi cơ sở, mã kho, kích thước hay trạng thái. Giá, đặt cọc, địa chỉ và ghi chú vẫn
              chỉnh được.
            </div>
          )}

          <WarehouseFacilityField
            facilities={facilities}
            value={form.facilityId}
            onChange={(v) => set('facilityId', v)}
            locked={frozen}
            isEdit={isEdit}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Mã kho"
              className="w-full"
              value={form.code}
              disabled={frozen}
              onChange={(e) => set('code', e.target.value)}
            />
            <Input
              label="Tên kho"
              className="w-full"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <WarehouseAddressPicker
            addressLine={form.addressLine}
            onAddressChange={(v) => set('addressLine', v)}
            onPlacePicked={(p) => {
              setPinMoved(false);
              setForm((prev) => ({
                ...prev,
                addressLine: p.address,
                latitude: String(p.lat),
                longitude: String(p.lng),
              }));
            }}
          />

          {open && <WarehouseLocationMap point={mapPoint} onPointChange={handleMapPointChange} />}
          {pinMoved && form.addressLine.trim() && (
            <p role="status" className="text-kumo-warning">
              Vị trí ghim đã thay đổi. Hãy kiểm tra lại địa chỉ kho trước khi lưu.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tỉnh / Thành phố"
              placeholder="Chọn tỉnh/thành"
              value={form.provinceCode || null}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, provinceCode: String(v), wardCode: '' }))
              }
              items={provinces.map((p) => ({ value: p.code, label: p.name }))}
            />
            <Select
              label="Phường / Xã"
              placeholder={form.provinceCode ? 'Chọn phường/xã' : 'Chọn tỉnh/thành trước'}
              value={form.wardCode || null}
              disabled={!form.provinceCode}
              onValueChange={(v) => set('wardCode', String(v))}
              items={wards.map((w) => ({ value: w.code, label: w.name }))}
            />
            <Input
              label="Vĩ độ (latitude)"
              className="w-full"
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => set('latitude', e.target.value)}
            />
            <Input
              label="Kinh độ (longitude)"
              className="w-full"
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => set('longitude', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Chiều rộng (m)"
              className="w-full"
              type="number"
              step="any"
              min="0"
              value={form.widthM}
              disabled={frozen}
              onChange={(e) => set('widthM', e.target.value)}
            />
            <Input
              label="Chiều dài (m)"
              className="w-full"
              type="number"
              step="any"
              min="0"
              value={form.lengthM}
              disabled={frozen}
              onChange={(e) => set('lengthM', e.target.value)}
            />
            <Input
              label="Chiều cao (m)"
              className="w-full"
              type="number"
              step="any"
              min="0"
              value={form.heightM}
              disabled={frozen}
              onChange={(e) => set('heightM', e.target.value)}
            />
          </div>
          <div className="flex gap-6 text-xs p-3 rounded-lg bg-kumo-control ring ring-kumo-line">
            <span>
              <span className="text-kumo-subtle">Diện tích: </span>
              <strong data-testid="derived-area">{area === null ? '—' : formatArea(area)}</strong>
            </span>
            <span>
              <span className="text-kumo-subtle">Thể tích: </span>
              <strong data-testid="derived-volume">
                {volume === null ? '—' : formatVolume(volume)}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Giá thuê / tháng (VND)"
              className="w-full"
              type="number"
              min="0"
              value={form.monthlyPrice}
              onChange={(e) => set('monthlyPrice', e.target.value)}
            />
            <Select
              label="Số tháng đặt cọc"
              value={form.depositMonths}
              onValueChange={(v) => set('depositMonths', String(v))}
              items={DEPOSIT_ITEMS}
            />
          </div>

          {!frozen && (
            <Select
              label="Trạng thái"
              value={form.status}
              onValueChange={(v) => set('status', v as WarehouseFormState['status'])}
              items={STATUS_ITEMS}
            />
          )}

          <InputArea
            label="Mô tả công khai (khách hàng nhìn thấy)"
            value={form.notes}
            minRows={2}
            onChange={(e) => set('notes', e.target.value)}
          />

          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-kumo-line">
            <Text variant="secondary" size="xs">
              Tiền cọc = giá thuê tháng × số tháng cọc.
            </Text>
            <div className="flex items-center gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                Hủy bỏ
              </Button>
              <Button type="submit" variant="primary" loading={isSaving}>
                {isEdit ? 'Lưu thay đổi' : 'Tạo kho'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
