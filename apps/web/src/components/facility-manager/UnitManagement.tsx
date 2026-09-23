import { Badge, Button, Dialog, Input, Select, Table, Tabs, Text } from '@cloudflare/kumo';
import {
  CheckSquare,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { IStorageUnit, UnitSizeCategory, UnitStatus } from '@storage/types';
import React, { useMemo, useState } from 'react';

interface UnitManagementProps {
  units: IStorageUnit[];
  onBulkUpdateStatus?: (unitIds: string[], status: UnitStatus) => void;
  onBulkUpdatePrice?: (unitIds: string[], price: number) => void;
}

const STATUS_BADGE: Record<
  UnitStatus,
  { variant: 'success' | 'primary' | 'warning' | 'neutral' | 'error'; label: string }
> = {
  [UnitStatus.AVAILABLE]: { variant: 'success', label: 'Trống' },
  [UnitStatus.OCCUPIED]: { variant: 'primary', label: 'Đang thuê' },
  [UnitStatus.RESERVED]: { variant: 'warning', label: 'Đã cọc' },
  [UnitStatus.MAINTENANCE]: { variant: 'neutral', label: 'Bảo trì' },
  [UnitStatus.OVERDUE]: { variant: 'error', label: 'Quá hạn' },
};

export const UnitManagement: React.FC<UnitManagementProps> = ({
  units: initialUnits,
  onBulkUpdateStatus,
  onBulkUpdatePrice,
}) => {
  const [units, setUnits] = useState<IStorageUnit[]>(initialUnits);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState<UnitStatus>(UnitStatus.AVAILABLE);
  const [bulkNewPrice, setBulkNewPrice] = useState<number>(0);

  const [assignVolume, setAssignVolume] = useState<number>(5);
  const [assignCategory, setAssignCategory] = useState<UnitSizeCategory>(UnitSizeCategory.STANDARD);
  const [recommendedUnit, setRecommendedUnit] = useState<IStorageUnit | null>(null);

  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      const matchSearch =
        unit.code.toLowerCase().includes(search.toLowerCase()) ||
        (unit.currentRenter?.name?.toLowerCase() || '').includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || unit.status === statusFilter;
      const matchCategory = categoryFilter === 'ALL' || unit.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [units, search, statusFilter, categoryFilter]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedUnitIds(checked ? filteredUnits.map((u) => u.id) : []);
  };

  const handleSelectUnit = (id: string, checked: boolean) => {
    setSelectedUnitIds((prev) => (checked ? [...prev, id] : prev.filter((uId) => uId !== id)));
  };

  const handleApplyBulkUpdate = () => {
    if (selectedUnitIds.length === 0) return;
    setUnits((prev) =>
      prev.map((u) =>
        selectedUnitIds.includes(u.id)
          ? {
              ...u,
              status: bulkNewStatus || u.status,
              pricePerMonth: bulkNewPrice > 0 ? bulkNewPrice : u.pricePerMonth,
            }
          : u,
      ),
    );
    onBulkUpdateStatus?.(selectedUnitIds, bulkNewStatus);
    if (bulkNewPrice > 0) onBulkUpdatePrice?.(selectedUnitIds, bulkNewPrice);
    setShowBulkModal(false);
    setSelectedUnitIds([]);
    alert(`Đã cập nhật thành công cho ${selectedUnitIds.length} unit!`);
  };

  const runAutoAssign = () => {
    const candidate = units
      .filter((u) => u.status === UnitStatus.AVAILABLE && u.volumeM3 >= assignVolume)
      .sort((a, b) => a.volumeM3 - b.volumeM3)[0];
    setRecommendedUnit(candidate || null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Quản lý danh sách Unit
          </Text>
          <Text variant="secondary" size="sm">
            {units.length} kho • Cấu hình, đơn giá và phân bổ tự động
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkle />}
            onClick={() => setShowAutoAssignModal(true)}
          >
            Auto-assign
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus />}
            onClick={() => alert('Mở form tạo thêm Unit kho mới vào cơ sở.')}
          >
            Thêm Unit mới
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4 space-y-3">
        <div className="relative w-full">
          <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-kumo-placeholder z-10" />
          <Input
            aria-label="Tìm unit"
            placeholder="Tìm theo mã kho (A-101) hoặc tên khách thuê..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-kumo-hairline">
          <div className="flex items-center gap-2 flex-wrap">
            <Text variant="secondary" size="xs">
              Trạng thái:
            </Text>
            <Tabs
              variant="segmented"
              size="sm"
              value={statusFilter}
              onValueChange={setStatusFilter}
              tabs={[
                { value: 'ALL', label: 'Tất cả' },
                { value: UnitStatus.AVAILABLE, label: 'Trống' },
                { value: UnitStatus.OCCUPIED, label: 'Đang thuê' },
                { value: UnitStatus.RESERVED, label: 'Đã cọc' },
                { value: UnitStatus.OVERDUE, label: 'Quá hạn' },
                { value: UnitStatus.MAINTENANCE, label: 'Bảo trì' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Text variant="secondary" size="xs">
              Loại kho:
            </Text>
            <Tabs
              variant="segmented"
              size="sm"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              tabs={[
                { value: 'ALL', label: 'Tất cả' },
                { value: UnitSizeCategory.LOCKER, label: 'Locker' },
                { value: UnitSizeCategory.STANDARD, label: 'Tiêu chuẩn' },
                { value: UnitSizeCategory.CLIMATE_CONTROLLED, label: 'Kho mát' },
                { value: UnitSizeCategory.LARGE, label: 'Kho lớn' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedUnitIds.length > 0 && (
        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-3 flex items-center justify-between">
          <Text bold size="sm" as="span">
            <CheckSquare className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Đã chọn {selectedUnitIds.length} / {units.length} units
          </Text>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="xs" onClick={() => setShowBulkModal(true)}>
              Bulk update
            </Button>
            <Button variant="secondary" size="xs" onClick={() => setSelectedUnitIds([])}>
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.CheckHead
                  checked={
                    selectedUnitIds.length === filteredUnits.length && filteredUnits.length > 0
                  }
                  indeterminate={
                    selectedUnitIds.length > 0 && selectedUnitIds.length < filteredUnits.length
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Chọn tất cả unit"
                />
                <Table.Head>Mã unit</Table.Head>
                <Table.Head>Khu vực / Tầng</Table.Head>
                <Table.Head>Loại kho</Table.Head>
                <Table.Head>Diện tích / Thể tích</Table.Head>
                <Table.Head>Đơn giá / tháng</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head>Khách đang thuê</Table.Head>
                <Table.Head className="text-right">Thao tác</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredUnits.map((unit) => {
                const isSelected = selectedUnitIds.includes(unit.id);
                return (
                  <Table.Row key={unit.id} data-selected={isSelected || undefined}>
                    <Table.CheckCell
                      checked={isSelected}
                      onCheckedChange={(checked: boolean) => handleSelectUnit(unit.id, checked)}
                      aria-label={`Chọn unit ${unit.code}`}
                    />
                    <Table.Cell className="font-mono font-semibold">{unit.code}</Table.Cell>
                    <Table.Cell>
                      <div>
                        <span className="font-medium text-kumo-strong">{unit.zone}</span>
                        <p className="text-xs text-kumo-subtle">Tầng {unit.floor}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{unit.categoryLabel}</Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-kumo-strong">{unit.areaM2} m²</span>
                      <span className="text-kumo-subtle ml-1">({unit.volumeM3} m³)</span>
                    </Table.Cell>
                    <Table.Cell className="font-semibold tabular-nums">
                      {unit.pricePerMonth.toLocaleString('vi-VN')} ₫
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATUS_BADGE[unit.status].variant} appearance="dot">
                        {STATUS_BADGE[unit.status].label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {unit.currentRenter ? (
                        <div>
                          <p className="font-medium text-kumo-strong">{unit.currentRenter.name}</p>
                          <p className="text-xs text-kumo-subtle font-mono">
                            Hạn: {unit.currentRenter.endDate}
                          </p>
                        </div>
                      ) : (
                        <span className="text-kumo-subtle">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        variant="ghost"
                        shape="square"
                        size="xs"
                        icon={<PencilSimple />}
                        aria-label={`Chỉnh sửa ${unit.code}`}
                        onClick={() => alert(`Chỉnh sửa chi tiết unit ${unit.code}`)}
                      />
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </div>

      {/* Bulk update dialog */}
      <Dialog.Root open={showBulkModal} onOpenChange={setShowBulkModal}>
        <Dialog className="p-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
            <Dialog.Title className="text-base font-semibold">
              Cập nhật hàng loạt ({selectedUnitIds.length} kho)
            </Dialog.Title>
            <Dialog.Close
              render={<Button variant="ghost" shape="square" size="sm" icon={<X />} title="Đóng" />}
            />
          </div>

          <div className="space-y-4 py-4">
            <Select
              label="Trạng thái mới"
              value={bulkNewStatus}
              onValueChange={(v) => v && setBulkNewStatus(v as UnitStatus)}
              items={{
                [UnitStatus.AVAILABLE]: 'Trống (sẵn sàng cho thuê)',
                [UnitStatus.MAINTENANCE]: 'Đang bảo trì',
                [UnitStatus.RESERVED]: 'Đã đặt cọc',
              }}
            />
            <Input
              label="Đơn giá thuê mới (₫/tháng)"
              type="number"
              placeholder="Để trống nếu không đổi giá"
              description="Bỏ trống để giữ nguyên giá hiện tại"
              value={bulkNewPrice || ''}
              onChange={(e) => setBulkNewPrice(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-kumo-hairline">
            <Dialog.Close
              render={
                <Button variant="secondary" className="flex-1">
                  Hủy
                </Button>
              }
            />
            <Button variant="primary" onClick={handleApplyBulkUpdate} className="flex-1">
              Áp dụng thay đổi
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Auto-assign dialog */}
      <Dialog.Root open={showAutoAssignModal} onOpenChange={setShowAutoAssignModal}>
        <Dialog size="lg" className="p-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
            <div>
              <Dialog.Title className="text-base font-semibold">
                Gán unit tự động (Auto-assign)
              </Dialog.Title>
              <Dialog.Description className="text-kumo-subtle text-sm mt-0.5">
                Tìm unit còn trống tối ưu nhất theo thể tích yêu cầu và loại kho.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={<Button variant="ghost" shape="square" size="sm" icon={<X />} title="Đóng" />}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 py-4">
            <Input
              label="Thể tích cần chứa (m³)"
              type="number"
              value={assignVolume}
              onChange={(e) => setAssignVolume(Number(e.target.value))}
            />
            <Select
              label="Ưu tiên loại kho"
              value={assignCategory}
              onValueChange={(v) => v && setAssignCategory(v as UnitSizeCategory)}
              items={{
                [UnitSizeCategory.LOCKER]: 'Locker (1 - 2 m³)',
                [UnitSizeCategory.STANDARD]: 'Tiêu chuẩn (8 - 15 m³)',
                [UnitSizeCategory.CLIMATE_CONTROLLED]: 'Kiểm soát nhiệt ẩm',
                [UnitSizeCategory.LARGE]: 'Kho lớn (16 - 30 m³)',
              }}
            />
          </div>

          <Button variant="primary" icon={<Sparkle />} onClick={runAutoAssign} className="w-full">
            Tìm unit tối ưu nhất
          </Button>

          {recommendedUnit && (
            <div className="mt-4 p-4 rounded-md border border-kumo-hairline bg-kumo-info-tint space-y-2">
              <div className="flex items-center justify-between">
                <Text bold size="sm">
                  Gợi ý: Unit {recommendedUnit.code} ({recommendedUnit.categoryLabel})
                </Text>
                <Badge variant="success" appearance="dot">
                  Đang trống
                </Badge>
              </div>
              <Text variant="secondary" size="sm">
                {recommendedUnit.zone} • Tầng {recommendedUnit.floor} • {recommendedUnit.volumeM3}{' '}
                m³
              </Text>
              <Text bold size="sm">
                {recommendedUnit.pricePerMonth.toLocaleString('vi-VN')} ₫/tháng
              </Text>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => {
                  alert(`Đã gán thành công Unit ${recommendedUnit.code} cho khách hàng!`);
                  setShowAutoAssignModal(false);
                }}
              >
                Xác nhận gán unit này
              </Button>
            </div>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
