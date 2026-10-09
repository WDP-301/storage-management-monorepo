import { Badge, Button, InputGroup, LayerCard, Select, Table, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  DoorOpen,
  Eye,
  MagnifyingGlass,
  SignOut,
  UserPlus,
  WarningCircle,
} from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFacility } from '../../context/FacilityContext';
import { InspectionsApi } from '../../lib/api';
import type { InspectionKind, InspectionRecord } from '../../types/inspection';
import { InspectionDetailDialog } from './InspectionDetailDialog';
import {
  customerName,
  customerPhone,
  formatDay,
  INSPECTION_KIND_LABEL,
  INSPECTION_STATE_LABEL,
  type InspectionState,
  inspectionMetrics,
  inspectionState,
  matchesSearch,
  unitCode,
} from './inspection-display';

const STATE_BADGE: Record<InspectionState, 'warning' | 'neutral' | 'success'> = {
  unassigned: 'warning',
  open: 'neutral',
  done: 'success',
};

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PRE_HANDOVER', label: 'Nhận kho' },
  { value: 'RETURN', label: 'Trả kho' },
];
const STATE_OPTIONS = [
  { value: 'ACTIVE', label: 'Chưa chốt' },
  { value: 'unassigned', label: 'Chưa giao người' },
  { value: 'done', label: 'Đã chốt' },
  { value: 'ALL', label: 'Tất cả' },
];

/** Handover and return records of the selected facility: assign staff, review, finalize. */
export const ManagerInspectionsPage: React.FC = () => {
  const { selectedFacility } = useFacility();
  const { activeRole } = useAuth();
  const [rows, setRows] = useState<InspectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const facilityId = selectedFacility?.id;
  // A facility manager's list is always one facility: until the selector has resolved,
  // an unfiltered request would return every managed facility and could land last.
  const waitingForFacility = activeRole === UserRole.FACILITY_MANAGER && !facilityId;
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    if (waitingForFacility) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await InspectionsApi.list(facilityId ? { facilityId } : {});
      if (request === latestRequest.current) setRows(list);
    } catch (err) {
      if (request === latestRequest.current) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách biên bản.');
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [facilityId, waitingForFacility]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => inspectionMetrics(rows, Date.now()), [rows]);
  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (row.type === 'MAINTENANCE') return false;
        if (typeFilter !== 'ALL' && row.type !== (typeFilter as InspectionKind)) return false;
        const state = inspectionState(row);
        if (stateFilter === 'ACTIVE' && state === 'done') return false;
        if (stateFilter !== 'ACTIVE' && stateFilter !== 'ALL' && state !== stateFilter)
          return false;
        return matchesSearch(row, search);
      }),
    [rows, typeFilter, stateFilter, search],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Biên bản nhận & trả kho
          </Text>
          <Text variant="secondary">
            Giao nhân viên cho từng lượt nhận/trả kho, xem ảnh hiện trạng và chốt biên bản.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Chờ nhận kho"
          value={metrics.pendingHandover}
          icon={<DoorOpen className="w-4 h-4 text-kumo-subtle" />}
        />
        <Metric
          label="Chờ trả kho"
          value={metrics.pendingReturn}
          icon={<SignOut className="w-4 h-4 text-kumo-subtle" />}
        />
        <Metric
          label="Chưa giao người"
          value={metrics.unassigned}
          icon={<UserPlus className="w-4 h-4 text-kumo-warning" />}
        />
        <Metric
          label="Hoàn tất 7 ngày"
          value={metrics.doneLast7Days}
          icon={<CheckCircle className="w-4 h-4 text-kumo-success" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-44">
            <Select
              aria-label="Lọc loại biên bản"
              value={typeFilter}
              onValueChange={(v) => v && setTypeFilter(String(v))}
              items={TYPE_OPTIONS}
              renderValue={(v) => `Loại: ${TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v}`}
            />
          </div>
          <div className="w-56">
            <Select
              aria-label="Lọc trạng thái biên bản"
              value={stateFilter}
              onValueChange={(v) => v && setStateFilter(String(v))}
              items={STATE_OPTIONS}
              renderValue={(v) =>
                `Trạng thái: ${STATE_OPTIONS.find((o) => o.value === v)?.label ?? v}`
              }
            />
          </div>
        </div>
        <div className="w-full sm:w-72">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Tìm mã kho, khách, SĐT..."
              aria-label="Tìm biên bản"
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
              <Table.Head>Loại</Table.Head>
              <Table.Head>Kho</Table.Head>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Ngày hẹn</Table.Head>
              <Table.Head>Phụ trách</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head className="text-right">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {visible.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7} className="text-center py-10 text-kumo-subtle">
                  {isLoading ? 'Đang tải…' : 'Không có biên bản nào khớp bộ lọc.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              visible.map((row) => {
                const state = inspectionState(row);
                return (
                  <Table.Row key={row.id}>
                    <Table.Cell>{INSPECTION_KIND_LABEL[row.type]}</Table.Cell>
                    <Table.Cell>
                      <div className="font-mono font-semibold">{unitCode(row)}</div>
                      <div className="text-xs text-kumo-subtle">
                        {row.contract?.bookingItem?.storageUnit?.facility?.name ?? ''}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm text-kumo-default">{customerName(row)}</div>
                      <div className="text-xs text-kumo-subtle">{customerPhone(row) ?? ''}</div>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      {formatDay(row.scheduledAt)}
                    </Table.Cell>
                    <Table.Cell>
                      {row.inspector?.fullName ?? (
                        <span className="text-xs text-kumo-warning italic flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Chưa giao
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATE_BADGE[state]} appearance="dot">
                        {INSPECTION_STATE_LABEL[state]}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Eye />}
                        aria-label={`Xem biên bản ${unitCode(row)}`}
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

      <InspectionDetailDialog
        inspection={selected}
        onClose={() => setSelectedId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <LayerCard className="px-5 py-4 ring ring-kumo-line">
    <div className="flex items-center justify-between">
      <Text variant="secondary">{label}</Text>
      {icon}
    </div>
    <span className="mt-2 block text-2xl font-semibold text-kumo-default">{value}</span>
  </LayerCard>
);
