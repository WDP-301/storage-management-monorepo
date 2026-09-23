import { Badge, Button, Meter, Table, Text } from '@cloudflare/kumo';
import { Buildings, Coins, Fire, MapPin, Percent } from '@phosphor-icons/react';
import { IFacility } from '@storage/types';
import React from 'react';
import { MetricCard } from '../common/MetricCard';

interface OpsDashboardProps {
  facilities: IFacility[];
  onSelectFacility: (facility: IFacility) => void;
  onNavigateTab: (tab: string) => void;
}

export const OpsDashboard: React.FC<OpsDashboardProps> = ({
  facilities,
  onSelectFacility,
  onNavigateTab,
}) => {
  const totalUnits = facilities.reduce((sum, f) => sum + f.totalUnits, 0);
  const occupiedUnits = facilities.reduce((sum, f) => sum + f.occupiedUnits, 0);
  const avgOccupancy = Math.round((occupiedUnits / totalUnits) * 100);

  const heatmapData = [
    {
      zone: 'Hà Nội - Times City (Zone B2)',
      occupancy: 95,
      status: 'CRITICAL_HIGH',
      units: '38/40',
    },
    { zone: 'Hà Nội - Times City (Tầng Lửng)', occupancy: 88, status: 'HIGH', units: '35/40' },
    { zone: 'Hà Nội - Times City (Kho Quần áo)', occupancy: 87, status: 'HIGH', units: '35/40' },
    {
      zone: 'TP.HCM - Sala (Khu A Locker)',
      occupancy: 96,
      status: 'CRITICAL_HIGH',
      units: '48/50',
    },
    { zone: 'TP.HCM - Sala (Khu B Standard)', occupancy: 85, status: 'HIGH', units: '51/60' },
    {
      zone: 'TP.HCM - Sala (Khu C Climate)',
      occupancy: 90,
      status: 'CRITICAL_HIGH',
      units: '36/40',
    },
    { zone: 'TP.HCM - Sala (Khu D Warehouse)', occupancy: 73, status: 'MEDIUM', units: '22/30' },
    { zone: 'Đà Nẵng - Hải Châu (Tầng Trệt)', occupancy: 78, status: 'MEDIUM', units: '27/35' },
    { zone: 'Đà Nẵng - Hải Châu (Lầu 1 Locker)', occupancy: 63, status: 'LOW', units: '19/30' },
  ];

  const getHeatmapBadgeVariant = (occupancy: number) => {
    if (occupancy >= 92) return 'error';
    if (occupancy >= 80) return 'warning';
    if (occupancy >= 70) return 'success';
    return 'primary';
  };

  return (
    <div className="space-y-4">
      {/* Top header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Vận hành toàn chuỗi
          </Text>
          <Text variant="secondary" size="sm">
            Tổng quan mạng lưới {facilities.length} cơ sở kho • Công suất, heatmap và hiệu suất
            doanh thu
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onNavigateTab('pricing-policies')}>
            Chính sách & bảng giá
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigateTab('executive-reports')}>
            Xuất báo cáo toàn chuỗi
          </Button>
        </div>
      </div>

      {/* Aggregate KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tổng cơ sở khai thác"
          value={`${facilities.length} chi nhánh`}
          subtitle="Hà Nội, TP.HCM, Đà Nẵng"
          change="+1 cơ sở dự kiến Q4"
          isPositive={true}
          icon={<Buildings className="w-5 h-5" />}
        />
        <MetricCard
          title="Tỷ lệ lấp đầy toàn mạng lưới"
          value={`${avgOccupancy}%`}
          subtitle={`${occupiedUnits} / ${totalUnits} units`}
          change="+4.2% so với quý trước"
          isPositive={true}
          icon={<Percent className="w-5 h-5" />}
        />
        <MetricCard
          title="Tổng doanh thu tháng này"
          value="892.400.000 ₫"
          subtitle="Đạt 104% chỉ tiêu tháng"
          change="+18.5% YoY"
          isPositive={true}
          icon={<Coins className="w-5 h-5" />}
        />
        <MetricCard
          title="Khu vực chạm ngưỡng đầy"
          value="4 / 9 zones"
          subtitle="Công suất > 90% cần mở rộng"
          change="Cảnh báo thiếu kho mini"
          isPositive={false}
          icon={<Fire className="w-5 h-5 text-kumo-danger" />}
        />
      </div>

      {/* Occupancy heatmap */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-kumo-hairline gap-3">
          <div className="space-y-0.5">
            <Text bold size="sm">
              Heatmap tỷ lệ lấp đầy theo khu vực
            </Text>
            <Text variant="secondary" size="xs">
              Khu vực chạm tải (&gt;90%) cân nhắc tăng giá; khu vực trống (&lt;70%) ưu tiên voucher
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="error" appearance="dot">
              &gt;90%
            </Badge>
            <Badge variant="warning" appearance="dot">
              80–90%
            </Badge>
            <Badge variant="success" appearance="dot">
              70–80%
            </Badge>
            <Badge variant="primary" appearance="dot">
              &lt;70%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {heatmapData.map((item) => (
            <div
              key={item.zone}
              className="p-4 rounded-md border border-kumo-hairline bg-kumo-base hover:bg-kumo-tint transition-colors flex flex-col justify-between h-32"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-kumo-strong">{item.zone}</p>
                  <p className="text-xs text-kumo-subtle mt-0.5">Đang thuê: {item.units} units</p>
                </div>
                <Badge variant={getHeatmapBadgeVariant(item.occupancy)}>{item.occupancy}%</Badge>
              </div>

              <Meter label="Công suất" value={item.occupancy} showValue={false} />

              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-kumo-subtle">
                  {item.occupancy >= 90
                    ? 'Đề xuất: tăng giá 10%'
                    : item.occupancy <= 70
                      ? 'Đề xuất: tung voucher 20%'
                      : 'Hoạt động ổn định'}
                </span>
                <Button variant="ghost" size="xs">
                  Chi tiết
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Facilities comparison table */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
        <div className="p-4 border-b border-kumo-hairline flex items-center justify-between">
          <Text bold size="sm">
            So sánh hiệu suất từng cơ sở
          </Text>
          <Button variant="ghost" size="xs" onClick={() => onNavigateTab('facilities-master')}>
            Quản lý chi tiết cơ sở →
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Cơ sở kho</Table.Head>
                <Table.Head>Địa điểm</Table.Head>
                <Table.Head>Trưởng cơ sở</Table.Head>
                <Table.Head>Quy mô (units)</Table.Head>
                <Table.Head>Tỷ lệ lấp đầy</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Hành động</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {facilities.map((fac) => (
                <Table.Row key={fac.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <img
                        src={fac.imageUrl}
                        alt={fac.name}
                        className="w-10 h-10 rounded-md object-cover border border-kumo-hairline"
                      />
                      <div>
                        <p className="font-semibold text-kumo-strong">{fac.name}</p>
                        <p className="text-xs text-kumo-subtle font-mono">{fac.code}</p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-kumo-subtle shrink-0" />
                      <span>
                        {fac.district}, {fac.city}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-medium">{fac.managerName}</Table.Cell>
                  <Table.Cell>
                    <span className="font-semibold text-kumo-strong">{fac.occupiedUnits}</span>
                    <span className="text-kumo-subtle"> / {fac.totalUnits} kho</span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Meter
                        label={fac.name}
                        value={fac.occupancyRate}
                        showValue={false}
                        className="flex-1"
                      />
                      <span className="text-xs font-semibold text-kumo-strong tabular-nums">
                        {fac.occupancyRate}%
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="success" appearance="dot">
                      Hoạt động tốt
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        onSelectFacility(fac);
                        onNavigateTab('facility-dashboard');
                      }}
                    >
                      Vào quản lý
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>
    </div>
  );
};
