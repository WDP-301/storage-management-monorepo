import {
  Badge,
  Button,
  InputGroup,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import { ArrowsClockwise, Eye, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import { ContractsApi } from '../../lib/api';
import type {
  ContractInspectionSummary,
  ContractRecord,
  ContractStatus,
} from '../../types/contract';
import { formatDay } from '../inspections/inspection-display';
import { formatVnd } from '../warehouses/warehouse-display';
import { ContractDetailDialog } from './ContractDetailDialog';
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUSES,
  plannedEnd,
  shortContractNo,
} from './contract-display';

const PAGE_SIZE = 20;

/** One inspection record in the list: who carries it out, or when it was signed off. */
function inspectionCell(step: ContractInspectionSummary | null): {
  label: string;
  needsStaff: boolean;
} {
  if (!step) return { label: '—', needsStaff: false };
  if (step.finalized_at)
    return { label: `Đã chốt ${formatDay(step.finalized_at)}`, needsStaff: false };
  return step.inspector_name
    ? { label: step.inspector_name, needsStaff: false }
    : { label: 'Chưa giao người', needsStaff: true };
}

const ALL = 'ALL';
const STATUS_OPTIONS = [
  { value: ALL, label: 'Tất cả' },
  ...CONTRACT_STATUSES.map((s) => ({ value: s, label: CONTRACT_STATUS_LABEL[s].label })),
];

/** Contracts of the selected facility (every facility for admin/operations when none is picked). */
export const ContractsPage: React.FC = () => {
  const { activeRole } = useAuth();
  const { selectedFacility } = useFacility();
  const [rows, setRows] = useState<ContractRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const facilityId = selectedFacility?.id;
  // A manager always works inside one facility; wait for the picker instead of fetching all.
  const waitingForFacility = activeRole === UserRole.FACILITY_MANAGER && !facilityId;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // A new facility starts from the first page.
  useEffect(() => {
    setPage(1);
  }, [facilityId]);

  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    if (waitingForFacility) {
      setRows([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await ContractsApi.list({
        page,
        limit: PAGE_SIZE,
        facilityId,
        status: status === ALL ? undefined : (status as ContractStatus),
        search: debouncedSearch || undefined,
      });
      if (request !== latestRequest.current) return;
      // Deleting the last row of the last page would otherwise leave an empty page behind.
      if (res.contracts.length === 0 && page > 1 && page > res.meta.totalPages) {
        setPage(Math.max(1, res.meta.totalPages));
        return;
      }
      setRows(res.contracts);
      setTotal(res.meta.total);
    } catch (err) {
      if (request === latestRequest.current) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách hợp đồng.');
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [page, facilityId, status, debouncedSearch, waitingForFacility]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Hợp đồng thuê kho
          </Text>
          <Text variant="secondary">
            Hợp đồng sinh ra khi khách đóng cọc và có hiệu lực khi nhân viên bàn giao kho.
          </Text>
        </div>
        <Button
          variant="secondary"
          icon={<ArrowsClockwise />}
          onClick={() => void load()}
          loading={isLoading}
        >
          Làm mới
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center gap-2.5"
        >
          <WarningCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-60">
          <Select
            aria-label="Lọc trạng thái hợp đồng"
            value={status}
            onValueChange={(v) => {
              if (!v) return;
              setStatus(String(v));
              setPage(1);
            }}
            items={STATUS_OPTIONS}
            renderValue={(v) =>
              `Trạng thái: ${STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v}`
            }
          />
        </div>
        <div className="w-full sm:w-80">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Tìm mã hợp đồng, mã kho, khách, SĐT..."
              aria-label="Tìm hợp đồng"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </InputGroup>
        </div>
      </div>

      <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Mã hợp đồng</Table.Head>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Kho</Table.Head>
              <Table.Head>Thời hạn</Table.Head>
              <Table.Head>Giá / tháng</Table.Head>
              <Table.Head>Biên bản nhận</Table.Head>
              <Table.Head>Biên bản trả</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head className="text-right">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={9} className="text-center py-10 text-kumo-subtle">
                  {isLoading ? 'Đang tải…' : 'Không có hợp đồng nào khớp bộ lọc.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((row) => {
                const code = shortContractNo(row.contract_no);
                const steps = [inspectionCell(row.handover), inspectionCell(row.return)];
                return (
                  <Table.Row key={row.id}>
                    <Table.Cell className="whitespace-nowrap font-mono font-semibold">
                      {code}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm text-kumo-default">
                        {row.customer.full_name ?? 'Khách hàng'}
                      </div>
                      <div className="text-xs text-kumo-subtle">{row.customer.phone ?? ''}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="font-mono font-semibold">{row.unit?.code ?? '—'}</div>
                      <div className="text-xs text-kumo-subtle">{row.facility?.name ?? ''}</div>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      <div>
                        {formatDay(row.effective_at)} → {formatDay(row.ended_at ?? plannedEnd(row))}
                      </div>
                      <div className="text-xs text-kumo-subtle">{row.months} tháng</div>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap font-medium">
                      {formatVnd(row.monthly_price)}
                    </Table.Cell>
                    {steps.map((step, index) => (
                      <Table.Cell
                        // Two fixed columns: handover, then return.
                        key={index}
                        className={`whitespace-nowrap text-xs ${
                          step.needsStaff ? 'text-kumo-warning' : 'text-kumo-subtle'
                        }`}
                      >
                        {step.label}
                      </Table.Cell>
                    ))}
                    <Table.Cell>
                      <Badge variant={CONTRACT_STATUS_LABEL[row.status].variant} appearance="dot">
                        {CONTRACT_STATUS_LABEL[row.status].label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Eye />}
                        aria-label={`Xem hợp đồng ${code}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        Xem
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })
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

      <ContractDetailDialog
        contract={selected}
        onClose={() => setSelectedId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
};
