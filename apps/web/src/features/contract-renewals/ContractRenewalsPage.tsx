import { Badge, Button, LayerCard, Pagination, Select, Table, Text } from '@cloudflare/kumo';
import { ArrowsClockwise, CheckCircle, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { ContractRenewalStatus, type ContractRenewalView } from '@storage/types';
import React, { useCallback, useEffect, useState } from 'react';
import { ContractRenewalsApi } from '../../lib/contract-renewals-api';
import { useAppToast } from '../../lib/toast';
import { formatVnDateTime, formatVnDay, lastDayBefore } from '../../lib/vn-day';
import { formatVnd } from '../warehouses/warehouse-display';
import { RenewalDecisionDialog } from './RenewalDecisionDialog';

const PAGE_SIZE = 20;
const ALL = 'ALL';

export const RENEWAL_STATUS_LABEL: Record<
  ContractRenewalStatus,
  { label: string; variant: 'warning' | 'success' | 'neutral' | 'error' }
> = {
  PENDING: { label: 'Chờ duyệt', variant: 'warning' },
  APPROVED: { label: 'Đã gia hạn', variant: 'success' },
  REJECTED: { label: 'Từ chối', variant: 'error' },
  CANCELLED: { label: 'Khách đã hủy', variant: 'neutral' },
};

const STATUS_OPTIONS = [
  { value: ContractRenewalStatus.PENDING, label: 'Chờ duyệt' },
  { value: ALL, label: 'Tất cả' },
];

const lastDay = (termEndAt: string) => formatVnDay(lastDayBefore(termEndAt));

/** Renewal requests of the caller's facilities; a pending one is approved or rejected here. */
export const ContractRenewalsPage: React.FC = () => {
  const toast = useAppToast();
  const [rows, setRows] = useState<ContractRenewalView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>(ContractRenewalStatus.PENDING);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{
    renewal: ContractRenewalView;
    action: 'approve' | 'reject';
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ContractRenewalsApi.list({
        page,
        limit: PAGE_SIZE,
        status: status === ALL ? undefined : (status as ContractRenewalStatus),
      });
      setRows(res.items);
      setTotal(res.meta.total);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Không tải được yêu cầu gia hạn.');
    } finally {
      setIsLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const decided = (renewal: ContractRenewalView) => {
    setDeciding(null);
    toast.success(
      renewal.status === ContractRenewalStatus.APPROVED ? 'Đã duyệt gia hạn' : 'Đã từ chối',
      `Hợp đồng ${renewal.contract_no}`,
    );
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-kumo-default">Gia hạn hợp đồng</h1>
          <Text variant="secondary" size="sm">
            Khách xin thuê tiếp với giá hiện tại. Duyệt sẽ cộng thêm số tháng vào hợp đồng.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Lọc trạng thái"
            value={status}
            onValueChange={(v) => {
              setStatus(String(v));
              setPage(1);
            }}
            items={STATUS_OPTIONS}
          />
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className={isLoading ? 'animate-spin' : ''} />}
            onClick={load}
            disabled={isLoading}
          >
            Tải lại
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-kumo-danger-tint text-kumo-danger text-sm">
          <WarningCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <LayerCard>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Hợp đồng · Kho</Table.Head>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Gia hạn</Table.Head>
              <Table.Head>Hết hạn</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head className="text-center">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-10 text-kumo-subtle">
                  <CircleNotch className="w-5 h-5 animate-spin inline-block mr-2" />
                  Đang tải…
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-10">
                  <CheckCircle className="w-6 h-6 text-kumo-success inline-block mb-1" />
                  <div className="text-kumo-subtle text-sm">Không có yêu cầu gia hạn nào.</div>
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <div className="font-medium text-kumo-default">{r.contract_no}</div>
                    <div className="text-xs text-kumo-subtle">
                      {r.unit_code ?? '—'}
                      {r.facility_name ? ` · ${r.facility_name}` : ''}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-kumo-default">{r.customer?.full_name ?? '—'}</div>
                    <div className="text-xs text-kumo-subtle">{r.customer?.phone ?? ''}</div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <div className="font-medium text-kumo-default">+{r.months} tháng</div>
                    <div className="text-xs text-kumo-subtle">
                      {formatVnd(r.monthly_price)}/tháng
                    </div>
                    {r.note && <div className="text-xs text-kumo-subtle max-w-56">“{r.note}”</div>}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-sm">
                    <div className="text-kumo-subtle">Hiện tại: {lastDay(r.term_end_at)}</div>
                    <div className="text-kumo-default">
                      Sau gia hạn: {lastDay(r.new_term_end_at)}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={RENEWAL_STATUS_LABEL[r.status].variant}>
                      {RENEWAL_STATUS_LABEL[r.status].label}
                    </Badge>
                    <div className="text-xs text-kumo-subtle mt-1">
                      {r.decided_at
                        ? `${r.decided_by_name ?? ''} · ${formatVnDateTime(r.decided_at)}`
                        : `Gửi ${formatVnDateTime(r.created_at)}`}
                    </div>
                    {r.decision_note && (
                      <div className="text-xs text-kumo-subtle max-w-56">{r.decision_note}</div>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-center whitespace-nowrap">
                    {r.status === ContractRenewalStatus.PENDING ? (
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeciding({ renewal: r, action: 'reject' })}
                        >
                          Từ chối
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setDeciding({ renewal: r, action: 'approve' })}
                        >
                          Duyệt
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-kumo-subtle">—</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </LayerCard>

      {total > 0 && (
        <div className="pt-2 border-t border-kumo-line">
          <Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={total}>
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        </div>
      )}

      {deciding && (
        <RenewalDecisionDialog
          renewal={deciding.renewal}
          action={deciding.action}
          onClose={() => setDeciding(null)}
          onDecided={decided}
        />
      )}
    </div>
  );
};
