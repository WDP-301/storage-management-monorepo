import { Badge, Banner, Button, Text } from '@cloudflare/kumo';
import {
  ArrowUpRight,
  CheckCircle,
  Clock,
  CurrencyDollar,
  UserCheck,
  Warehouse,
  WarningCircle,
} from '@phosphor-icons/react';
import { IFacility, IStorageUnit, UnitStatus } from '@storage/types';
import React from 'react';
import { MetricCard } from '../common/MetricCard';

interface FacilityDashboardProps {
  facility: IFacility;
  units: IStorageUnit[];
  onNavigateTab: (tab: string) => void;
}

export const FacilityDashboard: React.FC<FacilityDashboardProps> = ({
  facility,
  units,
  onNavigateTab,
}) => {
  const availableCount = units.filter((u) => u.status === UnitStatus.AVAILABLE).length;
  const overdueCount = units.filter((u) => u.status === UnitStatus.OVERDUE).length;
  const maintenanceCount = units.filter((u) => u.status === UnitStatus.MAINTENANCE).length;

  const tasks = [
    {
      tag: <Badge variant="success">Check-in</Badge>,
      title: 'Check-in nhận kho: Unit A-103',
      badge: <Badge variant="warning">Hẹn 17:00</Badge>,
      meta: 'Khách hàng: Ngô Thanh Hằng • Cấp thẻ từ & mã PIN',
      action: (
        <Button variant="primary" size="xs" onClick={() => onNavigateTab('handover-return')}>
          Bàn giao ngay
        </Button>
      ),
    },
    {
      tag: <Badge variant="error">Trả kho</Badge>,
      title: 'Nghiệm thu trả kho: Unit B-204',
      badge: <Badge variant="error">Sự cố móp cửa</Badge>,
      meta: 'Đặng Tuấn Kiệt đã lập biên bản chụp ảnh • Chờ cấn trừ cọc',
      action: (
        <Button variant="secondary" size="xs" onClick={() => onNavigateTab('contracts')}>
          Duyệt cọc
        </Button>
      ),
    },
    {
      tag: <Badge variant="info">Bảo trì</Badge>,
      title: 'Bảo trì định kỳ: Van PCCC Khu C',
      badge: <Badge variant="neutral">19:00 hôm nay</Badge>,
      meta: 'Kỹ thuật viên: Nguyễn Văn Thái ca đêm',
      action: (
        <Button variant="secondary" size="xs" onClick={() => onNavigateTab('maintenance')}>
          Xem chi tiết
        </Button>
      ),
    },
  ];

  const quickActions = [
    {
      icon: <Warehouse className="w-4 h-4" />,
      title: 'Bulk Update Unit',
      desc: 'Đổi giá/trạng thái hàng loạt',
      tab: 'units',
    },
    {
      icon: <Clock className="w-4 h-4" />,
      title: 'Khớp kho cho Waitlist',
      desc: 'Có 2 khách đang đợi unit',
      tab: 'waitlist',
    },
    {
      icon: <UserCheck className="w-4 h-4" />,
      title: 'Workload nhân sự',
      desc: 'Kiểm tra phân ca & tồn thẻ',
      tab: 'staff-workload',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-kumo-hairline">
        <div>
          <div className="flex items-center gap-2.5">
            <Text variant="heading" size="lg" as="h1">
              Dashboard Vận hành Cơ sở
            </Text>
            <Badge variant="success" appearance="dot">
              Synced
            </Badge>
          </div>
          <p className="text-sm text-kumo-subtle mt-1">
            Cơ sở: <strong className="text-kumo-strong">{facility.name}</strong> • Trưởng chi nhánh:{' '}
            {facility.managerName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Warehouse />}
            onClick={() => onNavigateTab('floor-plan')}
          >
            Sơ đồ mặt bằng
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigateTab('contracts')}>
            Tạo hợp đồng
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tỷ lệ lấp đầy"
          value={`${facility.occupancyRate}%`}
          subtitle={`${facility.occupiedUnits}/${facility.totalUnits} units đã thuê`}
          change="+3.4% tháng trước"
          isPositive={true}
          icon={<Warehouse className="w-5 h-5" />}
        />
        <MetricCard
          title="Kho sẵn sàng cho thuê"
          value={`${availableCount} kho`}
          subtitle="Đã vệ sinh & sẵn sàng bàn giao"
          change="2 khách trong Waitlist"
          isPositive={true}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <MetricCard
          title="Doanh thu lũy kế MTD"
          value="342.500.000 ₫"
          subtitle="Đã thu cọc & tiền thuê"
          change="+12.8% YoY"
          isPositive={true}
          icon={<CurrencyDollar className="w-5 h-5" />}
        />
        <MetricCard
          title="Sự vụ cần xử lý"
          value={`${overdueCount + maintenanceCount} sự vụ`}
          subtitle={`${overdueCount} quá hạn • ${maintenanceCount} đang sửa`}
          change="Cần xử lý ngay"
          isPositive={false}
          icon={<WarningCircle className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's tasks */}
        <div className="lg:col-span-2 rounded-md border border-kumo-hairline bg-kumo-base p-5">
          <div className="flex items-center justify-between pb-3 border-b border-kumo-hairline">
            <div>
              <Text variant="heading" as="h2">
                Lịch tiếp nhận & nghiệm thu hôm nay
              </Text>
              <Text variant="secondary" size="xs">
                3 sự vụ đang chờ điều phối
              </Text>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {tasks.map((task) => (
              <div
                key={task.title}
                className="flex items-center justify-between gap-3 p-3.5 rounded-md border border-kumo-hairline bg-kumo-recessed"
              >
                <div className="flex items-center gap-3">
                  {task.tag}
                  <div>
                    <div className="flex items-center gap-2">
                      <Text bold size="sm">
                        {task.title}
                      </Text>
                      {task.badge}
                    </div>
                    <Text variant="secondary" size="xs">
                      {task.meta}
                    </Text>
                  </div>
                </div>
                {task.action}
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions + alert */}
        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-5 space-y-3">
          <div className="pb-3 border-b border-kumo-hairline">
            <Text variant="heading" as="h2">
              Thao tác nhanh
            </Text>
            <Text variant="secondary" size="xs">
              Nghiệp vụ thường dùng tại cơ sở
            </Text>
          </div>

          <div className="space-y-2">
            {quickActions.map((qa) => (
              <button
                key={qa.title}
                type="button"
                onClick={() => onNavigateTab(qa.tab)}
                className="w-full flex items-center justify-between p-3 rounded-md border border-kumo-hairline hover:bg-kumo-tint text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-kumo-recessed text-kumo-default flex items-center justify-center">
                    {qa.icon}
                  </div>
                  <div>
                    <Text bold size="xs">
                      {qa.title}
                    </Text>
                    <Text variant="secondary" size="xs">
                      {qa.desc}
                    </Text>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-kumo-subtle" />
              </button>
            ))}
          </div>

          <Banner
            variant="alert"
            size="sm"
            icon={<WarningCircle />}
            title="Cảnh báo công nợ quá hạn"
            description={
              <>
                Unit A-105 (khách <strong>Lý Kiến Quốc</strong>) quá hạn 21 ngày. Thẻ RFID đã bị
                khóa và thông báo cấn trừ cọc đã gửi.
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
