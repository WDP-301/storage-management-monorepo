import { Badge, Button, Empty, InputGroup, LayerCard, Select, Table, Text } from '@cloudflare/kumo';
import { MagnifyingGlass, Wrench } from '@phosphor-icons/react';
import React from 'react';
import type { Warehouse, WarehouseStatus } from '../../../types/warehouse';
import {
  formatArea,
  formatDimensions,
  formatVnd,
  WAREHOUSE_STATUS_LABEL,
} from '../../warehouses/warehouse-display';

const STATUS_ITEMS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  ...(Object.keys(WAREHOUSE_STATUS_LABEL) as WarehouseStatus[]).map((s) => ({
    value: s,
    label: WAREHOUSE_STATUS_LABEL[s].label,
  })),
];

interface Props {
  warehouses: Warehouse[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  busyId: string | null;
  onToggleMaintenance: (w: Warehouse) => void;
}

export const ManagedWarehousesTable: React.FC<Props> = ({
  warehouses,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  busyId,
  onToggleMaintenance,
}) => (
  <div className="space-y-3">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="grid gap-1">
        <Text as="h3" variant="heading">
          Danh sách kho của cơ sở
        </Text>
        <Text variant="secondary">Theo dõi hiện trạng kho và chuyển trạng thái bảo trì.</Text>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-56">
          <InputGroup size="sm">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              aria-label="Tìm mã kho hoặc tên kho"
              placeholder="Tìm mã hoặc tên kho..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </InputGroup>
        </div>
        <div className="w-48">
          <Select
            aria-label="Lọc trạng thái kho"
            size="sm"
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(String(v))}
            items={STATUS_ITEMS}
          />
        </div>
      </div>
    </div>

    <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Cơ sở</Table.Head>
            <Table.Head>Mã kho</Table.Head>
            <Table.Head>Tên kho</Table.Head>
            <Table.Head>Địa chỉ</Table.Head>
            <Table.Head>Kích thước</Table.Head>
            <Table.Head>Giá / tháng</Table.Head>
            <Table.Head>Trạng thái</Table.Head>
            <Table.Head className="text-right">Thao tác quản lý</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {warehouses.map((w) => (
            <Table.Row key={w.id}>
              <Table.Cell className="whitespace-nowrap text-kumo-default">
                {w.facility.name}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                {w.code}
              </Table.Cell>
              <Table.Cell className="font-medium text-kumo-default">{w.name}</Table.Cell>
              <Table.Cell className="text-kumo-subtle min-w-[200px]">{w.addressLine}</Table.Cell>
              <Table.Cell className="whitespace-nowrap text-kumo-default">
                {formatDimensions(w)} ({formatArea(w.areaM2)})
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                {formatVnd(w.monthlyPrice)}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap">
                <Badge variant={WAREHOUSE_STATUS_LABEL[w.status].variant}>
                  {WAREHOUSE_STATUS_LABEL[w.status].label}
                </Badge>
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-right">
                {(w.status === 'AVAILABLE' || w.status === 'MAINTENANCE') && (
                  <Button
                    variant={w.status === 'MAINTENANCE' ? 'secondary' : 'outline'}
                    size="sm"
                    icon={<Wrench className="w-3.5 h-3.5" />}
                    disabled={busyId === w.id}
                    onClick={() => onToggleMaintenance(w)}
                  >
                    {w.status === 'MAINTENANCE' ? 'Mở lại kho' : 'Báo bảo trì'}
                  </Button>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
          {warehouses.length === 0 && (
            <Table.Row>
              <Table.Cell className="p-0" colSpan={8}>
                <Empty
                  size="sm"
                  title="Không có kho nào"
                  description="Không có kho nào khớp bộ lọc hiện tại."
                />
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </LayerCard>
  </div>
);
