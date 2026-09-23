import { Badge, Sidebar as KumoSidebar, Text } from '@cloudflare/kumo';
import {
  Archive,
  ChartBar,
  ClipboardText,
  Clock,
  Coins,
  FileText,
  FileXls,
  Key,
  MapPin,
  Percent,
  Shield,
  ShieldCheck,
  SquaresFour,
  Users,
  Warehouse,
  WarningOctagon,
  Wrench,
} from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import React from 'react';

interface SidebarProps {
  currentRole: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: string;
}

interface MenuGroup {
  groupLabel: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRole, activeTab, onTabChange }) => {
  const facilityManagerGroups: MenuGroup[] = [
    {
      groupLabel: 'Vận hành kho',
      items: [
        { id: 'facility-dashboard', label: 'Tổng quan cơ sở', icon: SquaresFour },
        { id: 'floor-plan', label: 'Sơ đồ mặt bằng (Map)', icon: Warehouse, badge: 'Interactive' },
        { id: 'units', label: 'Quản lý Unit & Kho', icon: Archive },
        { id: 'maintenance', label: 'Lịch sử & Bảo trì kho', icon: Wrench },
        { id: 'handover-return', label: 'Bàn giao & Nghiệm thu', icon: ClipboardText },
      ],
    },
    {
      groupLabel: 'Khách hàng & Hợp đồng',
      items: [
        { id: 'contracts', label: 'Hợp đồng & Đặt cọc', icon: FileText },
        { id: 'waitlist', label: 'Danh sách chờ (Waitlist)', icon: Clock, badge: '2' },
      ],
    },
    {
      groupLabel: 'Nhân sự & An ninh',
      items: [
        { id: 'staff-workload', label: 'Phân công & Staff', icon: Users },
        { id: 'facility-audit', label: 'Audit log cơ sở', icon: ShieldCheck },
      ],
    },
  ];

  const opsManagerGroups: MenuGroup[] = [
    {
      groupLabel: 'Toàn chuỗi & Báo cáo',
      items: [
        { id: 'ops-dashboard', label: 'Tổng quan chuỗi & Heatmap', icon: ChartBar },
        { id: 'executive-reports', label: 'Báo cáo & Xuất file', icon: FileXls },
      ],
    },
    {
      groupLabel: 'Chính sách & Danh mục',
      items: [
        { id: 'facilities-master', label: 'Danh mục cơ sở kho', icon: MapPin },
        { id: 'pricing-policies', label: 'Bảng giá & Chính sách', icon: Coins },
        { id: 'promotions', label: 'Khuyến mãi & Voucher', icon: Percent },
      ],
    },
  ];

  const adminGroups: MenuGroup[] = [
    {
      groupLabel: 'Tài khoản & Phân quyền',
      items: [
        { id: 'users', label: 'Quản lý Người dùng', icon: Users },
        { id: 'roles-permissions', label: 'Quyền & Templates', icon: Shield, badge: 'RBAC' },
      ],
    },
    {
      groupLabel: 'Bảo mật & Giám sát',
      items: [
        { id: 'security-logs', label: 'Lịch sử Đăng nhập', icon: Key },
        { id: 'system-audit', label: 'System Audit Logs', icon: WarningOctagon },
      ],
    },
  ];

  const menuGroups =
    currentRole === 'ADMIN'
      ? adminGroups
      : currentRole === 'OPERATIONS_MANAGER'
        ? opsManagerGroups
        : facilityManagerGroups;

  return (
    <KumoSidebar className="border-r border-kumo-hairline select-none">
      <KumoSidebar.Header className="px-3.5 py-3 border-b border-kumo-hairline">
        <div className="min-w-0">
          <p className="text-xs text-kumo-subtle uppercase tracking-wider truncate">
            {currentRole === 'ADMIN'
              ? 'IAM & Audit'
              : currentRole === 'OPERATIONS_MANAGER'
                ? 'Multi-Zone Operations'
                : 'Zone Fleet Management'}
          </p>
          <Text bold size="sm" truncate>
            {currentRole === 'FACILITY_MANAGER' ? 'Sala Mega Center' : 'StorageHub Platform'}
          </Text>
        </div>
      </KumoSidebar.Header>

      <KumoSidebar.Content>
        {menuGroups.map((group) => (
          <KumoSidebar.Group key={group.groupLabel}>
            <KumoSidebar.GroupLabel>{group.groupLabel}</KumoSidebar.GroupLabel>
            <KumoSidebar.Menu>
              {group.items.map((item) => (
                <KumoSidebar.MenuItem key={item.id}>
                  <KumoSidebar.MenuButton
                    icon={item.icon}
                    active={activeTab === item.id}
                    tooltip={item.label}
                    onClick={() => onTabChange(item.id)}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.badge && <KumoSidebar.MenuBadge>{item.badge}</KumoSidebar.MenuBadge>}
                  </KumoSidebar.MenuButton>
                </KumoSidebar.MenuItem>
              ))}
            </KumoSidebar.Menu>
          </KumoSidebar.Group>
        ))}
      </KumoSidebar.Content>

      <KumoSidebar.Footer className="border-t border-kumo-hairline p-2 flex items-center justify-between">
        <Badge
          variant="success"
          appearance="dot"
          className="group-data-[state=collapsed]/sidebar:hidden"
        >
          Connected
        </Badge>
        <KumoSidebar.Trigger />
      </KumoSidebar.Footer>
    </KumoSidebar>
  );
};
