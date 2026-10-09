import { Button, LayerCard, Pagination, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  List,
  MapTrifold,
  PencilSimple,
  Plus,
  Stack,
  Warehouse as WarehouseIcon,
  Wrench,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFacility } from '../../context/FacilityContext';
import { LocationsApi, WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type {
  Province,
  Warehouse,
  WarehouseListQuery,
  WarehouseStatus,
} from '../../types/warehouse';
import { WarehouseDeleteDialog } from './WarehouseDeleteDialog';
import {
  ALL,
  EMPTY_FILTERS,
  type WarehouseFilterState,
  WarehouseFilters,
} from './WarehouseFilters';
import { WarehouseFormDialog } from './WarehouseFormDialog';
import { WarehouseOverviewMap } from './WarehouseOverviewMap';
import { WarehouseTable } from './WarehouseTable';

const PAGE_SIZE = 20;

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

  const { facilities, selectedFacility } = useFacility();
  const [filters, setFilters] = useState<WarehouseFilterState>({
    ...EMPTY_FILTERS,
    facility: selectedFacility?.id ?? ALL,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  // Once opened, the map stays mounted (hidden in list view) so toggling does not reload it.
  const [mapOpened, setMapOpened] = useState(false);
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(null);
  // A warehouse just created and opened on the map; tells why it may not appear there.
  const justCreatedId = useRef<string | null>(null);
  // The map plots every warehouse matching the filters, not just the table page.
  const [mapWarehouses, setMapWarehouses] = useState<Warehouse[]>([]);
  // The filters `mapWarehouses` was fetched for; null while it does not match any.
  const [mapDataQuery, setMapDataQuery] = useState<WarehouseListQuery | null>(null);
  // Starts true: nothing is loaded yet, so a focus requested from the table must survive.
  const [mapLoading, setMapLoading] = useState(true);

  const headerFacilityId = selectedFacility?.id ?? ALL;
  useEffect(() => {
    setFilters((prev) => ({ ...prev, facility: headerFacilityId }));
    setPage(1);
  }, [headerFacilityId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [filters.search]);

  const updateFilters = (patch: Partial<WarehouseFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setFocusedWarehouseId(null);
    if (!('search' in patch)) setPage(1);
  };
  const facilityId = filters.facility !== ALL ? filters.facility : undefined;

  useEffect(() => {
    LocationsApi.provinces()
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, []);

  const filterQuery = useMemo<WarehouseListQuery>(
    () => ({
      search: debouncedSearch || undefined,
      facilityId,
      status: filters.status !== ALL ? (filters.status as WarehouseStatus) : undefined,
      provinceCode: filters.province !== ALL ? filters.province : undefined,
      minArea: toPositive(filters.minArea),
      maxArea: toPositive(filters.maxArea),
      minPrice: toPositive(filters.minPrice),
      maxPrice: toPositive(filters.maxPrice),
    }),
    [
      debouncedSearch,
      facilityId,
      filters.status,
      filters.province,
      filters.minArea,
      filters.maxArea,
      filters.minPrice,
      filters.maxPrice,
    ],
  );

  // Filter or facility changes can overlap; only the latest request may update the page.
  const latestLoad = useRef(0);
  const latestSnapshot = useRef(0);
  const latestMapLoad = useRef(0);
  // The filters the last map request was sent for; null forces the next showing to refetch.
  const mapQueryRequested = useRef<WarehouseListQuery | null>(null);
  const load = useCallback(async () => {
    const request = ++latestLoad.current;
    setIsLoading(true);
    try {
      const res = await WarehousesApi.listAdmin({ ...filterQuery, page, limit: PAGE_SIZE });
      if (request !== latestLoad.current) return;
      setWarehouses(res.warehouses);
      setTotal(res.meta.total);
    } catch (err) {
      if (request !== latestLoad.current) return;
      toast.error('Lỗi tải dữ liệu', err instanceof Error ? err.message : 'Không tải được kho.');
    } finally {
      if (request === latestLoad.current) setIsLoading(false);
    }
  }, [page, filterQuery, toast]);

  const loadMap = useCallback(async () => {
    const request = ++latestMapLoad.current;
    mapQueryRequested.current = filterQuery;
    setMapLoading(true);
    try {
      const all = await WarehousesApi.listAdminAll(filterQuery);
      if (request !== latestMapLoad.current) return;
      setMapWarehouses(all);
      setMapDataQuery(filterQuery);
    } catch (err) {
      if (request !== latestMapLoad.current) return;
      setMapWarehouses([]);
      setMapDataQuery(filterQuery);
      toast.error(
        'Lỗi tải bản đồ',
        err instanceof Error ? err.message : 'Không tải được vị trí kho.',
      );
    } finally {
      if (request === latestMapLoad.current) setMapLoading(false);
    }
  }, [filterQuery, toast]);

  // Status counts ignore filters; capped at the API page ceiling.
  const loadSnapshot = useCallback(() => {
    const request = ++latestSnapshot.current;
    WarehousesApi.listAdmin({ facilityId, limit: 100 })
      .then((res) => {
        if (request !== latestSnapshot.current) return;
        setSnapshot(res.warehouses);
        setSnapshotTotal(res.meta.total);
      })
      .catch(() => {
        if (request !== latestSnapshot.current) return;
        setSnapshot([]);
        setSnapshotTotal(0);
      });
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // A hidden map is not refetched on every filter change; it catches up when shown again.
  useEffect(() => {
    if (view === 'map' && mapQueryRequested.current !== filterQuery) loadMap();
  }, [view, filterQuery, loadMap]);

  const refreshAll = () => {
    load();
    loadSnapshot();
    if (view === 'map') loadMap();
    else {
      mapQueryRequested.current = null;
      setMapDataQuery(null);
    }
  };

  const count = (...statuses: WarehouseStatus[]) =>
    snapshot.filter((w) => statuses.includes(w.status)).length;

  const hasFilters =
    filters.search !== '' ||
    filters.status !== ALL ||
    filters.province !== ALL ||
    filters.facility !== ALL ||
    [filters.minArea, filters.maxArea, filters.minPrice, filters.maxPrice].some((v) => v !== '');

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setFocusedWarehouseId(null);
    setPage(1);
  };

  // Map data still loading, or fetched for other filters, must not drive selection or camera.
  const mapPending = mapLoading || mapDataQuery !== filterQuery;

  // The map plots every filtered warehouse, so a focus is dropped only when it leaves that set.
  useEffect(() => {
    if (mapPending || !focusedWarehouseId) return;
    const justCreated = focusedWarehouseId === justCreatedId.current;
    if (justCreated) justCreatedId.current = null;
    if (mapWarehouses.some((warehouse) => warehouse.id === focusedWarehouseId)) return;
    setFocusedWarehouseId(null);
    if (justCreated) {
      toast.info(
        'Kho mới không hiện trên bản đồ',
        'Kho vừa thêm không khớp bộ lọc hiện tại. Hãy xóa bộ lọc để xem vị trí kho.',
      );
    }
  }, [mapPending, mapWarehouses, focusedWarehouseId, toast]);

  const openMap = (focusId: string | null) => {
    setFocusedWarehouseId(focusId);
    setMapOpened(true);
    setView('map');
  };

  const editWarehouse = (warehouse: Warehouse) => {
    setEditing(warehouse);
    setFormOpen(true);
  };

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

      <WarehouseFilters
        filters={filters}
        facilities={facilities}
        provinces={provinces}
        hasFilters={hasFilters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      <div className="flex items-center gap-2">
        <Button
          variant={view === 'list' ? 'primary' : 'secondary'}
          icon={<List className="h-4 w-4" />}
          onClick={() => {
            // Clearing the focus lets the same warehouse be focused again from the table.
            setFocusedWarehouseId(null);
            setView('list');
          }}
        >
          Danh sách
        </Button>
        <Button
          variant={view === 'map' ? 'primary' : 'secondary'}
          icon={<MapTrifold className="h-4 w-4" />}
          onClick={() => openMap(null)}
        >
          Bản đồ
        </Button>
      </div>

      {view === 'list' && (
        <WarehouseTable
          warehouses={warehouses}
          hasFilters={hasFilters}
          onEdit={editWarehouse}
          onViewMap={(warehouse) => openMap(warehouse.id)}
          onDelete={setDeleting}
        />
      )}
      {mapOpened && (
        <div hidden={view !== 'map'}>
          <WarehouseOverviewMap
            warehouses={mapWarehouses}
            isLoading={mapPending}
            visible={view === 'map'}
            focusedWarehouseId={focusedWarehouseId}
            renderActions={(warehouse) => (
              <Button
                size="sm"
                variant="secondary"
                icon={<PencilSimple className="h-3.5 w-3.5" />}
                onClick={() => editWarehouse(warehouse)}
              >
                Sửa kho
              </Button>
            )}
          />
        </div>
      )}

      {view === 'list' && total > 0 && (
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
        facilities={facilities}
        defaultFacilityId={facilityId}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, created) => {
          setFormOpen(false);
          refreshAll();
          // A new warehouse opens on the overview map so its pin can be checked among the rest.
          if (created) {
            justCreatedId.current = saved.id;
            openMap(saved.id);
          }
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
