import {
  Badge,
  Button,
  DropdownMenu,
  Empty,
  Input,
  InputArea,
  InputGroup,
  LayerCard,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import {
  ArrowLeft,
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  DotsThree,
  GridFour,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  Plus,
  Rows,
  Stack,
  Trash,
  Wrench,
} from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FacilitiesApi, type FacilityRecord, WarehousesApi } from '../../lib/api';
import { hasAllowedRole } from '../../lib/roles';
import { useAppToast } from '../../lib/toast';
import type { Warehouse, WarehouseStatus } from '../../types/warehouse';
import { ShelfLayoutEditor } from './ShelfLayoutEditor';
import {
  type BulkShelfFormState,
  buildBulkShelfPayload,
  buildShelfCreatePayload,
  buildShelfUpdatePatch,
  defaultShelfNamePreview,
  EMPTY_BULK_SHELF_FORM,
  EMPTY_SHELF_FORM,
  previewBulkShelfCodes,
  type ShelfFormState,
  toShelfFormState,
  validateBulkShelfForm,
  validateShelfForm,
  withNextBulkRange,
} from './shelf-form';
import { WarehouseFormDialog } from './WarehouseFormDialog';
import { WarehouseOverviewMap } from './WarehouseOverviewMap';
import {
  describeWarehouseError,
  formatArea,
  formatDeposit,
  formatDimensions,
  formatVnd,
  formatVolume,
  formatWarehouseDeposit,
  formatWarehousePrice,
  isShelfWarehouse,
  WAREHOUSE_STATUS_LABEL,
} from './warehouse-display';
import { computeDerived, DEPOSIT_DEFAULT, isIdleStatus } from './warehouse-form';

type ActiveTab = 'shelves' | 'layout';
type FormMode = 'none' | 'create' | 'edit' | 'bulk';

