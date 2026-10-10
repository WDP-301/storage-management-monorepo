import { Badge, Button, Empty, LayerCard, Table } from '@cloudflare/kumo';
import { MapPin, PencilSimple, Trash, Warehouse as WarehouseIcon } from '@phosphor-icons/react';
import React from 'react';
import type { Warehouse } from '../../types/warehouse';
import { hasValidCoordinates } from './goong-map';
import {
  formatArea,
  formatDeposit,
  formatDimensions,
  formatVnd,
  formatVolume,
  WAREHOUSE_STATUS_LABEL,
} from './warehouse-display';

interface Props {
  warehouses: Warehouse[];
  hasFilters: boolean;
  onEdit: (w: Warehouse) => void;
  onViewMap: (w: Warehouse) => void;
  onDelete: (w: Warehouse) => void;
}

export const WarehouseTable: React.FC<Props> = ({
  warehouses,
  hasFilters,
  onEdit,
  onViewMap,
  onDelete,
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
        {warehouses.map((w) => (
          <Table.Row key={w.id}>
            <Table.Cell className="whitespace-nowrap text-kumo-default">
              {w.facility.name}
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
              {w.code}
            </Table.Cell>
            <Table.Cell className="font-medium text-kumo-default min-w-[160px]">
              <div className="flex items-center gap-2">
                {w.images?.[0]?.url && (
                  <img
                    src={w.images[0].url}
                    alt=""
                    className="w-9 h-9 rounded-md object-cover shrink-0 border border-kumo-line"
                  />
                )}
                <span>{w.name}</span>
              </div>
            </Table.Cell>
            <Table.Cell className="text-kumo-subtle min-w-[200px]">{w.addressLine}</Table.Cell>
            <Table.Cell className="whitespace-nowrap text-kumo-default">
              {formatDimensions(w)}
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap">{formatArea(w.areaM2)}</Table.Cell>
            <Table.Cell className="whitespace-nowrap">{formatVolume(w.volumeM3)}</Table.Cell>
            <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
              {formatVnd(w.monthlyPrice)}
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap text-kumo-subtle">
              {formatDeposit(w)}
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap">
              <Badge variant={WAREHOUSE_STATUS_LABEL[w.status].variant}>
                {WAREHOUSE_STATUS_LABEL[w.status].label}
              </Badge>
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap text-right">
              <div className="inline-flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  aria-label={`Xem kho ${w.code} trên bản đồ`}
                  disabled={!hasValidCoordinates(w)}
                  onClick={() => onViewMap(w)}
                >
                  Bản đồ
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<PencilSimple className="w-3.5 h-3.5" />}
                  aria-label={`Chỉnh sửa kho ${w.code}`}
                  onClick={() => onEdit(w)}
                >
                  Sửa
                </Button>
                <Button
                  variant="secondary-destructive"
                  size="sm"
                  icon={<Trash className="w-3.5 h-3.5" />}
                  aria-label={`Xóa kho ${w.code}`}
                  onClick={() => onDelete(w)}
                >
                  Xóa
                </Button>
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  </LayerCard>
);
