import { Badge, Button, InputGroup, LayerCard, Pagination, Table } from '@cloudflare/kumo';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { PickupRequestStatus, type WarehouseShelfStockView } from '@storage/types';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ShelfStorageApi } from '../../lib/shelf-storage-api';
import { useClientPagination } from '../../lib/use-client-pagination';
import { formatDateTime } from '../inspections/inspection-display';
import { PICKUP_REQUEST_STATUS_LABEL, summarizeLines } from './shelf-records-display';
import { useShelfLoad } from './use-shelf-load';

const PAGE_SIZE = 20;

const matches = (row: WarehouseShelfStockView, q: string) =>
  [row.shelf.code, row.shelf.name, row.contractNo, row.customer.fullName, row.customer.phone]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));

const RequestBadge: React.FC<{ row: WarehouseShelfStockView }> = ({ row }) => {
  const req = row.openRequest;
  if (!req) return null;
  const ready = req.status === PickupRequestStatus.READY;
  return (
    <Badge variant={ready ? 'success' : 'warning'}>
      {PICKUP_REQUEST_STATUS_LABEL[req.status]} · {formatDateTime(String(req.requestedFor))}
    </Badge>
  );
};

export const ShelfStockPanel: React.FC<{ warehouseId: string; refreshKey: number }> = ({
  warehouseId,
  refreshKey,
}) => {
  const { data, loading, error, reload } = useShelfLoad(
    () => ShelfStorageApi.warehouseStock(warehouseId),
    `${warehouseId}:${refreshKey}`,
  );
  const [search, setSearch] = useState('');
  const [onlyStocked, setOnlyStocked] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (row) => (!onlyStocked || row.totalQuantity > 0) && (!q || matches(row, q)),
    );
  }, [data, search, onlyStocked]);
  const { page, setPage, pageItems, paged } = useClientPagination(
    rows,
    PAGE_SIZE,
    `${search}|${onlyStocked}`,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-1.5 text-sm text-kumo-default cursor-pointer">
          <input
            type="checkbox"
            checked={onlyStocked}
            onChange={(e) => setOnlyStocked(e.target.checked)}
          />
          Chỉ kệ có đồ
        </label>
        <div className="w-full sm:w-72">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Tìm kệ, hợp đồng, khách..."
              aria-label="Tìm kệ đang cho thuê"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </InputGroup>
        </div>
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
              <Table.Head>Kệ</Table.Head>
              <Table.Head>Hợp đồng</Table.Head>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Đồ đang gửi</Table.Head>
              <Table.Head className="text-right">Tổng</Table.Head>
              <Table.Head>Tình trạng</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {pageItems.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-10 text-kumo-subtle">
                  {loading ? 'Đang tải...' : 'Không có kệ nào đang cho thuê phù hợp.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              pageItems.map((row) => (
                <Table.Row key={row.contractId}>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {row.shelf.code}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {row.contractNo}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block text-sm">{row.customer.fullName ?? '—'}</span>
                    <span className="block text-xs text-kumo-subtle">
                      {row.customer.phone ?? ''}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="min-w-[220px] text-sm">
                    {row.items.length ? summarizeLines(row.items, 50) : 'Kệ trống'}
                  </Table.Cell>
                  <Table.Cell className="text-right font-semibold">{row.totalQuantity}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      <RequestBadge row={row} />
                      {row.returnOpen && <Badge variant="neutral">Đang trả kệ</Badge>}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </LayerCard>
      {paged && (
        <Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={rows.length}>
          <Pagination.Info />
          <Pagination.Controls />
        </Pagination>
      )}
    </div>
  );
};
