import { Button, InputGroup, Pagination, Select, Text } from '@cloudflare/kumo';
import { ArrowsClockwise, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { FacilitiesApi, type FacilityRecord, LocationsApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { Province } from '../../types/warehouse';
import { FacilityDeactivateDialog } from './FacilityDeactivateDialog';
import { FacilityFormDialog } from './FacilityFormDialog';
import { FACILITY_STATUS_LABEL, FacilityTable } from './FacilityTable';
import { describeFacilityError } from './facility-form';

const PAGE_SIZE = 20;
const ALL = 'ALL';

const STATUS_ITEMS = [
  { value: ALL, label: 'Tất cả trạng thái' },
  ...Object.entries(FACILITY_STATUS_LABEL).map(([value, { label }]) => ({ value, label })),
];

export const FacilityManagementPage: React.FC = () => {
  const toast = useAppToast();
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityRecord | null>(null);
  const [deactivating, setDeactivating] = useState<FacilityRecord | null>(null);

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
    try {
      const res = await FacilitiesApi.listAdmin({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== ALL ? statusFilter : undefined,
      });
      setFacilities(res.facilities);
      setTotal(res.meta.total);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu', err instanceof Error ? err.message : 'Không tải được cơ sở.');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async (f: FacilityRecord) => {
    setBusyId(f.id);
    try {
      await FacilitiesApi.update(f.id, { status: 'ACTIVE' });
      toast.info('Kích hoạt cơ sở', `Đã kích hoạt lại cơ sở ${f.code}.`);
      await load();
    } catch (err) {
      toast.error('Không thể kích hoạt cơ sở', describeFacilityError(err, 'Vui lòng thử lại.'));
    } finally {
      setBusyId(null);
    }
  };

  const hasFilters = searchQuery !== '' || statusFilter !== ALL;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading" size="lg">
            Quản lý cơ sở
          </Text>
          <Text variant="secondary">
            Cơ sở là chi nhánh (ví dụ Cơ sở Hồ Chí Minh) quản lý nhiều kho. Quản lý và nhân viên
            được gán theo cơ sở.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowsClockwise className="w-4 h-4" />}
            onClick={load}
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
            Thêm cơ sở
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="w-full lg:w-72">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Tìm theo mã hoặc tên cơ sở..."
              aria-label="Tìm kiếm cơ sở"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
        </div>
        <div className="w-full lg:w-48">
          <Select
            aria-label="Lọc trạng thái cơ sở"
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(String(v));
              setPage(1);
            }}
            items={STATUS_ITEMS}
          />
        </div>
      </div>

      <FacilityTable
        facilities={facilities}
        provinces={provinces}
        hasFilters={hasFilters}
        busyId={busyId}
        onEdit={(f) => {
          setEditing(f);
          setFormOpen(true);
        }}
        onDeactivate={setDeactivating}
        onActivate={activate}
      />

      {total > 0 && (
        <div className="pt-2 border-t border-kumo-line">
          <Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={total}>
            <Pagination.Info />
            <Pagination.Controls />
          </Pagination>
        </div>
      )}

      <FacilityFormDialog
        open={formOpen}
        facility={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />
      <FacilityDeactivateDialog
        facility={deactivating}
        onClose={() => setDeactivating(null)}
        onDone={() => {
          setDeactivating(null);
          load();
        }}
      />
    </div>
  );
};
