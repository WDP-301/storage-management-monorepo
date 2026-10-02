import { Badge, Button, LayerCard, Text } from '@cloudflare/kumo';
import {
  CheckCircle,
  Clock,
  CreditCard,
  FileCheck2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import React, { useState } from 'react';

export type ConfigCategory = 'all' | 'booking' | 'contract' | 'billing' | 'security';

export interface SystemConfigItem {
  key: string;
  label: string;
  description: string;
  type: 'number' | 'text' | 'boolean';
  value: string | number | boolean;
  defaultValue: string | number | boolean;
  unit?: string;
  category: 'booking' | 'contract' | 'billing' | 'security';
}

const INITIAL_CONFIGS: SystemConfigItem[] = [
  // Category: Booking & Hold
  {
    key: 'booking_hold_timeout_minutes',
    label: 'Thời gian giữ chỗ tạm thời (Hold timeout)',
    description:
      'Thời gian tối đa hệ thống tạm giữ kho cho khách hàng hoàn tất đặt cọc trước khi tự động giải phóng kho (Mục 3 tài liệu nghiệp vụ).',
    type: 'number',
    value: 15,
    defaultValue: 15,
    unit: 'phút',
    category: 'booking',
  },
  {
    key: 'booking_deposit_rate_percent',
    label: 'Tỷ lệ tiền đặt cọc tối thiểu',
    description:
      'Mức cọc chuẩn khi tạo hợp đồng thuê kho mới (Quy định chuẩn bằng 100% giá thuê của 1 tháng).',
    type: 'number',
    value: 100,
    defaultValue: 100,
    unit: '% giá thuê tháng',
    category: 'booking',
  },
  {
    key: 'booking_search_radius_km',
    label: 'Bán kính tìm kiếm cơ sở lân cận',
    description:
      'Khoảng cách địa lý tối đa theo tọa độ (kinh độ, vĩ độ) để tự động đề xuất các cơ sở kho gần nhau khi thuê nhiều kho.',
    type: 'number',
    value: 15,
    defaultValue: 15,
    unit: 'km',
    category: 'booking',
  },
  {
    key: 'waitlist_offer_expiry_hours',
    label: 'Thời hạn giữ kho cho danh sách chờ',
    description:
      'Thời gian cho phép khách hàng trong danh sách chờ xác nhận đề xuất giữ kho trước khi chuyển sang khách tiếp theo.',
    type: 'number',
    value: 24,
    defaultValue: 24,
    unit: 'giờ',
    category: 'booking',
  },

  // Category: Contract & Transition
  {
    key: 'transition_grace_period_hours',
    label: 'Thời gian ân hạn chuyển tiếp khi đổi kho',
    description:
      'Khoảng thời gian khách hàng được phép mở khóa và sử dụng đồng thời cả kho cũ và kho mới để dọn đồ chuyển kho (Mục 7 tài liệu nghiệp vụ).',
    type: 'number',
    value: 48,
    defaultValue: 48,
    unit: 'giờ',
    category: 'contract',
  },
  {
    key: 'contract_renewal_notice_days',
    label: 'Thời hạn gửi thông báo nhắc gia hạn',
    description:
      'Số ngày trước khi hợp đồng kết thúc để hệ thống tự động gửi thông báo đề xuất gia hạn kỳ thuê mới đến khách hàng.',
    type: 'number',
    value: 7,
    defaultValue: 7,
    unit: 'ngày trước hạn',
    category: 'contract',
  },
  {
    key: 'min_rental_duration_months',
    label: 'Thời hạn thuê tối thiểu cho hợp đồng mới',
    description:
      'Đơn vị thời gian thuê tối thiểu được chấp nhận khi khách hàng tạo lượt thuê kho mới.',
    type: 'number',
    value: 1,
    defaultValue: 1,
    unit: 'tháng',
    category: 'contract',
  },
  {
    key: 'inspection_required_on_checkout',
    label: 'Bắt buộc kiểm tra biên bản hiện trạng khi trả kho',
    description:
      'Yêu cầu nhân viên cơ sở chụp ảnh nghiệm thu và xác nhận biên bản tình trạng kho trước khi giải phóng cọc.',
    type: 'boolean',
    value: true,
    defaultValue: true,
    category: 'contract',
  },

  // Category: Billing & Payment
  {
    key: 'vat_tax_rate_percent',
    label: 'Thuế giá trị gia tăng (VAT)',
    description:
      'Mức thuế suất VAT áp dụng khi xuất hóa đơn thanh toán cho tiền thuê kho và các dịch vụ đi kèm.',
    type: 'number',
    value: 8,
    defaultValue: 8,
    unit: '%',
    category: 'billing',
  },
  {
    key: 'overdue_penalty_fee_per_day',
    label: 'Phí phạt quá hạn trả kho mỗi ngày',
    description:
      'Khoản phí phát sinh tính trên mỗi ngày trễ hạn bàn giao trả kho nếu chưa thực hiện gia hạn hợp đồng.',
    type: 'number',
    value: 50000,
    defaultValue: 50000,
    unit: 'VNĐ / ngày',
    category: 'billing',
  },
  {
    key: 'auto_refund_deposit_enabled',
    label: 'Tự động duyệt hoàn cọc sau nghiệm thu đạt chuẩn',
    description:
      'Tự động tạo lệnh hoàn cọc sau khi nhân viên xác nhận biên bản trả kho không phát sinh hư hỏng hoặc công nợ.',
    type: 'boolean',
    value: true,
    defaultValue: true,
    category: 'billing',
  },

  // Category: Security & Session
  {
    key: 'session_max_age_days',
    label: 'Thời hạn hiệu lực phiên đăng nhập (Session TTL)',
    description:
      'Thời gian tồn tại tối đa của cookie phiên bảo mật (sid) trên trình duyệt trước khi người dùng cần đăng nhập lại.',
    type: 'number',
    value: 7,
    defaultValue: 7,
    unit: 'ngày',
    category: 'security',
  },
  {
    key: 'max_login_failed_attempts',
    label: 'Giới hạn số lần đăng nhập sai tối đa',
    description:
      'Số lần nhập sai mật khẩu liên tiếp cho phép trước khi tạm khóa địa chỉ IP hoặc tài khoản trong 15 phút.',
    type: 'number',
    value: 5,
    defaultValue: 5,
    unit: 'lần',
    category: 'security',
  },
  {
    key: 'system_maintenance_mode',
    label: 'Chế độ bảo trì hệ thống toàn diện',
    description:
      'Tạm dừng các thao tác đặt kho và thanh toán từ phía khách hàng (chỉ quản trị viên mới có thể truy cập hệ thống).',
    type: 'boolean',
    value: false,
    defaultValue: false,
    category: 'security',
  },
];

const CATEGORY_TABS: { id: ConfigCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'Tất cả tham số', icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: 'booking', label: 'Đặt kho & Giữ chỗ', icon: <Clock className="w-4 h-4" /> },
  { id: 'contract', label: 'Hợp đồng & Đổi kho', icon: <FileCheck2 className="w-4 h-4" /> },
  { id: 'billing', label: 'Tài chính & Phí', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'security', label: 'Bảo mật & Phiên', icon: <Shield className="w-4 h-4" /> },
];

