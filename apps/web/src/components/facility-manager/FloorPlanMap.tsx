import { Badge, Button, Dialog, Tabs, Text } from '@cloudflare/kumo';
import { Calendar, Phone, Snowflake, User, Warehouse, Wrench, X } from '@phosphor-icons/react';
import { IFacility, IStorageUnit, UnitStatus } from '@storage/types';
import React, { useMemo, useState } from 'react';

interface FloorPlanMapProps {
  facility: IFacility;
  units: IStorageUnit[];
  onUpdateUnitStatus?: (unitId: string, newStatus: UnitStatus) => void;
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

const StatusBadge = ({ status }: { status: UnitStatus }) => (
  <Badge variant={STATUS_BADGE[status].variant} appearance="dot">
    {STATUS_BADGE[status].label}
  </Badge>
);

export const FloorPlanMap: React.FC<FloorPlanMapProps> = ({
  facility,
  units,
  onUpdateUnitStatus,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<IStorageUnit | null>(null);

  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      const matchZone = selectedZone === 'ALL' || unit.zone === selectedZone;
      const matchFloor = selectedFloor === 'ALL' || unit.floor === Number(selectedFloor);
      return matchZone && matchFloor;
    });
  }, [units, selectedZone, selectedFloor]);

  return (
    <div className="space-y-4">
      {/* Header + legend */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" as="h2">
            Sơ đồ mặt bằng kho
          </Text>
          <Text variant="secondary" size="sm">
            {facility.name} • Trạng thái từng ô kho theo khu vực và tầng
          </Text>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {(Object.keys(STATUS_BADGE) as UnitStatus[]).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Text variant="secondary" size="xs">
            Khu vực:
          </Text>
          <Tabs
            variant="segmented"
            size="sm"
            value={selectedZone}
            onValueChange={setSelectedZone}
            tabs={[
              { value: 'ALL', label: 'Tất cả' },
              ...facility.zones.map((z) => ({ value: z, label: z })),
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Text variant="secondary" size="xs">
            Tầng:
          </Text>
          <Tabs
            variant="segmented"
            size="sm"
            value={selectedFloor}
            onValueChange={setSelectedFloor}
            tabs={[
              { value: 'ALL', label: 'Tất cả' },
              { value: '1', label: 'F1' },
              { value: '2', label: 'F2' },
              { value: '3', label: 'F3' },
            ]}
          />
        </div>
        <p className="text-xs text-kumo-subtle ml-auto">
          {filteredUnits.length} / {units.length} units
        </p>
      </div>

      {/* Unit grid */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredUnits.map((unit) => {
            const isSelected = selectedUnit?.id === unit.id;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => setSelectedUnit(unit)}
                className={`p-3 rounded-md border text-left flex flex-col justify-between h-36 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-kumo-brand bg-kumo-info-tint'
                    : 'border-kumo-hairline bg-kumo-base hover:bg-kumo-tint'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <p className="font-mono text-sm font-semibold">{unit.code}</p>
                    <Text variant="secondary" size="xs">
                      Tầng {unit.floor} • {unit.zone}
                    </Text>
                  </div>
                  {unit.isClimateControlled && (
                    <Snowflake
                      className="w-3.5 h-3.5 text-kumo-info shrink-0"
                      aria-label="Kho kiểm soát nhiệt độ"
                    />
                  )}
                </div>

                <div>
                  <p className="text-xs line-clamp-1">{unit.categoryLabel}</p>
                  <p className="font-mono text-xs text-kumo-subtle">
                    {unit.areaM2}m² ({unit.volumeM3}m³)
                  </p>
                </div>

                <div className="flex items-center justify-between w-full pt-2 border-t border-kumo-hairline">
                  <span className="text-xs font-semibold tabular-nums">
                    {(unit.pricePerMonth / 1000).toLocaleString('vi-VN')}k
                  </span>
                  <StatusBadge status={unit.status} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Unit detail dialog */}
      <Dialog.Root open={!!selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)}>
        <Dialog size="lg" className="p-6">
          {selectedUnit && (
            <>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Dialog.Title className="text-base font-semibold">
                      {selectedUnit.code} — {selectedUnit.categoryLabel}
                    </Dialog.Title>
                    <StatusBadge status={selectedUnit.status} />
                  </div>
                  <Dialog.Description className="text-kumo-subtle text-sm">
                    {selectedUnit.zone} • Tầng {selectedUnit.floor}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  render={
                    <Button variant="ghost" shape="square" size="sm" icon={<X />} title="Đóng" />
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3 py-4">
                <div className="p-3 rounded-md bg-kumo-recessed">
                  <Text variant="secondary" size="xs">
                    Kích thước (D × R × C)
                  </Text>
                  <p className="text-sm font-semibold mt-0.5">
                    {selectedUnit.dimensions.lengthM}m × {selectedUnit.dimensions.widthM}m ×{' '}
                    {selectedUnit.dimensions.heightM}m
                  </p>
                </div>
                <div className="p-3 rounded-md bg-kumo-recessed">
                  <Text variant="secondary" size="xs">
                    Diện tích & thể tích
                  </Text>
                  <p className="text-sm font-semibold mt-0.5">
                    {selectedUnit.areaM2} m² ({selectedUnit.volumeM3} m³)
                  </p>
                </div>
                <div className="p-3 rounded-md bg-kumo-recessed">
                  <Text variant="secondary" size="xs">
                    Giá thuê niêm yết
                  </Text>
                  <p className="text-sm font-semibold mt-0.5">
                    {selectedUnit.pricePerMonth.toLocaleString('vi-VN')} ₫/tháng
                  </p>
                </div>
                <div className="p-3 rounded-md bg-kumo-recessed">
                  <Text variant="secondary" size="xs">
                    Tiền cọc quy định
                  </Text>
                  <p className="text-sm font-semibold mt-0.5">
                    {selectedUnit.depositAmount.toLocaleString('vi-VN')} ₫
                  </p>
                </div>
              </div>

              {selectedUnit.currentRenter ? (
                <div className="p-4 rounded-md bg-kumo-info-tint space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Khách đang thuê
                    </p>
                    <Badge variant="primary">{selectedUnit.currentRenter.contractCode}</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <Text bold>{selectedUnit.currentRenter.name}</Text>
                    <p className="text-sm text-kumo-subtle flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedUnit.currentRenter.phone}
                    </p>
                    <p className="text-sm text-kumo-subtle flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {selectedUnit.currentRenter.startDate} → {selectedUnit.currentRenter.endDate}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-md bg-kumo-success-tint">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-kumo-success">
                    <Warehouse className="w-4 h-4" />
                    Kho trống — sẵn sàng bàn giao
                  </p>
                  <Text variant="secondary" size="xs">
                    Đã kiểm tra vệ sinh, khóa điện tử sẵn sàng cấp phát.
                  </Text>
                </div>
              )}

              <div className="py-4">
                <p className="text-xs text-kumo-subtle uppercase tracking-wider mb-2">
                  Đặc tính & tiện ích
                </p>
                <ul className="space-y-1 text-sm text-kumo-default list-disc list-inside">
                  {selectedUnit.features.map((feat) => (
                    <li key={feat}>{feat}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-kumo-hairline">
                {selectedUnit.status === UnitStatus.AVAILABLE ? (
                  <Button
                    variant="primary"
                    onClick={() => alert(`Gán nhanh kho ${selectedUnit.code} cho khách hàng mới.`)}
                    className="flex-1"
                  >
                    Gán hợp đồng cho thuê
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => alert(`Mở hồ sơ hợp đồng của unit ${selectedUnit.code}`)}
                    className="flex-1"
                  >
                    Xem hợp đồng & thanh toán
                  </Button>
                )}
                <Button
                  variant="outline"
                  icon={<Wrench />}
                  onClick={() => {
                    const newStatus =
                      selectedUnit.status === UnitStatus.MAINTENANCE
                        ? UnitStatus.AVAILABLE
                        : UnitStatus.MAINTENANCE;
                    onUpdateUnitStatus?.(selectedUnit.id, newStatus);
                    setSelectedUnit({ ...selectedUnit, status: newStatus });
                  }}
                >
                  {selectedUnit.status === UnitStatus.MAINTENANCE
                    ? 'Hoàn thành bảo trì'
                    : 'Chuyển sang bảo trì'}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
