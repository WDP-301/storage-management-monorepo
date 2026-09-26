import { Badge, Button, LayerCard, Table, Text } from '@cloudflare/kumo';
import { AlertCircle, Building2, CheckCircle, Layers, Wrench } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface UnitRecord {
  code: string;
  floor: number;
  type: string;
  sizeM2: number;
  priceVnd: number;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'HELD';
}

interface ChangeRequest {
  id: string;
  customerName: string;
  currentUnit: string;
  targetUnit: string;
  reason: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const INITIAL_UNITS: UnitRecord[] = [
  {
    code: 'A-101',
    floor: 1,
    type: 'Kho gia đình Standard',
    sizeM2: 5,
    priceVnd: 1500000,
    status: 'RENTED',
  },
  {
    code: 'A-102',
    floor: 1,
    type: 'Kho gia đình Standard',
    sizeM2: 5,
    priceVnd: 1500000,
    status: 'AVAILABLE',
  },
  {
    code: 'A-103',
    floor: 1,
    type: 'Kho lớn Doanh nghiệp',
    sizeM2: 12,
    priceVnd: 3200000,
    status: 'RENTED',
  },
  {
    code: 'B-201',
    floor: 2,
    type: 'Tủ Locker mini',
    sizeM2: 1.5,
    priceVnd: 600000,
    status: 'AVAILABLE',
  },
  {
    code: 'B-202',
    floor: 2,
    type: 'Kho kiểm soát độ ẩm',
    sizeM2: 8,
    priceVnd: 2600000,
    status: 'MAINTENANCE',
  },
  {
    code: 'B-203',
    floor: 2,
    type: 'Kho gia đình Standard',
    sizeM2: 5,
    priceVnd: 1500000,
    status: 'HELD',
  },
];

const INITIAL_REQUESTS: ChangeRequest[] = [
  {
    id: 'req-01',
    customerName: 'Trần Minh Đức',
    currentUnit: 'A-101 (5m²)',
    targetUnit: 'A-103 (12m²)',
    reason: 'Cần mở rộng không gian chứa hàng Tết',
    date: '24/09/2026',
    status: 'PENDING',
  },
  {
    id: 'req-02',
    customerName: 'Nguyễn Thị Hoa',
    currentUnit: 'B-201 (1.5m²)',
    targetUnit: 'A-102 (5m²)',
    reason: 'Chuyển thêm đồ nội thất',
    date: '25/09/2026',
    status: 'PENDING',
  },
];

export const FacilityManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [units, setUnits] = useState<UnitRecord[]>(INITIAL_UNITS);
  const [requests, setRequests] = useState<ChangeRequest[]>(INITIAL_REQUESTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionAlert, setActionAlert] = useState<string | null>(null);

