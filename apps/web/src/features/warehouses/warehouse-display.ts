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
  facilityId: 'chi nhánh',
  code: 'mã kho',
  name: 'tên kho',
  addressLine: 'địa chỉ',
  wardCode: 'phường/xã',
  provinceCode: 'tỉnh/thành',
  latitude: 'vĩ độ',
  longitude: 'kinh độ',
  widthM: 'chiều rộng',
  lengthM: 'chiều dài',
  heightM: 'chiều cao',
  monthlyPrice: 'giá thuê',
  depositMonths: 'số tháng đặt cọc',
  notes: 'mô tả',
  status: 'trạng thái',
};

const CONSTRAINT_REASON: Record<string, string> = {
  max: 'vượt quá giá trị tối đa cho phép',
  min: 'nhỏ hơn giá trị tối thiểu cho phép',
  isPositive: 'phải lớn hơn 0',
  isNumber: 'phải là số hợp lệ (tối đa 2 chữ số thập phân)',
  maxDecimalPlaces: 'chỉ được tối đa 2 chữ số thập phân',
  isNotEmpty: 'không được để trống',
  isString: 'không hợp lệ',
  maxLength: 'quá dài',
  isUuid: 'không hợp lệ',
  isLatitude: 'phải nằm trong khoảng -90 đến 90',
  isLongitude: 'phải nằm trong khoảng -180 đến 180',
  isInt: 'phải là số nguyên',
  isIn: 'không hợp lệ',
};

const fieldLabel = (field: unknown) => FIELD_LABEL[String(field)] ?? String(field);

/** Describes `details.fields` of a 400: `{ field, code }` objects from the API validators. */
function describeFieldErrors(fields: unknown[]): string | null {
  const lines = fields
    .filter((f): f is { field: string; code?: string } => typeof f === 'object' && f !== null)
    .map(({ field, code }) => {
      const label = fieldLabel(field);
      const reason = CONSTRAINT_REASON[String(code)] ?? 'không hợp lệ';
      return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${reason}`;
    });
  return lines.length > 0 ? `${lines.join('; ')}.` : null;
}

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
    if (details.facilityStatus) {
      return 'Chi nhánh đang ngừng hoạt động, không thể thêm hoặc chuyển kho vào đó.';
    }
    if (Number(details.openTickets ?? 0) > 0) {
      return 'Kho còn yêu cầu hỗ trợ đang mở, hãy xử lý xong trước khi chuyển chi nhánh.';
    }
    const current = WAREHOUSE_STATUS_LABEL[details.status as WarehouseStatus]?.label;
    if (Array.isArray(details.fields) && details.fields.length > 0) {
      const fields = details.fields.map(fieldLabel).join(', ');
      return `Kho đang ở trạng thái "${current ?? 'không rảnh'}" nên không thể đổi ${fields}.`;
    }
    const tours = Number(details.openTours ?? 0);
    if (tours > 0) {
      return `Kho còn ${tours} lịch xem kho đang mở. Hãy hủy hoặc hoàn tất các lịch này trước khi xóa kho hoặc chuyển sang chi nhánh khác.`;
    }
    if (current) return `Kho đang ở trạng thái "${current}" nên không thể thực hiện thao tác này.`;
  }
  if (status === 400 && Array.isArray(details?.fields)) {
    const described = describeFieldErrors(details.fields);
    if (described) return described;
  }
  if (status === 400 && /facility does not exist/i.test(err.message)) {
    return 'Chi nhánh đã chọn không tồn tại hoặc đã bị xóa.';
  }
  if (status === 409) return 'Mã kho đã tồn tại hoặc dữ liệu bị xung đột. Vui lòng kiểm tra lại.';
  if (status === 400 && /does not belong to province/i.test(err.message)) {
    return 'Phường/xã đã chọn không thuộc tỉnh/thành phố này.';
  }
  return err.message || fallback;
}
