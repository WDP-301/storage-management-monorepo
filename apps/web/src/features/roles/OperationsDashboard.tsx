import { Badge, Button, LayerCard, Table, Text } from '@cloudflare/kumo';
import {
  ArrowUpRight,
  BarChart3,
  Building,
  CheckCircle,
  Download,
  Layers,
  LineChart,
  Percent,
} from 'lucide-react';
import React, { useState } from 'react';

interface FacilityMetric {
  id: string;
  code: string;
  name: string;
  city: string;
  totalUnits: number;
  rentedUnits: number;
  occupancyRate: number;
  monthlyRevenue: string;
  status: 'OPTIMAL' | 'HIGH_DEMAND' | 'NEEDS_MAINTENANCE';
}

const FACILITIES_METRICS: FacilityMetric[] = [
  {
    id: 'fac-1',
    code: 'HCM-01',
    name: 'Cơ sở Sài Gòn Riverside',
    city: 'TP. Hồ Chí Minh (Q.1)',
    totalUnits: 320,
    rentedUnits: 298,
    occupancyRate: 93.1,
    monthlyRevenue: '447.000.000 đ',
    status: 'HIGH_DEMAND',
  },
  {
    id: 'fac-2',
    code: 'HCM-02',
    name: 'Cơ sở Thủ Đức Mega Hub',
    city: 'TP. Thủ Đức',
    totalUnits: 450,
    rentedUnits: 382,
    occupancyRate: 84.8,
    monthlyRevenue: '573.000.000 đ',
    status: 'OPTIMAL',
  },
  {
    id: 'fac-3',
    code: 'HN-01',
    name: 'Cơ sở Hà Nội Central',
    city: 'Hà Nội (Cầu Giấy)',
    totalUnits: 280,
    rentedUnits: 235,
    occupancyRate: 83.9,
    monthlyRevenue: '352.500.000 đ',
    status: 'OPTIMAL',
  },
  {
    id: 'fac-4',
    code: 'DN-01',
    name: 'Cơ sở Đà Nẵng Hải Châu',
    city: 'Đà Nẵng (Hải Châu)',
    totalUnits: 190,
    rentedUnits: 134,
    occupancyRate: 70.5,
    monthlyRevenue: '201.000.000 đ',
    status: 'NEEDS_MAINTENANCE',
  },
];

const UNIT_DISTRIBUTION = [
  { type: 'Tủ Locker mini (1m²)', count: 240, occupied: 220, rate: '91%' },
  { type: 'Kho gia đình Standard (5m²)', count: 480, occupied: 412, rate: '85%' },
  { type: 'Kho doanh nghiệp Medium (10m²)', count: 320, occupied: 268, rate: '83%' },
  { type: 'Kho lạnh & kiểm soát nhiệt độ (15m²)', count: 200, occupied: 149, rate: '74%' },
];

