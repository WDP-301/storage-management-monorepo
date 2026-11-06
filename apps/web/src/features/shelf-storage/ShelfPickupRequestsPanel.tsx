import { Badge, Button, LayerCard, Select, Table } from '@cloudflare/kumo';
import { PickupRequestStatus } from '@storage/types';
import type React from 'react';
import { ShelfStorageApi } from '../../lib/shelf-storage-api';
import { formatDateTime } from '../inspections/inspection-display';
import { PICKUP_REQUEST_STATUS_LABEL } from './shelf-records-display';
import { useShelfLoad } from './use-shelf-load';

type Scope = 'OPEN' | 'ALL';
const SCOPES = [
  { value: 'OPEN', label: 'Đang chờ xử lý' },
  { value: 'ALL', label: 'Tất cả (50 gần nhất)' },
];

const STATUS_VARIANT = {
  [PickupRequestStatus.PENDING]: 'warning',
  [PickupRequestStatus.READY]: 'success',
  [PickupRequestStatus.COMPLETED]: 'neutral',
  [PickupRequestStatus.CANCELLED]: 'neutral',
} as const;

/** Read-only: staff prepare and complete requests from the mobile counter. */
export const ShelfPickupRequestsPanel: React.FC<{
  warehouseId: string;
  refreshKey: number;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
}> = ({ warehouseId, refreshKey, scope, onScopeChange }) => {
  const { data, loading, error, reload } = useShelfLoad(
    () => ShelfStorageApi.warehousePickupRequests(warehouseId, scope),
    `${warehouseId}:${scope}:${refreshKey}`,
  );
  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <div className="w-60">
        <Select
          aria-label="Phạm vi yêu cầu lấy đồ"
          value={scope}
          onValueChange={(v) => v && onScopeChange(v as Scope)}
          items={SCOPES}
          renderValue={(v) => SCOPES.find((o) => o.value === v)?.label ?? String(v)}
        />
      </div>
      {error && (
        <div role="alert" className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm">
          {error}{' '}
          <Button size="sm" variant="secondary" onClick={reload}>
            Thử lại
          </Button>
        </div>
      )}
      <LayerCard className="ring ring-kumo-line overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Hẹn lấy lúc</Table.Head>
              <Table.Head>Kệ</Table.Head>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Đồ cần lấy</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5} className="text-center py-10 text-kumo-subtle">
                  {loading ? 'Đang tải...' : 'Không có yêu cầu lấy đồ.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((req) => (
                <Table.Row key={req.id}>
                  <Table.Cell className="whitespace-nowrap text-sm">
                    {formatDateTime(String(req.requestedFor))}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {req.shelf.code}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block text-sm">{req.customer.fullName ?? '—'}</span>
                    <span className="block text-xs text-kumo-subtle">
                      {req.customer.phone ?? ''}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="min-w-[220px] text-sm">
                    {req.lines.map((l) => `${l.name} ×${l.quantity}`).join(', ')}
                    {req.note && <span className="block text-xs text-kumo-subtle">{req.note}</span>}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={STATUS_VARIANT[req.status]}>
                      {PICKUP_REQUEST_STATUS_LABEL[req.status]}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </LayerCard>
    </div>
  );
};
