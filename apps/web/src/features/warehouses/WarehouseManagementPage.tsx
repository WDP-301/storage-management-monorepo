import { Button, Input, InputGroup, LayerCard, Pagination, Select, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  MagnifyingGlass,
  Plus,
  Stack,
  Warehouse as WarehouseIcon,
  Wrench,
  X,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { LocationsApi, WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type {
  Province,
  Warehouse,
  WarehouseListQuery,
  WarehouseStatus,
} from '../../types/warehouse';
import { WarehouseDeleteDialog } from './WarehouseDeleteDialog';
import { WarehouseFormDialog } from './WarehouseFormDialog';
import { WarehouseTable } from './WarehouseTable';
import { WAREHOUSE_STATUS_LABEL } from './warehouse-display';

const PAGE_SIZE = 20;
const ALL = 'ALL';

const STATUS_ITEMS = [
  { value: ALL, label: 'Tất cả trạng thái' },
  ...(Object.keys(WAREHOUSE_STATUS_LABEL) as WarehouseStatus[]).map((s) => ({
    value: s,
    label: WAREHOUSE_STATUS_LABEL[s].label,
  })),
];

const toPositive = (raw: string): number | undefined => {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

const KpiCard: React.FC<{ label: string; value: number; icon: React.ReactNode; hint: string }> = ({
  label,
  value,
  icon,
  hint,
}) => (
  <LayerCard className="px-5 py-4 ring ring-kumo-line">
    <div className="flex items-center justify-between">
      <Text variant="secondary">{label}</Text>
      {icon}
    </div>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-2xl font-semibold text-kumo-default">{value}</span>
      <span className="text-xs text-kumo-subtle">{hint}</span>
    </div>
  </LayerCard>
);

export const WarehouseManagementPage: React.FC = () => {
  const toast = useAppToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [total, setTotal] = useState(0);
  const [snapshot, setSnapshot] = useState<Warehouse[]>([]);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [provinceFilter, setProvinceFilter] = useState(ALL);
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    LocationsApi.provinces()
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    const query: WarehouseListQuery = {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: statusFilter !== ALL ? (statusFilter as WarehouseStatus) : undefined,
      provinceCode: provinceFilter !== ALL ? provinceFilter : undefined,
      minArea: toPositive(minArea),
      maxArea: toPositive(maxArea),
      minPrice: toPositive(minPrice),
      maxPrice: toPositive(maxPrice),
    };
    try {
      const res = await WarehousesApi.listAdmin(query);
      setWarehouses(res.warehouses);
      setTotal(res.meta.total);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu', err instanceof Error ? err.message : 'Không tải được kho.');
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    statusFilter,
    provinceFilter,
    minArea,
    maxArea,
    minPrice,
    maxPrice,
    toast,
  ]);

  // Status counts ignore filters; capped at the API page ceiling.
  const loadSnapshot = useCallback(() => {
    WarehousesApi.listAdmin({ limit: 100 })
      .then((res) => {
        setSnapshot(res.warehouses);
        setSnapshotTotal(res.meta.total);
      })
      .catch(() => {
        setSnapshot([]);
        setSnapshotTotal(0);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const refreshAll = () => {
    load();
    loadSnapshot();
  };

  const count = (...statuses: WarehouseStatus[]) =>
    snapshot.filter((w) => statuses.includes(w.status)).length;

  const hasFilters =
    searchQuery !== '' ||
    statusFilter !== ALL ||
    provinceFilter !== ALL ||
    [minArea, maxArea, minPrice, maxPrice].some((v) => v !== '');

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter(ALL);
    setProvinceFilter(ALL);
    setMinArea('');
    setMaxArea('');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
  };

  const provinceItems = [
    { value: ALL, label: 'Tất cả tỉnh/thành' },
    ...provinces.map((p) => ({ value: p.code, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Quản lý kho
          </Text>
          <Text variant="secondary">
            Quản lý danh mục kho cho thuê: địa chỉ, kích thước, giá thuê và mức đặt cọc.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className="w-4 h-4" />}
            onClick={refreshAll}
            loading={isLoading}
          >
            Làm mới
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Thêm kho
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tổng số kho"
          value={snapshotTotal}
          icon={<WarehouseIcon className="w-4 h-4 text-kumo-subtle" />}
          hint="kho"
        />
        <KpiCard
          label="Đang trống"
          value={count('AVAILABLE')}
          icon={<CheckCircle className="w-4 h-4 text-kumo-success" />}
          hint="sẵn sàng cho thuê"
        />
        <KpiCard
          label="Đang thuê / giữ chỗ"
          value={count('HELD', 'BOOKED', 'RENTED', 'PENDING_INSPECTION')}
          icon={<Stack className="w-4 h-4 text-kumo-brand" />}
          hint="có khách"
        />
        <KpiCard
          label="Bảo trì / ngừng"
          value={count('MAINTENANCE', 'INACTIVE')}
          icon={<Wrench className="w-4 h-4 text-kumo-danger" />}
          hint="tạm không cho thuê"
        />
      </div>

      <LayerCard className="px-5 py-4 ring ring-kumo-line space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="w-full lg:w-72">
            <InputGroup size="base">
              <InputGroup.Addon align="start">
                <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
              </InputGroup.Addon>
              <InputGroup.Input
                type="text"
                placeholder="Tìm theo mã, tên, địa chỉ..."
                aria-label="Tìm kiếm kho"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
          </div>
          <div className="w-full lg:w-48">
            <Select
              aria-label="Lọc trạng thái kho"
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(String(v));
                setPage(1);
              }}
              items={STATUS_ITEMS}
            />
          </div>
          <div className="w-full lg:w-56">
            <Select
              aria-label="Lọc tỉnh thành"
              value={provinceFilter}
              onValueChange={(v) => {
                setProvinceFilter(String(v));
                setPage(1);
              }}
              items={provinceItems}
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="w-4 h-4" />}
              onClick={resetFilters}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              ['Diện tích từ (m²)', minArea, setMinArea],
              ['Diện tích đến (m²)', maxArea, setMaxArea],
              ['Giá từ (đ/tháng)', minPrice, setMinPrice],
              ['Giá đến (đ/tháng)', maxPrice, setMaxPrice],
            ] as const
          ).map(([label, value, setter]) => (
            <Input
              key={label}
              label={label}
              type="number"
              min="0"
              value={value}
              onChange={(e) => {
                setter(e.target.value);
                setPage(1);
              }}
            />
          ))}
        </div>
      </LayerCard>

      <WarehouseTable
        warehouses={warehouses}
        hasFilters={hasFilters}
        onEdit={(w) => {
          setEditing(w);
          setFormOpen(true);
        }}
        onDelete={setDeleting}
      />

      {total > 0 && (
        <div className="pt-2 border-t border-kumo-line">
          <Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={total}>
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        </div>
      )}

      <WarehouseFormDialog
        open={formOpen}
        warehouse={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          refreshAll();
        }}
      />
      <WarehouseDeleteDialog
        warehouse={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          refreshAll();
        }}
      />
    </div>
  );
};
