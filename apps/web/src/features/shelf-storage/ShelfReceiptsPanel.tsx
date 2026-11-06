import { Badge, Button, LayerCard, Pagination, Table } from '@cloudflare/kumo';
import { ShelfReceiptStatus, ShelfReceiptType } from '@storage/types';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ShelfStorageApi } from '../../lib/shelf-storage-api';
import { formatDateTime } from '../inspections/inspection-display';
import { ShelfReceiptFilters } from './ShelfReceiptFilters';
import {
  buildReceiptQuery,
  EMPTY_RECEIPT_FILTERS,
  RECEIPT_TYPE_LABEL,
  type ReceiptFilterState,
  summarizeLines,
} from './shelf-records-display';
import { useShelfLoad } from './use-shelf-load';

const PAGE_SIZE = 20;

export const ShelfReceiptsPanel: React.FC<{
  warehouseId: string;
  refreshKey: number;
  onOpen: (receiptId: string) => void;
}> = ({ warehouseId, refreshKey, onOpen }) => {
  const [filters, setFilters] = useState<ReceiptFilterState>(EMPTY_RECEIPT_FILTERS);
  const [page, setPage] = useState(1);
  const query = useMemo(() => buildReceiptQuery(filters, page, PAGE_SIZE), [filters, page]);
  const { data, loading, error, reload } = useShelfLoad(
    () => ShelfStorageApi.warehouseReceipts(warehouseId, query),
    `${warehouseId}:${JSON.stringify(query)}:${refreshKey}`,
  );
  const receipts = data?.receipts ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-3">
      <ShelfReceiptFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
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
              <Table.Head>Mã phiếu</Table.Head>
              <Table.Head>Loại</Table.Head>
              <Table.Head>Thời gian</Table.Head>
              <Table.Head>Kệ</Table.Head>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Hợp đồng</Table.Head>
              <Table.Head>Đồ</Table.Head>
              <Table.Head>Người thực hiện</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {receipts.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={9} className="text-center py-10 text-kumo-subtle">
                  {loading ? 'Đang tải...' : 'Không có phiếu nào phù hợp.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              receipts.map((r) => (
                <Table.Row
                  key={r.id}
                  className="cursor-pointer hover:bg-kumo-tint"
                  onClick={() => onOpen(r.id)}
                >
                  <Table.Cell className="whitespace-nowrap">
                    <button
                      type="button"
                      className="font-mono text-xs text-kumo-brand hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                      }}
                    >
                      {r.code}
                    </button>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <Badge variant={r.type === ShelfReceiptType.DROP_OFF ? 'primary' : 'neutral'}>
                      {RECEIPT_TYPE_LABEL[r.type]}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-sm">
                    {formatDateTime(String(r.createdAt))}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {r.shelf.code}
                  </Table.Cell>
                  <Table.Cell className="text-sm">{r.customer.fullName ?? '—'}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs">
                    {r.contractNo}
                  </Table.Cell>
                  <Table.Cell className="min-w-[200px] text-sm">
                    {summarizeLines(r.lines)}
                  </Table.Cell>
                  <Table.Cell className="text-sm">{r.performedBy?.fullName ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {r.status === ShelfReceiptStatus.VOIDED && (
                        <Badge variant="error">Đã hủy</Badge>
                      )}
                      {r.recovered && <Badge variant="neutral">Thu hồi</Badge>}
                      {r.openDisputeTicket && <Badge variant="warning">Khách báo sai</Badge>}
                      {r.status === ShelfReceiptStatus.ACTIVE &&
                        !r.recovered &&
                        !r.openDisputeTicket && <Badge variant="success">Hiệu lực</Badge>}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </LayerCard>
      {meta && meta.total > PAGE_SIZE && (
        <Pagination page={page} setPage={setPage} perPage={meta.limit} totalCount={meta.total}>
          <Pagination.Info />
          <Pagination.Controls />
        </Pagination>
      )}
    </div>
  );
};