export const OperationsDashboard: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const handleExportReport = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setReportMessage('Báo cáo phân tích công suất toàn mạng lưới đã được kết xuất thành công.');
      setTimeout(() => setReportMessage(null), 5000);
    }, 800);
  };

  const totalNetworkUnits = FACILITIES_METRICS.reduce((acc, f) => acc + f.totalUnits, 0);
  const totalRentedUnits = FACILITIES_METRICS.reduce((acc, f) => acc + f.rentedUnits, 0);
  const averageOccupancy = (
    FACILITIES_METRICS.reduce((acc, f) => acc + f.occupancyRate, 0) / FACILITIES_METRICS.length
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <LineChart className="w-5 h-5" />
            </span>
            <Text as="h2">Operations overview</Text>
            <Badge variant="blue">Operations director</Badge>
          </div>
          <Text variant="secondary">
            Bảng điều phối giám sát toàn bộ mạng lưới kho bãi, tỷ lệ lấp đầy liên cơ sở và năng lực
            vận hành.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            loading={downloading}
            onClick={handleExportReport}
          >
            Xuất báo cáo vận hành
          </Button>
        </div>
      </div>

      {reportMessage && (
        <div className="p-3 bg-kumo-success-tint text-kumo-success rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{reportMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tỷ lệ lấp đầy toàn mạng</Text>
            <Percent className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{averageOccupancy}%</span>
            <Badge variant="success">+3.2% tháng này</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tổng kho đang thuê</Text>
            <Layers className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">
              {totalRentedUnits}{' '}
              <span className="text-xs text-kumo-subtle">/ {totalNetworkUnits}</span>
            </span>
            <Badge variant="primary">Đang hoạt động</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Doanh thu dự kiến tháng</Text>
            <BarChart3 className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">1.573 Tỷ</span>
            <Badge variant="success">VND</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Mạng lưới cơ sở</Text>
            <Building className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">4 Cơ sở</span>
            <Badge variant="neutral">3 Thành phố</Badge>
          </div>
        </LayerCard>
      </div>

      {/* Facility Network Comparison Table */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Hiệu suất và công suất từng chi nhánh
          </Text>
          <Text variant="secondary">
            So sánh tỷ lệ lấp đầy, doanh thu định kỳ và mức cảnh báo công suất giữa các cơ sở.
          </Text>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã cơ sở</Table.Head>
                <Table.Head>Tên cơ sở kho</Table.Head>
                <Table.Head>Khu vực</Table.Head>
                <Table.Head>Đang thuê / Tổng kho</Table.Head>
                <Table.Head>Tỷ lệ lấp đầy</Table.Head>
                <Table.Head>Doanh thu định kỳ</Table.Head>
                <Table.Head className="text-right">Tình trạng tải</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {FACILITIES_METRICS.map((fac) => (
                <Table.Row key={fac.id}>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {fac.code}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                    {fac.name}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">{fac.city}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default">
                    <span className="font-semibold">{fac.rentedUnits}</span> / {fac.totalUnits}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{fac.occupancyRate}%</span>
                      <div className="w-16 h-2 rounded-full bg-kumo-fill overflow-hidden">
                        <div
                          className={`h-full ${
                            fac.occupancyRate > 90
                              ? 'bg-kumo-danger'
                              : fac.occupancyRate > 80
                                ? 'bg-kumo-brand'
                                : 'bg-kumo-warning'
                          }`}
                          style={{ width: `${fac.occupancyRate}%` }}
                        />
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default">
                    {fac.monthlyRevenue}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    {fac.status === 'HIGH_DEMAND' && (
                      <Badge variant="error" appearance="dot">
                        Gần quá tải (&gt;90%)
                      </Badge>
                    )}
                    {fac.status === 'OPTIMAL' && (
                      <Badge variant="success" appearance="dot">
                        Tối ưu (80-90%)
                      </Badge>
                    )}
                    {fac.status === 'NEEDS_MAINTENANCE' && (
                      <Badge variant="warning" appearance="dot">
                        Cần tiếp thị (&lt;75%)
                      </Badge>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>

      {/* Unit Types Allocation Grid */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Phân bổ loại kho & nhu cầu thị trường
          </Text>
          <Text variant="secondary">
            Thống kê tỷ lệ thuê theo từng kích cỡ và đặc tính lưu trữ.
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {UNIT_DISTRIBUTION.map((dist, idx) => (
            <LayerCard key={idx} className="px-5 py-4 ring ring-kumo-line">
              <Text as="strong" bold>
                {dist.type}
              </Text>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xl font-semibold text-kumo-default">
                  {dist.occupied} / {dist.count}
                </span>
                <Badge variant="blue">{dist.rate} thuê</Badge>
              </div>
              <div className="mt-2 text-xs text-kumo-subtle flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-kumo-brand" />
                <span>Nhu cầu ổn định</span>
              </div>
            </LayerCard>
          ))}
        </div>
      </div>
    </div>
  );
};