const DEPOSIT_ITEMS = [
  { value: DEPOSIT_DEFAULT, label: 'Mặc định (theo cấu hình hệ thống)' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} tháng` })),
];

const STATUS_ITEMS = (['AVAILABLE', 'MAINTENANCE', 'INACTIVE'] as const).map((s) => ({
  value: s,
  label: WAREHOUSE_STATUS_LABEL[s].label,
}));

const FILTER_STATUS_ITEMS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  ...(Object.keys(WAREHOUSE_STATUS_LABEL) as WarehouseStatus[]).map((s) => ({
    value: s,
    label: WAREHOUSE_STATUS_LABEL[s].label,
  })),
];

export const WarehouseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useAppToast();

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [shelves, setShelves] = useState<Warehouse[]>([]);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<ActiveTab>('shelves');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [formMode, setFormMode] = useState<FormMode>('none');
  const [editingShelf, setEditingShelf] = useState<Warehouse | null>(null);
  const [shelfForm, setShelfForm] = useState<ShelfFormState>(EMPTY_SHELF_FORM);
  const [bulkForm, setBulkForm] = useState<BulkShelfFormState>(EMPTY_BULK_SHELF_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyShelfId, setBusyShelfId] = useState<string | null>(null);
  const [deletingShelf, setDeletingShelf] = useState<Warehouse | null>(null);

  const [editWarehouseOpen, setEditWarehouseOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const canManageShelves = hasAllowedRole(user?.roles, [
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
  ]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [wh, facs] = await Promise.all([
        WarehousesApi.get(id),
        FacilitiesApi.listAll().catch(() => []),
      ]);
      setWarehouse(wh);
      setFacilities(facs);

      if (wh.kind === 'SHELF_WAREHOUSE') {
        const shelfList = await WarehousesApi.listShelvesAdmin(id);
        setShelves(shelfList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được thông tin kho.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadShelvesOnly = useCallback(async () => {
    if (!id || warehouse?.kind !== 'SHELF_WAREHOUSE') return;
    try {
      const shelfList = await WarehousesApi.listShelvesAdmin(id);
      setShelves(shelfList);
    } catch (err) {
      toast.error(
        'Không tải được danh sách kệ',
        err instanceof Error ? err.message : 'Lỗi kết nối.',
      );
    }
  }, [id, warehouse?.kind, toast]);

  const filteredShelves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shelves.filter(
      (s) =>
        (statusFilter === 'ALL' || s.status === statusFilter) &&
        (q === '' || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
    );
  }, [shelves, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <CircleNotch className="w-8 h-8 animate-spin text-kumo-brand" />
        <Text variant="secondary" size="sm">
          Đang tải thông tin kho...
        </Text>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="py-16 text-center space-y-4">
        <Empty
          title="Không tìm thấy kho"
          description={error ?? 'Kho không tồn tại hoặc bạn không có quyền xem kho này.'}
        />
        <Button variant="secondary" icon={<ArrowLeft />} onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>
    );
  }

  const openCreateSingle = () => {
    setDeletingShelf(null);
    setEditingShelf(null);
    setShelfForm({
      ...EMPTY_SHELF_FORM,
      code: `${warehouse.code}-A-${String(shelves.length + 1).padStart(2, '0')}`,
    });
    setFormMode('create');
  };

  const openEditShelf = (shelf: Warehouse) => {
    setDeletingShelf(null);
    setEditingShelf(shelf);
    setShelfForm(toShelfFormState(shelf));
    setFormMode('edit');
  };

  const openBulkCreate = () => {
    setDeletingShelf(null);
    setEditingShelf(null);
    setBulkForm(withNextBulkRange(EMPTY_BULK_SHELF_FORM, shelves, warehouse.code));
    setFormMode('bulk');
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const frozen =
      formMode === 'edit' && editingShelf !== null && !isIdleStatus(editingShelf.status);
    const problem = validateShelfForm(shelfForm, frozen);
    if (problem) {
      toast.warning('Thông tin kệ chưa hợp lệ', problem);
      return;
    }
    setIsSubmitting(true);
    try {
      if (formMode === 'edit' && editingShelf) {
        await WarehousesApi.update(editingShelf.id, buildShelfUpdatePatch(shelfForm, editingShelf));
        toast.notifyUpdated('kệ', editingShelf.code);
      } else {
        await WarehousesApi.createShelf(warehouse.id, buildShelfCreatePayload(shelfForm));
        toast.notifyCreated('kệ', shelfForm.code.trim());
      }
      setFormMode('none');
      setEditingShelf(null);
      await loadShelvesOnly();
    } catch (err) {
      toast.error(
        formMode === 'edit' ? 'Không cập nhật được kệ' : 'Không tạo được kệ',
        describeWarehouseError(err, 'Không thể lưu thông tin kệ.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateBulkShelfForm(warehouse.code, bulkForm);
    if (problem) {
      toast.warning('Thông tin tạo dãy kệ chưa hợp lệ', problem);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await WarehousesApi.bulkCreateShelves(
        warehouse.id,
        buildBulkShelfPayload(bulkForm),
      );
      toast.success(
        'Đã tạo dãy kệ',
        `Đã tạo thành công ${res.created} kệ (${res.codes[0] ?? ''} → ${res.codes[res.codes.length - 1] ?? ''}).`,
      );
      setFormMode('none');
      await loadShelvesOnly();
    } catch (err) {
      toast.error(
        'Không tạo được dãy kệ',
        describeWarehouseError(err, 'Không thể tạo hàng loạt kệ. Kiểm tra lại mã kệ trùng lặp.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMaintenance = async (shelf: Warehouse) => {
    const next = shelf.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setBusyShelfId(shelf.id);
    try {
      const updated = await WarehousesApi.updateStatus(shelf.id, next);
      setShelves((prev) => prev.map((s) => (s.id === shelf.id ? updated : s)));
      toast.info(
        'Cập nhật trạng thái kệ',
        `Đã chuyển kệ ${shelf.code} sang trạng thái: ${WAREHOUSE_STATUS_LABEL[next].label}.`,
      );
    } catch (err) {
      toast.error(
        'Không đổi được trạng thái kệ',
        describeWarehouseError(err, 'Không thể cập nhật trạng thái kệ.'),
      );
      await loadShelvesOnly();
    } finally {
      setBusyShelfId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingShelf) return;
    setBusyShelfId(deletingShelf.id);
    try {
      await WarehousesApi.remove(deletingShelf.id);
      toast.notifyDeleted('kệ', deletingShelf.code);
      setDeletingShelf(null);
      await loadShelvesOnly();
    } catch (err) {
      toast.error('Không xóa được kệ', describeWarehouseError(err, 'Không thể xóa kệ này.'));
    } finally {
      setBusyShelfId(null);
    }
  };

  const countStatus = (...statuses: WarehouseStatus[]) =>
    shelves.filter((s) => statuses.includes(s.status)).length;

  const singleDerived = computeDerived(shelfForm);
  const bulkDerived = computeDerived(bulkForm);
  const bulkPreview = previewBulkShelfCodes(warehouse.code, bulkForm);
  const frozenEdit =
    formMode === 'edit' && editingShelf !== null && !isIdleStatus(editingShelf.status);

  const renderSingleShelfForm = () => (
    <LayerCard className="p-4 ring ring-kumo-line space-y-4">
      <div className="flex items-center justify-between border-b border-kumo-line pb-2.5">
        <Text as="strong" bold>
          {formMode === 'edit' && editingShelf
            ? `Chỉnh sửa kệ ${editingShelf.code}`
            : 'Thêm kệ mới'}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            setFormMode('none');
            setEditingShelf(null);
          }}
        >
          Đóng biểu mẫu
        </Button>
      </div>

      {frozenEdit && editingShelf && (
        <div className="p-3 bg-kumo-warning-tint text-kumo-warning rounded-lg text-xs">
          Kệ đang {WAREHOUSE_STATUS_LABEL[editingShelf.status].label.toLowerCase()} nên không thể
          đổi mã kệ, kích thước hay trạng thái. Giá thuê, đặt cọc, tên kệ và ghi chú vẫn chỉnh sửa
          được.
        </div>
      )}

      <form onSubmit={handleSaveSingle} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Mã kệ"
            value={shelfForm.code}
            disabled={frozenEdit}
            onChange={(e) => setShelfForm((prev) => ({ ...prev, code: e.target.value }))}
          />
          <Input
            label="Tên kệ (để trống sẽ tự đặt theo mã)"
            placeholder={defaultShelfNamePreview(warehouse, shelfForm.code)}
            value={shelfForm.name}
            onChange={(e) => setShelfForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Chiều rộng kệ (m)"
            type="number"
            step="any"
            min="0"
            disabled={frozenEdit}
            value={shelfForm.widthM}
            onChange={(e) => setShelfForm((prev) => ({ ...prev, widthM: e.target.value }))}
          />
          <Input
            label="Chiều dài kệ (m)"
            type="number"
            step="any"
            min="0"
            disabled={frozenEdit}
            value={shelfForm.lengthM}
            onChange={(e) => setShelfForm((prev) => ({ ...prev, lengthM: e.target.value }))}
          />
          <Input
            label="Chiều cao kệ (m, tùy chọn)"
            type="number"
            step="any"
            min="0"
            disabled={frozenEdit}
            value={shelfForm.heightM}
            onChange={(e) => setShelfForm((prev) => ({ ...prev, heightM: e.target.value }))}
          />
        </div>

        <div className="flex gap-6 text-xs p-2.5 rounded-lg bg-kumo-control ring ring-kumo-line">
          <span>
            <span className="text-kumo-subtle">Diện tích kệ: </span>
            <strong>{singleDerived.area === null ? '—' : formatArea(singleDerived.area)}</strong>
          </span>
          <span>
            <span className="text-kumo-subtle">Thể tích kệ: </span>
            <strong>
              {singleDerived.volume === null ? '—' : formatVolume(singleDerived.volume)}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Giá thuê kệ / tháng (VND)"
            type="number"
            min="0"
            value={shelfForm.monthlyPrice}
            onChange={(e) => setShelfForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))}
          />
          <Select
            label="Số tháng đặt cọc"
            value={shelfForm.depositMonths}
            onValueChange={(v) => setShelfForm((prev) => ({ ...prev, depositMonths: String(v) }))}
            items={DEPOSIT_ITEMS}
          />
          {!frozenEdit && (
            <Select
              label="Trạng thái kệ"
              value={shelfForm.status}
              onValueChange={(v) =>
                setShelfForm((prev) => ({
                  ...prev,
                  status: v as ShelfFormState['status'],
                }))
              }
              items={STATUS_ITEMS}
            />
          )}
        </div>

        <InputArea
          label="Ghi chú kệ"
          minRows={2}
          value={shelfForm.notes}
          onChange={(e) => setShelfForm((prev) => ({ ...prev, notes: e.target.value }))}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              setFormMode('none');
              setEditingShelf(null);
            }}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {formMode === 'edit' ? 'Lưu kệ' : 'Tạo kệ'}
          </Button>
        </div>
      </form>
    </LayerCard>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate(-1)}
        >
          Quay lại danh sách kho
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
            onClick={() => void loadData()}
          >
            Làm mới
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<MapPin className="w-3.5 h-3.5" />}
            onClick={() => setMapOpen(true)}
          >
            Xem bản đồ
          </Button>
          {canManageShelves && (
            <Button
              size="sm"
              variant="secondary"
              icon={<PencilSimple className="w-3.5 h-3.5" />}
              onClick={() => setEditWarehouseOpen(true)}
            >
              Sửa thông tin kho
            </Button>
          )}
        </div>
      </div>

      {/* Main Warehouse Header Card */}
      <LayerCard className="p-5 ring ring-kumo-line space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Text as="h1" variant="heading" size="lg">
                {warehouse.name} ({warehouse.code})
              </Text>
              <Badge variant={isShelfWarehouse(warehouse) ? 'primary' : 'secondary'}>
                {isShelfWarehouse(warehouse) ? 'Kho kệ' : 'Kho tự quản'}
              </Badge>
              <Badge variant={WAREHOUSE_STATUS_LABEL[warehouse.status].variant}>
                {WAREHOUSE_STATUS_LABEL[warehouse.status].label}
              </Badge>
            </div>
            <Text variant="secondary" size="sm">
              {warehouse.facility.name} ({warehouse.facility.code}) · {warehouse.addressLine}
            </Text>
          </div>

          {isShelfWarehouse(warehouse) && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={tab === 'shelves' ? 'primary' : 'secondary'}
                icon={<ListBullets className="w-4 h-4" />}
                onClick={() => setTab('shelves')}
              >
                Danh sách kệ ({shelves.length})
              </Button>
              <Button
                size="sm"
                variant={tab === 'layout' ? 'primary' : 'secondary'}
                icon={<GridFour className="w-4 h-4" />}
                onClick={() => setTab('layout')}
              >
                Sơ đồ mặt bằng
              </Button>
            </div>
          )}
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-kumo-line text-xs">
          <div>
            <span className="text-kumo-subtle">Kích thước (D×R×C): </span>
            <strong className="text-kumo-default font-medium">{formatDimensions(warehouse)}</strong>
          </div>
          <div>
            <span className="text-kumo-subtle">Diện tích sàn: </span>
            <strong className="text-kumo-default font-medium">
              {formatArea(warehouse.areaM2)}
            </strong>
          </div>
          <div>
            <span className="text-kumo-subtle">Thể tích kho: </span>
            <strong className="text-kumo-default font-medium">
              {formatVolume(warehouse.volumeM3)}
            </strong>
          </div>
          <div>
            <span className="text-kumo-subtle">
              {isShelfWarehouse(warehouse) ? 'Giá thuê kệ: ' : 'Giá thuê kho: '}
            </span>
            <strong className="text-kumo-default font-medium">
              {formatWarehousePrice(warehouse)}
            </strong>
          </div>
        </div>
      </LayerCard>

      {/* Shelf Warehouse Tabs Content */}
      {isShelfWarehouse(warehouse) ? (
        <>
          <div hidden={tab !== 'shelves'} className="space-y-4">
            {/* KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <LayerCard className="px-4 py-3 ring ring-kumo-line">
                <div className="flex items-center justify-between text-xs text-kumo-subtle">
                  <span>Tổng số kệ</span>
                  <Rows className="w-4 h-4" />
                </div>
                <div className="mt-1 text-xl font-semibold text-kumo-default">{shelves.length}</div>
              </LayerCard>
              <LayerCard className="px-4 py-3 ring ring-kumo-line">
                <div className="flex items-center justify-between text-xs text-kumo-subtle">
                  <span>Kệ đang trống</span>
                  <CheckCircle className="w-4 h-4 text-kumo-success" />
                </div>
                <div className="mt-1 text-xl font-semibold text-kumo-default">
                  {countStatus('AVAILABLE')}
                </div>
              </LayerCard>
              <LayerCard className="px-4 py-3 ring ring-kumo-line">
                <div className="flex items-center justify-between text-xs text-kumo-subtle">
                  <span>Đang thuê / giữ chỗ</span>
                  <Stack className="w-4 h-4 text-kumo-brand" />
                </div>
                <div className="mt-1 text-xl font-semibold text-kumo-default">
                  {countStatus('HELD', 'BOOKED', 'RENTED', 'PENDING_INSPECTION')}
                </div>
              </LayerCard>
              <LayerCard className="px-4 py-3 ring ring-kumo-line">
                <div className="flex items-center justify-between text-xs text-kumo-subtle">
                  <span>Bảo trì / Ngừng</span>
                  <Wrench className="w-4 h-4 text-kumo-danger" />
                </div>
                <div className="mt-1 text-xl font-semibold text-kumo-default">
                  {countStatus('MAINTENANCE', 'INACTIVE')}
                </div>
              </LayerCard>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-60">
                  <InputGroup size="sm">
                    <InputGroup.Addon align="start">
                      <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
                    </InputGroup.Addon>
                    <InputGroup.Input
                      type="text"
                      aria-label="Tìm mã kệ hoặc tên kệ"
                      placeholder="Tìm mã hoặc tên kệ..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="w-48">
                  <Select
                    aria-label="Lọc trạng thái kệ"
                    size="sm"
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(String(v))}
                    items={FILTER_STATUS_ITEMS}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
                  loading={isLoading}
                  onClick={() => void loadShelvesOnly()}
                >
                  Làm mới
                </Button>
                {canManageShelves && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Rows className="w-3.5 h-3.5" />}
                      onClick={openBulkCreate}
                    >
                      Tạo dãy kệ hàng loạt
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={openCreateSingle}
                    >
                      Thêm kệ lẻ
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Create Single Shelf Form */}
            {formMode === 'create' && renderSingleShelfForm()}

            {/* Bulk Create Shelves Form */}
            {formMode === 'bulk' && (
              <LayerCard className="p-4 ring ring-kumo-line space-y-4">
                <div className="flex items-center justify-between border-b border-kumo-line pb-2.5">
                  <Text as="strong" bold>
                    Tạo dãy kệ hàng loạt (tối đa 200 kệ/lần)
                  </Text>
                  <Button size="xs" variant="ghost" onClick={() => setFormMode('none')}>
                    Đóng biểu mẫu
                  </Button>
                </div>

                <form onSubmit={handleSaveBulk} className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Input
                      label="Tiền tố dãy (VD: A, B1)"
                      value={bulkForm.prefix}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, prefix: e.target.value }))}
                    />
                    <Input
                      label="Từ số thứ tự"
                      type="number"
                      min="0"
                      value={bulkForm.from}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, from: e.target.value }))}
                    />
                    <Input
                      label="Đến số thứ tự"
                      type="number"
                      min="0"
                      value={bulkForm.to}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, to: e.target.value }))}
                    />
                    <Input
                      label="Độ dài số (pad)"
                      type="number"
                      min="0"
                      max="6"
                      value={bulkForm.pad}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, pad: e.target.value }))}
                    />
                  </div>

                  {bulkPreview && (
                    <div className="p-2.5 rounded-lg bg-kumo-tint text-xs text-kumo-default ring ring-kumo-line">
                      Sẽ tạo <strong>{bulkPreview.count} kệ</strong> với mã từ{' '}
                      <code className="font-mono font-semibold">{bulkPreview.firstCode}</code> đến{' '}
                      <code className="font-mono font-semibold">{bulkPreview.lastCode}</code>.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Chiều rộng mỗi kệ (m)"
                      type="number"
                      step="any"
                      min="0"
                      value={bulkForm.widthM}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, widthM: e.target.value }))}
                    />
                    <Input
                      label="Chiều dài mỗi kệ (m)"
                      type="number"
                      step="any"
                      min="0"
                      value={bulkForm.lengthM}
                      onChange={(e) =>
                        setBulkForm((prev) => ({ ...prev, lengthM: e.target.value }))
                      }
                    />
                    <Input
                      label="Chiều cao mỗi kệ (m, tùy chọn)"
                      type="number"
                      step="any"
                      min="0"
                      value={bulkForm.heightM}
                      onChange={(e) =>
                        setBulkForm((prev) => ({ ...prev, heightM: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex gap-6 text-xs p-2.5 rounded-lg bg-kumo-control ring ring-kumo-line">
                    <span>
                      <span className="text-kumo-subtle">Diện tích mỗi kệ: </span>
                      <strong>
                        {bulkDerived.area === null ? '—' : formatArea(bulkDerived.area)}
                      </strong>
                    </span>
                    <span>
                      <span className="text-kumo-subtle">Thể tích mỗi kệ: </span>
                      <strong>
                        {bulkDerived.volume === null ? '—' : formatVolume(bulkDerived.volume)}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Giá thuê mỗi kệ / tháng (VND)"
                      type="number"
                      min="0"
                      value={bulkForm.monthlyPrice}
                      onChange={(e) =>
                        setBulkForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))
                      }
                    />
                    <Select
                      label="Số tháng đặt cọc"
                      value={bulkForm.depositMonths}
                      onValueChange={(v) =>
                        setBulkForm((prev) => ({ ...prev, depositMonths: String(v) }))
                      }
                      items={DEPOSIT_ITEMS}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => setFormMode('none')}
                      disabled={isSubmitting}
                    >
                      Hủy
                    </Button>
                    <Button type="submit" variant="primary" loading={isSubmitting}>
                      Tạo hàng loạt
                    </Button>
                  </div>
                </form>
              </LayerCard>
            )}

            {/* Shelves Table */}
            <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head className="whitespace-nowrap">Mã kệ</Table.Head>
                    <Table.Head className="min-w-[180px]">Tên kệ</Table.Head>
                    <Table.Head className="whitespace-nowrap">Kích thước (D×R×C)</Table.Head>
                    <Table.Head className="whitespace-nowrap">Diện tích</Table.Head>
                    <Table.Head className="whitespace-nowrap">Giá / tháng</Table.Head>
                    <Table.Head className="whitespace-nowrap">Đặt cọc</Table.Head>
                    <Table.Head className="whitespace-nowrap">Trạng thái</Table.Head>
                    <Table.Head className="whitespace-nowrap text-right">Thao tác</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredShelves.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={8} className="p-0">
                        <Empty
                          size="sm"
                          title={
                            shelves.length === 0 ? 'Kho kệ chưa có kệ nào' : 'Không tìm thấy kệ'
                          }
                          description={
                            shelves.length === 0
                              ? canManageShelves
                                ? 'Hãy nhấn "Thêm kệ lẻ" hoặc "Tạo dãy kệ hàng loạt" để khởi tạo các kệ cho thuê.'
                                : 'Kho kệ này chưa được khởi tạo kệ.'
                              : 'Không có kệ nào khớp bộ lọc hiện tại.'
                          }
                        />
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    filteredShelves.map((shelf) => {
                      const isConfirmingDelete = deletingShelf?.id === shelf.id;
                      const isEditingRow = formMode === 'edit' && editingShelf?.id === shelf.id;
                      return (
                        <React.Fragment key={shelf.id}>
                          <Table.Row
                            className={
                              isConfirmingDelete
                                ? 'bg-kumo-warning-tint/40'
                                : isEditingRow
                                  ? 'bg-kumo-tint/50'
                                  : undefined
                            }
                          >
                            <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                              {shelf.code}
                            </Table.Cell>
                            <Table.Cell className="min-w-[180px] text-kumo-default">
                              {shelf.name}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-kumo-default">
                              {formatDimensions(shelf)}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">
                              {formatArea(shelf.areaM2)}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                              {formatVnd(shelf.monthlyPrice)}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                              {formatDeposit(shelf)}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">
                              <Badge variant={WAREHOUSE_STATUS_LABEL[shelf.status].variant}>
                                {WAREHOUSE_STATUS_LABEL[shelf.status].label}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-right">
                              {isConfirmingDelete ? (
                                <div
                                  role="alert"
                                  className="inline-flex items-center gap-1.5 bg-kumo-warning-tint px-2.5 py-1 rounded-md"
                                >
                                  <span className="text-xs font-medium text-kumo-default mr-1">
                                    Xóa kệ {shelf.code}?
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={busyShelfId === shelf.id}
                                    onClick={() => setDeletingShelf(null)}
                                  >
                                    Hủy
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    loading={busyShelfId === shelf.id}
                                    onClick={handleConfirmDelete}
                                  >
                                    Xác nhận xóa kệ
                                  </Button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <DropdownMenu>
                                    <DropdownMenu.Trigger
                                      render={
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          shape="square"
                                          icon={<DotsThree weight="bold" className="w-4 h-4" />}
                                          aria-label={`Thao tác kệ ${shelf.code}`}
                                          title={`Thao tác kệ ${shelf.code}`}
                                        />
                                      }
                                    />
                                    <DropdownMenu.Content align="end" sideOffset={4}>
                                      {canManageShelves && (
                                        <DropdownMenu.Item
                                          icon={PencilSimple}
                                          onClick={() => openEditShelf(shelf)}
                                        >
                                          Chỉnh sửa
                                        </DropdownMenu.Item>
                                      )}
                                      {(shelf.status === 'AVAILABLE' ||
                                        shelf.status === 'MAINTENANCE') && (
                                        <DropdownMenu.Item
                                          icon={
                                            shelf.status === 'MAINTENANCE'
                                              ? ArrowsClockwise
                                              : Wrench
                                          }
                                          disabled={busyShelfId === shelf.id}
                                          onClick={() => handleToggleMaintenance(shelf)}
                                        >
                                          {shelf.status === 'MAINTENANCE'
                                            ? 'Mở lại hoạt động'
                                            : 'Báo bảo trì kệ'}
                                        </DropdownMenu.Item>
                                      )}
                                      {canManageShelves && (
                                        <>
                                          <DropdownMenu.Separator />
                                          <DropdownMenu.Item
                                            variant="danger"
                                            icon={Trash}
                                            disabled={!isIdleStatus(shelf.status)}
                                            onClick={() => {
                                              setFormMode('none');
                                              setEditingShelf(null);
                                              setDeletingShelf(shelf);
                                            }}
                                          >
                                            Xóa kệ
                                          </DropdownMenu.Item>
                                        </>
                                      )}
                                    </DropdownMenu.Content>
                                  </DropdownMenu>

                                  {/* Accessible action buttons for screen readers and tests */}
                                  <div className="sr-only">
                                    {canManageShelves && (
                                      <button
                                        type="button"
                                        aria-label={`Sửa kệ ${shelf.code}`}
                                        onClick={() => openEditShelf(shelf)}
                                      >
                                        Sửa
                                      </button>
                                    )}
                                    {(shelf.status === 'AVAILABLE' ||
                                      shelf.status === 'MAINTENANCE') && (
                                      <button
                                        type="button"
                                        aria-label={`${shelf.status === 'MAINTENANCE' ? 'Mở lại' : 'Báo bảo trì'} kệ ${shelf.code}`}
                                        onClick={() => handleToggleMaintenance(shelf)}
                                      >
                                        {shelf.status === 'MAINTENANCE' ? 'Mở lại' : 'Báo bảo trì'}
                                      </button>
                                    )}
                                    {canManageShelves && (
                                      <button
                                        type="button"
                                        aria-label={`Xóa kệ ${shelf.code}`}
                                        disabled={!isIdleStatus(shelf.status)}
                                        onClick={() => {
                                          setFormMode('none');
                                          setEditingShelf(null);
                                          setDeletingShelf(shelf);
                                        }}
                                      >
                                        Xóa
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Table.Cell>
                          </Table.Row>
                          {isEditingRow && (
                            <Table.Row>
                              <Table.Cell colSpan={8} className="p-3 bg-kumo-tint/30">
                                {renderSingleShelfForm()}
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </Table.Body>
              </Table>
            </LayerCard>
          </div>

          <div hidden={tab !== 'layout'}>
            <ShelfLayoutEditor warehouse={warehouse} shelves={shelves} />
          </div>
        </>
      ) : (
        /* Self Storage Warehouse Details */
        <LayerCard className="p-5 ring ring-kumo-line space-y-4">
          <Text as="h2" variant="heading">
            Thông tin kho tự quản
          </Text>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-kumo-subtle">Giá thuê tháng: </span>
              <strong>{formatWarehousePrice(warehouse)}</strong>
            </div>
            <div>
              <span className="text-kumo-subtle">Số tháng đặt cọc: </span>
              <strong>{formatWarehouseDeposit(warehouse)}</strong>
            </div>
            {warehouse.notes && (
              <div className="sm:col-span-2">
                <span className="text-kumo-subtle">Ghi chú: </span>
                <p className="mt-1 text-kumo-default whitespace-pre-wrap">{warehouse.notes}</p>
              </div>
            )}
          </div>
        </LayerCard>
      )}

      {/* Edit Warehouse Dialog */}
      <WarehouseFormDialog
        open={editWarehouseOpen}
        warehouse={warehouse}
        facilities={facilities}
        defaultFacilityId={warehouse.facility.id}
        onClose={() => setEditWarehouseOpen(false)}
        onSaved={(updated) => {
          setWarehouse(updated);
          setEditWarehouseOpen(false);
          toast.success('Đã cập nhật kho', `Đã lưu thông tin kho ${updated.code}.`);
        }}
      />

      {/* Map Dialog */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-kumo-base rounded-xl max-w-3xl w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <Text as="h3" variant="heading">
                Vị trí kho {warehouse.name} ({warehouse.code})
              </Text>
              <Button size="xs" variant="ghost" onClick={() => setMapOpen(false)}>
                Đóng
              </Button>
            </div>
            <div className="h-96 rounded-lg overflow-hidden border border-kumo-line">
              <WarehouseOverviewMap
                warehouses={[warehouse]}
                visible={mapOpen}
                focusedWarehouseId={warehouse.id}
                renderActions={() => null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