  const toggleMaintenance = (unitCode: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.code === unitCode) {
          const nextStatus = u.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
          setActionAlert(
            `Đã cập nhật trạng thái kho ${unitCode} thành: ${nextStatus === 'MAINTENANCE' ? 'Đang bảo trì' : 'Sẵn sàng thuê'}`,
          );
          setTimeout(() => setActionAlert(null), 4000);
          return { ...u, status: nextStatus };
        }
        return u;
      }),
    );
  };

  const handleRequestAction = (reqId: string, action: 'APPROVED' | 'REJECTED') => {
    setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: action } : r)));
    setActionAlert(
      action === 'APPROVED'
        ? `Đã phê duyệt yêu cầu đổi kho thành công.`
        : `Đã từ chối yêu cầu đổi kho.`,
    );
    setTimeout(() => setActionAlert(null), 4000);
  };

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const availableCount = units.filter((u) => u.status === 'AVAILABLE').length;
  const rentedCount = units.filter((u) => u.status === 'RENTED').length;
  const maintenanceCount = units.filter((u) => u.status === 'MAINTENANCE').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <Building2 className="w-5 h-5" />
            </span>
            <Text as="h2">Facility management</Text>
            <Badge variant="teal">Cơ sở Sài Gòn Riverside (HCM-01)</Badge>
          </div>
          <Text variant="secondary">
            Quản lý danh mục các ô kho, trạng thái bảo trì, duyệt yêu cầu chuyển kho của khách hàng.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" appearance="dot">
            Quản lý trực: {user?.fullName}
          </Badge>
        </div>
      </div>

      {actionAlert && (
        <div className="p-3 bg-kumo-info-tint text-kumo-info rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionAlert}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Kho đang cho thuê</Text>
            <Layers className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{rentedCount}</span>
            <Badge variant="success">83.3% lấp đầy</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Kho sẵn sàng trống</Text>
            <CheckCircle className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{availableCount}</span>
            <Badge variant="primary">Có thể thuê ngay</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Yêu cầu đổi kho chờ duyệt</Text>
            <AlertCircle className="w-4 h-4 text-kumo-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{pendingRequestsCount}</span>
            <Badge variant="warning">Cần xử lý</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Đang bảo trì / Sửa chữa</Text>
            <Wrench className="w-4 h-4 text-kumo-danger" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">{maintenanceCount}</span>
            <Badge variant="neutral">Kho bảo dưỡng</Badge>
          </div>
        </LayerCard>
      </div>

      {/* Customer Change Requests Approval Queue */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Yêu cầu nâng cấp & đổi kho từ khách hàng
          </Text>
          <Text variant="secondary">
            Phê duyệt hoặc từ chối đơn chuyển đổi đơn vị kho của người thuê.
          </Text>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Khách hàng</Table.Head>
                <Table.Head>Kho hiện tại</Table.Head>
                <Table.Head>Kho muốn chuyển đến</Table.Head>
                <Table.Head>Lý do chuyển</Table.Head>
                <Table.Head>Ngày gửi</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Quyết định</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {requests.map((req) => (
                <Table.Row key={req.id}>
                  <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                    {req.customerName}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {req.currentUnit}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs text-kumo-brand font-semibold">
                    {req.targetUnit}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {req.reason}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">{req.date}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {req.status === 'PENDING' && <Badge variant="warning">Chờ duyệt</Badge>}
                    {req.status === 'APPROVED' && <Badge variant="success">Đã duyệt</Badge>}
                    {req.status === 'REJECTED' && <Badge variant="error">Từ chối</Badge>}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    {req.status === 'PENDING' ? (
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRequestAction(req.id, 'APPROVED')}
                        >
                          Duyệt
                        </Button>
                        <Button
                          variant="secondary-destructive"
                          size="sm"
                          onClick={() => handleRequestAction(req.id, 'REJECTED')}
                        >
                          Từ chối
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-kumo-subtle">Đã xử lý</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>

      {/* Unit Inventory Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid gap-1">
            <Text as="h3" variant="heading">
              Danh sách đơn vị kho tại chi nhánh
            </Text>
            <Text variant="secondary">
              Cập nhật giá niêm yết, chuyển trạng thái bảo trì và quản lý hiện trạng kho.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Tìm mã kho hoặc loại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs px-2.5 rounded-md bg-kumo-base border border-kumo-line text-kumo-default w-48"
            />
            <select
              aria-label="Lọc trạng thái kho"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs px-2.5 rounded-md bg-kumo-base border border-kumo-line text-kumo-default"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AVAILABLE">Sẵn sàng (Trống)</option>
              <option value="RENTED">Đang thuê</option>
              <option value="MAINTENANCE">Bảo trì</option>
              <option value="HELD">Đang giữ chỗ</option>
            </select>
          </div>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã ô kho</Table.Head>
                <Table.Head>Tầng</Table.Head>
                <Table.Head>Quy cách kho</Table.Head>
                <Table.Head>Diện tích</Table.Head>
                <Table.Head>Đơn giá tháng</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Thao tác quản lý</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredUnits.map((u) => (
                <Table.Row key={u.code}>
                  <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                    {u.code}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    Tầng {u.floor}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                    {u.type}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default">
                    {u.sizeM2} m²
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default font-medium">
                    {u.priceVnd.toLocaleString('vi-VN')} đ/tháng
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {u.status === 'AVAILABLE' && <Badge variant="success">Sẵn sàng</Badge>}
                    {u.status === 'RENTED' && <Badge variant="primary">Đang thuê</Badge>}
                    {u.status === 'MAINTENANCE' && <Badge variant="error">Đang bảo trì</Badge>}
                    {u.status === 'HELD' && <Badge variant="warning">Đang giữ chỗ</Badge>}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    <Button
                      variant={u.status === 'MAINTENANCE' ? 'secondary' : 'outline'}
                      size="sm"
                      icon={<Wrench className="w-3.5 h-3.5" />}
                      onClick={() => toggleMaintenance(u.code)}
                    >
                      {u.status === 'MAINTENANCE' ? 'Mở lại kho' : 'Báo bảo trì'}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>
    </div>
  );
};