export const SystemSettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<SystemConfigItem[]>(INITIAL_CONFIGS);
  const [activeTab, setActiveTab] = useState<ConfigCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleValueChange = (key: string, newValue: string | number | boolean) => {
    setConfigs((prev) =>
      prev.map((item) => (item.key === key ? { ...item, value: newValue } : item)),
    );
  };

  const handleResetDefaults = () => {
    setConfigs((prev) => prev.map((item) => ({ ...item, value: item.defaultValue })));
    setSaveStatus('Đã khôi phục toàn bộ tham số về giá trị mặc định.');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate backend API persistence (Mock UI for now)
    setTimeout(() => {
      setIsSaving(false);
      setSaveStatus('Đã lưu cấu hình tham số hệ thống thành công (Mock UI).');
      setTimeout(() => setSaveStatus(null), 4000);
    }, 600);
  };

  const filteredConfigs = configs.filter((item) => {
    const matchesCategory = activeTab === 'all' || item.category === activeTab;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const getCategoryBadge = (category: SystemConfigItem['category']) => {
    switch (category) {
      case 'booking':
        return <Badge variant="blue">Đặt kho</Badge>;
      case 'contract':
        return <Badge variant="teal">Hợp đồng</Badge>;
      case 'billing':
        return <Badge variant="success">Tài chính</Badge>;
      case 'security':
        return <Badge variant="purple">Bảo mật</Badge>;
      default:
        return <Badge variant="neutral">Chung</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <Settings className="w-5 h-5" />
            </span>
            <Text as="h2">Cấu hình tham số hệ thống</Text>
            <Badge variant="purple">System parameters</Badge>
          </div>
          <Text variant="secondary">
            Thiết lập các quy tắc vận hành, thời gian giữ kho, chính sách cọc và bảo mật toàn hệ
            thống.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleResetDefaults}
          >
            Mặc định
          </Button>
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            loading={isSaving}
            onClick={handleSave}
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {/* Save / Notice Alert */}
      {saveStatus && (
        <div className="p-3.5 bg-kumo-info-tint text-kumo-info rounded-lg text-sm flex items-center gap-2.5 ring ring-kumo-line">
          <CheckCircle className="w-4 h-4 shrink-0 text-kumo-brand" />
          <span className="font-medium">{saveStatus}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-kumo-tint/60 rounded-lg border border-kumo-line">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-kumo-base text-kumo-brand shadow-xs font-semibold'
                  : 'text-kumo-subtle hover:text-kumo-default'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-kumo-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm kiếm tham số..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-kumo-base border border-kumo-line text-kumo-default rounded-lg focus:outline-none focus:ring-2 focus:ring-kumo-brand/30"
          />
        </div>
      </div>

      {/* Configuration List */}
      <div className="space-y-3">
        {filteredConfigs.length === 0 ? (
          <LayerCard className="p-8 text-center ring ring-kumo-line">
            <Text variant="secondary">Không tìm thấy tham số cấu hình phù hợp với từ khóa.</Text>
          </LayerCard>
        ) : (
          filteredConfigs.map((item) => (
            <LayerCard
              key={item.key}
              className="p-4 sm:p-5 ring ring-kumo-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-kumo-brand/30"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Text as="strong" bold>
                    {item.label}
                  </Text>
                  {getCategoryBadge(item.category)}
                  <code className="text-[11px] px-1.5 py-0.5 rounded bg-kumo-tint text-kumo-subtle font-mono">
                    {item.key}
                  </code>
                </div>
                <Text variant="secondary" size="xs">
                  {item.description}
                </Text>
              </div>

              {/* Form Input Control */}
              <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                {item.type === 'boolean' ? (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(item.value)}
                      onChange={(e) => handleValueChange(item.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-kumo-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kumo-brand" />
                    <span className="ml-2 text-xs font-medium text-kumo-default">
                      {item.value ? 'Bật' : 'Tắt'}
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={String(item.value)}
                      onChange={(e) => handleValueChange(item.key, Number(e.target.value))}
                      className="w-24 sm:w-28 h-8 px-2.5 text-xs text-right bg-kumo-base border border-kumo-line text-kumo-default rounded-md focus:outline-none focus:ring-1 focus:ring-kumo-brand font-medium"
                    />
                    {item.unit && (
                      <span className="text-xs text-kumo-subtle min-w-[3.5rem]">{item.unit}</span>
                    )}
                  </div>
                )}
              </div>
            </LayerCard>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-kumo-subtle pt-2 border-t border-kumo-line">
        <span>Tổng số tham số: {configs.length} mục</span>
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-kumo-brand" />
          <span>Sẵn sàng liên kết API</span>
        </span>
      </div>
    </div>
  );
};
