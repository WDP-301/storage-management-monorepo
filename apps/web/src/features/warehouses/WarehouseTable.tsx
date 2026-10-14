import { Badge, Button, DropdownMenu, Empty, LayerCard, Table } from '@cloudflare/kumo';
import {
  DotsThree,
  Eye,
  MapPin,
  PencilSimple,
  Rows,
  Trash,
  Warehouse as WarehouseIcon,
} from '@phosphor-icons/react';
import React from 'react';
import type { Warehouse } from '../../types/warehouse';
import { hasValidCoordinates } from './goong-map';
import {
  formatArea,
  formatDimensions,
  formatShelfSummary,
  formatVolume,
  formatWarehouseDeposit,
  formatWarehousePrice,
  isShelfWarehouse,
  WAREHOUSE_STATUS_LABEL,
} from './warehouse-display';

interface Props {
  warehouses: Warehouse[];
  hasFilters: boolean;
  onEdit: (w: Warehouse) => void;
  onViewMap: (w: Warehouse) => void;
  onDelete: (w: Warehouse) => void;
  onManageShelves?: (w: Warehouse) => void;
}

export const WarehouseTable: React.FC<Props> = ({
  warehouses,
  hasFilters,
  onEdit,
  onViewMap,
  onDelete,
  onManageShelves,
}) => (
  <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Chi nhánh</Table.Head>
          <Table.Head>Mã kho</Table.Head>
          <Table.Head>Tên kho</Table.Head>
          <Table.Head>Địa chỉ</Table.Head>
          <Table.Head>Kích thước (D×R×C)</Table.Head>
          <Table.Head>Diện tích</Table.Head>
          <Table.Head>Thể tích</Table.Head>
          <Table.Head>Giá / tháng</Table.Head>
          <Table.Head>Đặt cọc</Table.Head>
          <Table.Head>Trạng thái</Table.Head>
          <Table.Head className="text-right">Thao tác</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {warehouses.length === 0 && (
          <Table.Row>
            <Table.Cell className="p-0" colSpan={11}>
              <Empty
                size="sm"
                icon={<WarehouseIcon className="w-8 h-8" />}
                title="Không có kho nào"
                description={
                  hasFilters
                    ? 'Không có kho nào khớp bộ lọc hiện tại.'
                    : 'Chưa có kho nào trong hệ thống. Hãy thêm kho đầu tiên.'
                }
              />
            </Table.Cell>
          </Table.Row>
        )}
        {warehouses.map((w) => {
          const shelfCount = formatShelfSummary(w);
          return (
            <Table.Row key={w.id}>
              <Table.Cell className="whitespace-nowrap text-kumo-default">
                {w.facility.name}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                {w.code}
              </Table.Cell>
              <Table.Cell className="font-medium text-kumo-default min-w-[180px]">
                <div className="flex items-center gap-2">
                  {w.images?.[0]?.url && (
                    <img
                      src={w.images[0].url}
                      alt=""
                      className="w-9 h-9 rounded-md object-cover shrink-0 border border-kumo-line"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{w.name}</span>
                      {isShelfWarehouse(w) && <Badge variant="primary">Kho kệ</Badge>}
                    </div>
                    {shelfCount && <div className="text-xs text-kumo-subtle">{shelfCount}</div>}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell className="text-kumo-subtle min-w-[200px]">{w.addressLine}</Table.Cell>
              <Table.Cell className="whitespace-nowrap text-kumo-default">
                {formatDimensions(w)}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap">{formatArea(w.areaM2)}</Table.Cell>
              <Table.Cell className="whitespace-nowrap">{formatVolume(w.volumeM3)}</Table.Cell>
              <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                {formatWarehousePrice(w)}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                {formatWarehouseDeposit(w)}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap">
                <Badge variant={WAREHOUSE_STATUS_LABEL[w.status].variant}>
                  {WAREHOUSE_STATUS_LABEL[w.status].label}
                </Badge>
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-right">
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    render={
                      <Button
                        size="sm"
                        variant="ghost"
                        shape="square"
                        icon={<DotsThree weight="bold" className="w-4 h-4" />}
                        aria-label={`Thao tác kho ${w.code}`}
                        title={`Thao tác kho ${w.code}`}
                      />
                    }
                  />
                  <DropdownMenu.Content align="end" sideOffset={4}>
                    <DropdownMenu.Item
                      icon={isShelfWarehouse(w) ? Rows : Eye}
                      onClick={() => onManageShelves?.(w)}
                    >
                      {isShelfWarehouse(w) ? 'Kệ & Sơ đồ' : 'Chi tiết kho'}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      icon={MapPin}
                      disabled={!hasValidCoordinates(w)}
                      onClick={() => onViewMap(w)}
                    >
                      Xem trên bản đồ
                    </DropdownMenu.Item>
                    <DropdownMenu.Item icon={PencilSimple} onClick={() => onEdit(w)}>
                      Chỉnh sửa
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item variant="danger" icon={Trash} onClick={() => onDelete(w)}>
                      Xóa kho
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
                {/* Accessible action buttons for screen readers and automated tests */}
                <div className="sr-only">
                  {isShelfWarehouse(w) && onManageShelves && (
                    <button
                      type="button"
                      aria-label={`Quản lý kệ kho ${w.code}`}
                      onClick={() => onManageShelves(w)}
                    >
                      Kệ & Sơ đồ
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Xem kho ${w.code} trên bản đồ`}
                    onClick={() => onViewMap(w)}
                  >
                    Bản đồ
                  </button>
                  <button
                    type="button"
                    aria-label={`Chỉnh sửa kho ${w.code}`}
                    onClick={() => onEdit(w)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    aria-label={`Xóa kho ${w.code}`}
                    onClick={() => onDelete(w)}
                  >
                    Xóa
                  </button>
                </div>
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  </LayerCard>
);
