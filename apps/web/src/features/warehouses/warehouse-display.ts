import type { ApiError } from '../../lib/api';
import type { Warehouse, WarehouseStatus } from '../../types/warehouse';

export type BadgeVariant = 'success' | 'primary' | 'error' | 'warning' | 'neutral';

export const WAREHOUSE_STATUS_LABEL: Record<
  WarehouseStatus,
  { label: string; variant: BadgeVariant }
> = {
  AVAILABLE: { label: 'Còn trống', variant: 'success' },
  HELD: { label: 'Đang giữ chỗ', variant: 'warning' },
  BOOKED: { label: 'Đã đặt', variant: 'primary' },
  RENTED: { label: 'Đang thuê', variant: 'primary' },
  PENDING_INSPECTION: { label: 'Chờ kiểm tra', variant: 'warning' },
  MAINTENANCE: { label: 'Đang bảo trì', variant: 'error' },
  INACTIVE: { label: 'Ngưng hoạt động', variant: 'neutral' },
};

const FIELD_LABEL: Record<string, string> = {
  code: 'mã kho',
  widthM: 'chiều rộng',
  lengthM: 'chiều dài',
  heightM: 'chiều cao',
  status: 'trạng thái',
};

const trimNumber = (value: number) =>
  Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export const formatVnd = (value: number | string) => `${Number(value).toLocaleString('vi-VN')} đ`;

export const formatArea = (value: number) => `${trimNumber(value)} m²`;

export const formatVolume = (value: number | null) =>
  value === null ? '—' : `${trimNumber(value)} m³`;

export const formatDimensions = (w: Warehouse) =>
  `${trimNumber(w.widthM)} × ${trimNumber(w.lengthM)} × ${w.heightM === null ? '—' : trimNumber(w.heightM)} m`;

export const formatDeposit = (w: Pick<Warehouse, 'depositMonths' | 'effectiveDepositMonths'>) =>
  w.depositMonths === null
    ? `Mặc định (${w.effectiveDepositMonths} tháng)`
    : `${w.depositMonths} tháng`;

/** Vietnamese reason for a failed create/update/delete/status call. */
export function describeWarehouseError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const { status, details } = err as ApiError;
  if (status === 409 && details) {
    const current = WAREHOUSE_STATUS_LABEL[details.status as WarehouseStatus]?.label;
    if (Array.isArray(details.fields) && details.fields.length > 0) {
      const fields = details.fields.map((f) => FIELD_LABEL[String(f)] ?? String(f)).join(', ');
      return `Kho đang ở trạng thái "${current ?? 'không rảnh'}" nên không thể đổi ${fields}.`;
    }
    const tours = Number(details.openTours ?? 0);
    if (tours > 0) {
      return `Kho còn ${tours} lịch xem kho đang mở. Hãy hủy hoặc hoàn tất trước khi xóa.`;
    }
    if (current) return `Kho đang ở trạng thái "${current}" nên không thể thực hiện thao tác này.`;
  }
  if (status === 409) return 'Mã kho đã tồn tại hoặc dữ liệu bị xung đột. Vui lòng kiểm tra lại.';
  if (status === 400 && /does not belong to province/i.test(err.message)) {
    return 'Phường/xã đã chọn không thuộc tỉnh/thành phố này.';
  }
  return err.message || fallback;
}
