import {
  Badge,
  Button,
  InputArea,
  InputGroup,
  LayerCard,
  Select,
  Switch,
  Text,
} from '@cloudflare/kumo';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CheckCircle,
  FloppyDisk,
  MagnifyingGlass,
  Plus,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import type { SystemSettingRecord } from '@storage/types';
import React, { useEffect, useMemo, useState } from 'react';
import { SettingsApi } from '../../lib/api';

export type ConfigCategory =
  | 'all'
  | 'booking'
  | 'contract'
  | 'billing'
  | 'deposit'
  | 'idempotency'
  | 'security';

interface SettingMetadata {
  label?: string;
  description?: string;
  unit?: string;
  group?: string;
}

/**
 * Metadata dictionary mapping keys to friendly Vietnamese labels, descriptions,
 * units, and logical category groups.
 */
const SETTINGS_METADATA: Record<string, SettingMetadata> = {
  'booking.hold_minutes': {
    label: 'Thời gian giữ chỗ tạm thời (Hold timeout)',
    description:
      'Thời gian tối đa hệ thống tạm giữ kho cho khách hàng hoàn tất đặt cọc trước khi tự động giải phóng kho (Mục 3 tài liệu nghiệp vụ).',
    unit: 'phút',
    group: 'booking',
  },
  'booking.lead_days': {
    label: 'Số ngày đặt trước tối đa (Max lead days)',
    description:
      'Khoảng thời gian tối đa tính từ ngày đặt chỗ đến ngày bắt đầu nhận kho thực tế của khách hàng.',
    unit: 'ngày',
    group: 'booking',
  },
  'booking.min_rental_months': {
    label: 'Thời hạn thuê tối thiểu cho hợp đồng mới',
    description:
      'Đơn vị thời gian thuê tối thiểu được chấp nhận khi khách hàng tạo lượt thuê kho mới.',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.max_rental_months': {
    label: 'Thời hạn thuê tối đa cho hợp đồng mới',
    description:
      'Giới hạn thời gian thuê tối đa của một hợp đồng thuê kho (ràng buộc DB tối đa 60 tháng).',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.default_rental_months': {
    label: 'Thời hạn thuê mặc định',
    description:
      'Giá trị thời hạn thuê được chọn sẵn khi khách hàng lần đầu chọn kho trong giao diện.',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.rental_months_options': {
    label: 'Gợi ý các gói kỳ hạn thuê kho',
    description:
      'Danh sách các gói kỳ hạn thuê đề xuất hiển thị trên giao diện người dùng (phân tách bởi dấu phẩy).',
    unit: 'tháng',
    group: 'booking',
  },
  'booking.max_units_per_booking': {
    label: 'Số kho tối đa trong một lượt đặt',
    description:
      'Giới hạn số lượng kho một khách hàng có thể chọn trong cùng một lượt đặt giữ chỗ.',
    unit: 'kho',
    group: 'booking',
  },
  'booking.search_radius_km': {
    label: 'Bán kính tìm kiếm cơ sở lân cận',
    description:
      'Khoảng cách địa lý tối đa theo tọa độ (kinh độ, vĩ độ) để tự động đề xuất các kho gần nhau khi thuê nhiều kho.',
    unit: 'km',
    group: 'booking',
  },
  'booking.waitlist_offer_expiry_hours': {
    label: 'Thời hạn giữ kho cho danh sách chờ',
    description:
      'Thời gian cho phép khách hàng trong danh sách chờ xác nhận đề xuất giữ kho trước khi chuyển sang khách tiếp theo.',
    unit: 'giờ',
    group: 'booking',
  },
  'contract.transition_grace_period_hours': {
    label: 'Thời gian ân hạn chuyển tiếp khi đổi kho',
    description:
      'Khoảng thời gian khách hàng được phép mở khóa và sử dụng đồng thời cả kho cũ và kho mới để dọn đồ chuyển kho (Mục 7 tài liệu nghiệp vụ).',
    unit: 'giờ',
    group: 'contract',
  },
  'contract.renewal_notice_days': {
    label: 'Thời hạn gửi thông báo nhắc gia hạn',
    description:
      'Số ngày trước khi hợp đồng kết thúc để hệ thống tự động gửi thông báo đề xuất gia hạn kỳ thuê mới đến khách hàng.',
    unit: 'ngày trước hạn',
    group: 'contract',
  },
  'contract.inspection_required_on_checkout': {
    label: 'Bắt buộc kiểm tra biên bản hiện trạng khi trả kho',
    description:
      'Yêu cầu nhân viên cơ sở chụp ảnh nghiệm thu và xác nhận biên bản tình trạng kho trước khi giải phóng cọc.',
    group: 'contract',
  },
  'deposit.default_months': {
    label: 'Tỷ lệ tiền đặt cọc tối thiểu (Tháng thuê)',
    description:
      'Áp dụng cho kho chưa cấu hình số tháng cọc riêng; kho đã cấu hình sẽ dùng số tháng của nó.',
    unit: 'tháng thuê',
    group: 'deposit',
  },
  'billing.vat_tax_rate_percent': {
    label: 'Thuế giá trị gia tăng (VAT)',
    description:
      'Mức thuế suất VAT áp dụng khi xuất hóa đơn thanh toán cho tiền thuê kho và các dịch vụ đi kèm.',
    unit: '%',
    group: 'billing',
  },
  'billing.overdue_penalty_fee_per_day': {
    label: 'Phí phạt quá hạn trả kho mỗi ngày',
    description:
      'Khoản phí phát sinh tính trên mỗi ngày trễ hạn bàn giao trả kho nếu chưa thực hiện gia hạn hợp đồng.',
    unit: 'VNĐ / ngày',
    group: 'billing',
  },
  'billing.auto_refund_deposit_enabled': {
    label: 'Tự động duyệt hoàn cọc sau nghiệm thu đạt chuẩn',
    description:
      'Tự động tạo lệnh hoàn cọc sau khi nhân viên xác nhận biên bản trả kho không phát sinh hư hỏng hoặc công nợ.',
    group: 'billing',
  },
  'idempotency.ttl_hours': {
    label: 'Thời gian lưu trữ Idempotency Key',
    description:
      'Thời gian tồn tại của khóa chống gửi lặp giao dịch trước khi tác vụ tự động dọn dẹp.',
    unit: 'giờ',
    group: 'idempotency',
  },
  'idempotency.stale_seconds': {
    label: 'Thời gian giải phóng khóa xử lý treo',
    description:
      'Ngưỡng thời gian để thu hồi khóa giao dịch bị kẹt trong trạng thái đang xử lý (sau sự cố máy chủ).',
    unit: 'giây',
    group: 'idempotency',
  },
  'security.session_max_age_days': {
    label: 'Thời hạn hiệu lực phiên đăng nhập (Session TTL)',
    description:
      'Thời gian tồn tại tối đa của cookie phiên bảo mật (sid) trên trình duyệt trước khi người dùng cần đăng nhập lại.',
    unit: 'ngày',
    group: 'security',
  },
  'security.max_login_failed_attempts': {
    label: 'Giới hạn số lần đăng nhập sai tối đa',
    description:
      'Số lần nhập sai mật khẩu liên tiếp cho phép trước khi tạm khóa địa chỉ IP hoặc tài khoản trong 15 phút.',
    unit: 'lần',
    group: 'security',
  },
  'security.system_maintenance_mode': {
    label: 'Chế độ bảo trì hệ thống toàn diện',
    description:
      'Tạm dừng các thao tác đặt kho và thanh toán từ phía khách hàng (chỉ quản trị viên mới có thể truy cập hệ thống).',
    group: 'security',
  },
};

const enhanceSetting = (item: SystemSettingRecord): SystemSettingRecord => {
  const meta = SETTINGS_METADATA[item.key];
  return {
    ...item,
    label: meta?.label || item.label || item.key,
    description: meta?.description ?? item.description ?? null,
    unit: meta?.unit ?? item.unit ?? null,
    group: item.group || meta?.group || 'general',
  };
};

const INITIAL_SETTINGS: SystemSettingRecord[] = [
  {
    key: 'booking.default_rental_months',
    label: 'Thời hạn thuê mặc định',
    description:
      'Giá trị thời hạn thuê được chọn sẵn khi khách hàng lần đầu chọn kho trong giao diện.',
    value_type: 'int',
    value: 6,
    default: 6,
    min: 1,
    max: 60,
    unit: 'tháng',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'booking.hold_minutes',
    label: 'Thời gian giữ chỗ tạm thời (Hold timeout)',
    description:
      'Thời gian tối đa hệ thống tạm giữ kho cho khách hàng hoàn tất đặt cọc trước khi tự động giải phóng kho (Mục 3 tài liệu nghiệp vụ).',
    value_type: 'int',
    value: 15,
    default: 15,
    min: 1,
    max: 1440,
    unit: 'phút',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'booking.lead_days',
    label: 'Số ngày đặt trước tối đa (Max lead days)',
    description:
      'Khoảng thời gian tối đa tính từ ngày đặt chỗ đến ngày bắt đầu nhận kho thực tế của khách hàng.',
    value_type: 'int',
    value: 30,
    default: 30,
    min: 1,
    max: 365,
    unit: 'ngày',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'booking.max_rental_months',
    label: 'Thời hạn thuê tối đa cho hợp đồng mới',
    description:
      'Giới hạn thời gian thuê tối đa của một hợp đồng thuê kho (ràng buộc DB tối đa 60 tháng).',
    value_type: 'int',
    value: 60,
    default: 60,
    min: 1,
    max: 60,
    unit: 'tháng',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'booking.max_units_per_booking',
    label: 'Số kho tối đa trong một lượt đặt',
    description:
      'Giới hạn số lượng kho một khách hàng có thể chọn trong cùng một lượt đặt giữ chỗ.',
    value_type: 'int',
    value: 4,
    default: 4,
    min: 1,
    max: 20,
    unit: 'kho',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'booking.min_rental_months',
    label: 'Thời hạn thuê tối thiểu cho hợp đồng mới',
    description:
      'Đơn vị thời gian thuê tối thiểu được chấp nhận khi khách hàng tạo lượt thuê kho mới.',
    value_type: 'int',
    value: 6,
    default: 6,
    min: 1,
    max: 60,
    unit: 'tháng',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'booking.rental_months_options',
    label: 'Gợi ý các gói kỳ hạn thuê kho',
    description:
      'Danh sách các gói kỳ hạn thuê đề xuất hiển thị trên giao diện người dùng (phân tách bởi dấu phẩy).',
    value_type: 'int_list',
    value: [6, 12, 18],
    default: [6, 12, 18],
    min: 1,
    max: 60,
    unit: 'tháng',
    group: 'booking',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'deposit.default_months',
    label: 'Tỷ lệ tiền đặt cọc tối thiểu (Tháng thuê)',
    description:
      'Áp dụng cho kho chưa cấu hình số tháng cọc riêng; kho đã cấu hình sẽ dùng số tháng của nó.',
    value_type: 'float',
    value: 1,
    default: 1,
    min: 0,
    max: 12,
    unit: 'tháng thuê',
    group: 'deposit',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'idempotency.stale_seconds',
    label: 'Thời gian giải phóng khóa xử lý treo',
    description:
      'Ngưỡng thời gian để thu hồi khóa giao dịch bị kẹt trong trạng thái đang xử lý (sau sự cố máy chủ).',
    value_type: 'int',
    value: 60,
    default: 60,
    min: 10,
    max: 3600,
    unit: 'giây',
    group: 'idempotency',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'idempotency.ttl_hours',
    label: 'Thời gian lưu trữ Idempotency Key',
    description:
      'Thời gian tồn tại của khóa chống gửi lặp giao dịch trước khi tác vụ tự động dọn dẹp.',
    value_type: 'int',
    value: 24,
    default: 24,
    min: 1,
    max: 720,
    unit: 'giờ',
    group: 'idempotency',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
];

const GROUP_LABELS: Record<string, string> = {
  booking: 'Đặt kho & Giữ chỗ',
  deposit: 'Tiền cọc & Đặt cọc',
  billing: 'Tài chính & Phí',
  contract: 'Hợp đồng & Đổi kho',
  idempotency: 'Bảo mật & Phiên (Idempotency)',
  security: 'Bảo mật & Phiên',
};

const normalizeCategory = (group: string): string => {
  if (group === 'booking') return 'booking';
  if (group === 'contract') return 'contract';
  if (group === 'billing' || group === 'deposit') return 'deposit';
  if (group === 'security' || group === 'idempotency') return 'idempotency';
  return group;
};

export const SystemSettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<SystemSettingRecord[]>(() =>
    INITIAL_SETTINGS.map(enhanceSetting),
  );
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const item of INITIAL_SETTINGS) {
      initial[item.key] = item.value;
    }
    return initial;
  });
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const item of INITIAL_SETTINGS) {
      initial[item.key] = item.value;
    }
    return initial;
  });

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamically compute category options and counts from server configs
  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of configs) {
      const g = item.group || 'general';
      counts[g] = (counts[g] || 0) + 1;
    }

    return Object.entries(counts).map(([groupId, count]) => ({
      id: groupId,
      label: GROUP_LABELS[groupId] || groupId.charAt(0).toUpperCase() + groupId.slice(1),
      count,
    }));
  }, [configs]);

  const categorySelectItems = useMemo(
    () => [
      { value: 'all', label: 'Tất cả danh mục' },
      ...categoryOptions.map((cat) => ({ value: cat.id, label: cat.label })),
    ],
    [categoryOptions],
  );

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await SettingsApi.getAll();
      if (Array.isArray(data) && data.length > 0) {
        const sorted = [...data].sort((a, b) => {
          const gComp = (a.group || '').localeCompare(b.group || '');
          if (gComp !== 0) return gComp;
          return a.key.localeCompare(b.key);
        });
        const enhanced = sorted.map(enhanceSetting);
        setConfigs(enhanced);
        const vals: Record<string, unknown> = {};
        for (const item of enhanced) {
          vals[item.key] = item.value;
        }
        setFormValues(vals);
        setInitialValues(vals);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kết nối API cấu hình hệ thống.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const [newTagInput, setNewTagInput] = useState<Record<string, string>>({});

  const handleValueChange = (key: string, newValue: unknown) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: newValue,
    }));
  };

  const handleAddTag = (key: string, min?: number | null, max?: number | null) => {
    const raw = (newTagInput[key] ?? '').trim();
    if (!raw) return;
    const num = Number(raw);
    if (Number.isNaN(num) || !Number.isInteger(num)) return;
    if (min !== null && min !== undefined && num < min) return;
    if (max !== null && max !== undefined && num > max) return;

    const currentList = Array.isArray(formValues[key]) ? (formValues[key] as number[]) : [];
    if (!currentList.includes(num)) {
      const nextList = [...currentList, num].sort((a, b) => a - b);
      handleValueChange(key, nextList);
    }
    setNewTagInput((prev) => ({ ...prev, [key]: '' }));
  };

  const handleRemoveTag = (key: string, indexToRemove: number) => {
    const currentList = Array.isArray(formValues[key]) ? (formValues[key] as number[]) : [];
    const nextList = currentList.filter((_, i) => i !== indexToRemove);
    handleValueChange(key, nextList);
  };

  const handleResetDefaults = () => {
    const defaults: Record<string, unknown> = {};
    for (const item of configs) {
      defaults[item.key] = item.default;
    }
    setFormValues(defaults);
    setSaveStatus('Đã khôi phục toàn bộ tham số về giá trị mặc định.');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    setErrorMessage(null);

    try {
      const modifiedValues: Record<string, unknown> = {};
      for (const item of configs) {
        if (formValues[item.key] !== initialValues[item.key]) {
          modifiedValues[item.key] = formValues[item.key];
        }
      }

      // If nothing was modified, send current state of the first item to trigger API verification
      const payload =
        Object.keys(modifiedValues).length > 0
          ? modifiedValues
          : configs.length > 0
            ? { [configs[0].key]: formValues[configs[0].key] ?? configs[0].value }
            : {};

      const updated = await SettingsApi.update(payload);

      if (Array.isArray(updated) && updated.length > 0) {
        const updatedMap = new Map(updated.map((u) => [u.key, u]));
        setConfigs((prev) =>
          prev.map((item) => {
            const fresh = updatedMap.get(item.key);
            return fresh ? enhanceSetting(fresh) : item;
          }),
        );
        setInitialValues((prev) => {
          const next = { ...prev };
          for (const u of updated) {
            next[u.key] = u.value;
          }
          return next;
        });
      }

      setSaveStatus('Đã lưu cấu hình tham số hệ thống thành công.');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình tham số hệ thống.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredConfigs = configs.filter((item) => {
    const itemCategory = normalizeCategory(item.group);
    const matchesCategory =
      activeTab === 'all' || item.group === activeTab || itemCategory === activeTab;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(item.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const getCategoryBadge = (group: string) => (
    <Badge variant="neutral">
      {GROUP_LABELS[group] || group.charAt(0).toUpperCase() + group.slice(1)}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Cấu hình tham số hệ thống
          </Text>
          <Text variant="secondary">
            Thiết lập các quy tắc vận hành, thời gian giữ kho, chính sách cọc và bảo mật toàn hệ
            thống.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className="w-4 h-4" />}
            onClick={loadSettings}
            loading={isLoading}
          >
            Làm mới
          </Button>
          <Button
            variant="secondary"
            icon={<ArrowCounterClockwise className="w-4 h-4" />}
            onClick={handleResetDefaults}
          >
            Mặc định
          </Button>
          <Button
            variant="primary"
            icon={<FloppyDisk className="w-4 h-4" />}
            loading={isSaving}
            onClick={handleSave}
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveStatus && (
        <div
          role="alert"
          className="p-3.5 bg-kumo-success-tint text-kumo-success rounded-lg text-sm flex items-center gap-2.5"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{saveStatus}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2">
            <WarningCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <Button size="xs" variant="secondary" onClick={loadSettings}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Category Dropdown using Kumo Select */}
        <div className="w-full sm:w-72">
          <Select
            aria-label="Lọc theo danh mục"
            value={activeTab}
            onValueChange={(val) => {
              if (val) setActiveTab(val);
            }}
            items={categorySelectItems}
          />
        </div>

        {/* Search Input using Kumo InputGroup */}
        <div className="w-full sm:w-72">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Tìm kiếm tham số..."
              aria-label="Tìm kiếm tham số"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </InputGroup>
        </div>
      </div>

      {/* Configuration List */}
      <div className="space-y-3">
        {isLoading && configs.length === 0 ? (
          <LayerCard className="p-8 text-center ring ring-kumo-line">
            <ArrowsClockwise className="w-5 h-5 animate-spin mx-auto mb-2 text-kumo-brand" />
            <Text variant="secondary">Đang tải tham số cấu hình từ máy chủ...</Text>
          </LayerCard>
        ) : filteredConfigs.length === 0 ? (
          <LayerCard className="p-8 text-center ring ring-kumo-line">
            <Text variant="secondary">Không tìm thấy tham số cấu hình phù hợp với từ khóa.</Text>
          </LayerCard>
        ) : (
          filteredConfigs.map((item) => {
            const currentValue = formValues[item.key] ?? item.value;

            return (
              <LayerCard
                key={item.key}
                className="p-4 sm:p-5 ring ring-kumo-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-kumo-brand/30"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Text as="strong" bold>
                      {item.label}
                    </Text>
                    {getCategoryBadge(item.group)}
                  </div>
                  {item.description && (
                    <Text variant="secondary" size="xs">
                      {item.description}
                    </Text>
                  )}
                </div>

                {/* Form Input Control using Kumo Input / InputArea / InputGroup / Switch */}
                <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                  {item.value_type === 'boolean' ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label={item.label}
                        checked={Boolean(currentValue)}
                        onCheckedChange={(checked) => handleValueChange(item.key, checked)}
                        size="sm"
                      />
                      <span className="text-xs text-kumo-subtle min-w-6 font-medium select-none">
                        {currentValue ? 'Bật' : 'Tắt'}
                      </span>
                    </div>
                  ) : item.value_type === 'string' ? (
                    <InputArea
                      aria-label={item.label}
                      value={String(currentValue ?? '')}
                      onChange={(e) => handleValueChange(item.key, e.target.value)}
                      autoResize
                      minRows={1}
                      maxRows={4}
                      size="sm"
                      className="w-48 sm:w-64 text-xs"
                    />
                  ) : item.value_type === 'int_list' ? (
                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 max-w-xs">
                        {(Array.isArray(currentValue) ? (currentValue as number[]) : []).map(
                          (val, idx) => (
                            <span
                              key={`${val}-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-kumo-tint text-kumo-default border border-kumo-line text-xs font-semibold"
                            >
                              <span>
                                {val} {item.unit || 'tháng'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(item.key, idx)}
                                className="text-kumo-subtle hover:text-kumo-danger cursor-pointer p-0.5 rounded transition"
                                title={`Xóa gói ${val} ${item.unit || ''}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ),
                        )}
                        {(Array.isArray(currentValue) ? (currentValue as number[]) : []).length ===
                          0 && (
                          <span className="text-xs text-kumo-subtle italic">Chưa có gói nào</span>
                        )}
                      </div>
                      {/* Add new option using Kumo InputGroup */}
                      <div className="flex items-center gap-1.5">
                        <InputGroup size="sm" className="w-28">
                          <InputGroup.Input
                            type="number"
                            aria-label="Thêm số tháng"
                            min={item.min ?? 1}
                            max={item.max ?? 60}
                            placeholder="+ Số tháng"
                            value={newTagInput[item.key] ?? ''}
                            onChange={(e) =>
                              setNewTagInput((prev) => ({ ...prev, [item.key]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag(item.key, item.min, item.max);
                              }
                            }}
                            className="text-xs text-right font-medium"
                          />
                        </InputGroup>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={<Plus className="w-3 h-3" />}
                          onClick={() => handleAddTag(item.key, item.min, item.max)}
                        >
                          Thêm
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <InputGroup size="sm" className="w-32 sm:w-36">
                      <InputGroup.Input
                        type="number"
                        aria-label={item.label}
                        min={item.min ?? undefined}
                        max={item.max ?? undefined}
                        step={item.value_type === 'float' ? '0.1' : '1'}
                        value={String(currentValue ?? '')}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          handleValueChange(item.key, val);
                        }}
                        className="text-xs text-right font-medium"
                      />
                      {item.unit && (
                        <InputGroup.Addon
                          align="end"
                          className="text-xs text-kumo-subtle font-normal pr-2.5 select-none shrink-0"
                        >
                          {item.unit}
                        </InputGroup.Addon>
                      )}
                    </InputGroup>
                  )}
                </div>
              </LayerCard>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-kumo-subtle pt-2 border-t border-kumo-line">
        <span>Tổng số tham số: {filteredConfigs.length} mục</span>
      </div>
    </div>
  );
};
