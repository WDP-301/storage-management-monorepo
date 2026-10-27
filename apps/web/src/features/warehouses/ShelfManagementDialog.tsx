import {
  Badge,
  Button,
  Dialog,
  Empty,
  Input,
  InputArea,
  InputGroup,
  LayerCard,
  Pagination,
  Select,
  Table,
  Text,
} from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  CheckCircle,
  GridFour,
  ListBullets,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Rows,
  Stack,
  Trash,
  WarningCircle,
  Wrench,
  X,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DIALOG_SHELL, DialogBody, DialogHeader } from '../../components/dialog-layout';
import { WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import { useClientPagination } from '../../lib/use-client-pagination';
import type { Warehouse, WarehouseStatus } from '../../types/warehouse';
import { MaintenanceToggleButton } from '../roles/manager/MaintenanceToggleButton';
import { ShelfLayoutEditor } from './ShelfLayoutEditor';
import {
  type BulkShelfFormState,
  buildBulkShelfPayload,
  buildShelfCreatePayload,
  buildShelfUpdatePatch,
  defaultShelfNamePreview,
  EMPTY_BULK_SHELF_FORM,
  EMPTY_SHELF_FORM,
  nextShelfNumber,
  previewBulkShelfCodes,
  type ShelfFormState,
  toShelfFormState,
  validateBulkShelfForm,
  validateShelfForm,
  withNextBulkRange,
} from './shelf-form';
import {
  describeWarehouseError,
  formatArea,
  formatDeposit,
  formatDimensions,
  formatVnd,
  formatVolume,
  WAREHOUSE_STATUS_LABEL,
} from './warehouse-display';
import { computeDerived, DEPOSIT_DEFAULT, isIdleStatus } from './warehouse-form';

interface Props {
  warehouse: Warehouse | null;
  /** True for ADMIN and OPERATIONS_MANAGER (create/edit/delete shelves); false for FACILITY_MANAGER. */
  canManageShelves: boolean;
  initialTab?: 'shelves' | 'layout';
  onClose: () => void;
  /** Notifies parent page to refresh `shelfSummary` after any shelf mutation. */
  onChanged?: () => void;
}

type ActiveTab = 'shelves' | 'layout';

const SHELF_PAGE_SIZE = 20;
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

export const ShelfManagementDialog: React.FC<Props> = ({
  warehouse,
  canManageShelves,
  initialTab = 'shelves',
  onClose,
  onChanged,
}) => {
  const toast = useAppToast();
  const [tab, setTab] = useState<ActiveTab>(initialTab);
  const [shelves, setShelves] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [formMode, setFormMode] = useState<FormMode>('none');
  const [editingShelf, setEditingShelf] = useState<Warehouse | null>(null);
  const [shelfForm, setShelfForm] = useState<ShelfFormState>(EMPTY_SHELF_FORM);
  const [bulkForm, setBulkForm] = useState<BulkShelfFormState>(EMPTY_BULK_SHELF_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyShelfId, setBusyShelfId] = useState<string | null>(null);
  const [deletingShelf, setDeletingShelf] = useState<Warehouse | null>(null);

  const warehouseId = warehouse?.id;

  const loadShelves = useCallback(async () => {
    if (!warehouseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await WarehousesApi.listShelvesAdmin(warehouseId);
      setShelves(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách kệ.');
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    setTab(initialTab);
    setFormMode('none');
    setEditingShelf(null);
    setDeletingShelf(null);
    setSearch('');
    setStatusFilter('ALL');
    void loadShelves();
  }, [warehouseId, initialTab, loadShelves]);

  const filteredShelves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shelves.filter(
      (s) =>
        (statusFilter === 'ALL' || s.status === statusFilter) &&
        (q === '' || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
    );
  }, [shelves, search, statusFilter]);

  const shelfPages = useClientPagination(
    filteredShelves,
    SHELF_PAGE_SIZE,
    `${warehouseId}|${search}|${statusFilter}`,
  );

  if (!warehouse) return null;

  const openCreateSingle = () => {
    setDeletingShelf(null);
    setEditingShelf(null);
    const next = String(nextShelfNumber(shelves, warehouse.code, 'A')).padStart(2, '0');
    setShelfForm({ ...EMPTY_SHELF_FORM, code: `${warehouse.code}-A-${next}` });
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
      await loadShelves();
      onChanged?.();
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
      await loadShelves();
      onChanged?.();
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
      onChanged?.();
    } catch (err) {
      toast.error(
        'Không đổi được trạng thái kệ',
        describeWarehouseError(err, 'Không thể cập nhật trạng thái kệ.'),
      );
      await loadShelves();
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
      await loadShelves();
      onChanged?.();
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
    <Dialog.Root open={Boolean(warehouse)} onOpenChange={(next) => !next && onClose()}>
      <Dialog size="xl" className={`${DIALOG_SHELL} max-w-6xl sm:w-[1100px] w-full`}>
        <DialogHeader className="flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Kho kệ: {warehouse.name} ({warehouse.code})
              </Dialog.Title>
              <Badge variant="primary">Kho kệ</Badge>
            </div>
            <Text variant="secondary" size="xs">
              {warehouse.facility.name} · {warehouse.addressLine}
            </Text>
          </div>

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
            <Dialog.Close
              render={(props) => (
                <button
                  type="button"
                  {...props}
                  className="p-1.5 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-control cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            />
          </div>
        </DialogHeader>

        <DialogBody>
          {tab === 'layout' ? (
            <ShelfLayoutEditor warehouse={warehouse} shelves={shelves} />
          ) : (
            <div className="space-y-4">
              {/* KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <LayerCard className="px-4 py-3 ring ring-kumo-line">
                  <div className="flex items-center justify-between text-xs text-kumo-subtle">
                    <span>Tổng số kệ</span>
                    <Rows className="w-4 h-4" />
                  </div>
                  <div className="mt-1 text-xl font-semibold text-kumo-default">
                    {shelves.length}
                  </div>
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
                    onClick={() => void loadShelves()}
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

              {/* Create Single Shelf Form (opened from top toolbar) */}
              {formMode === 'create' && renderSingleShelfForm()}

              {/* Bulk Create Shelves Form (opened from top toolbar) */}
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
                        onChange={(e) =>
                          setBulkForm((prev) =>
                            withNextBulkRange(
                              { ...prev, prefix: e.target.value },
                              shelves,
                              warehouse.code,
                            ),
                          )
                        }
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
                        onChange={(e) =>
                          setBulkForm((prev) => ({ ...prev, widthM: e.target.value }))
                        }
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

              {error && (
                <div
                  role="alert"
                  className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-xs flex items-center gap-2"
                >
                  <WarningCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
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
                      shelfPages.pageItems.map((shelf) => {
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
                                    <MaintenanceToggleButton
                                      warehouse={shelf}
                                      busy={busyShelfId === shelf.id}
                                      onToggle={handleToggleMaintenance}
                                    />
                                    {canManageShelves && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          icon={<PencilSimple className="w-3.5 h-3.5" />}
                                          aria-label={`Sửa kệ ${shelf.code}`}
                                          onClick={() => openEditShelf(shelf)}
                                        >
                                          Sửa
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary-destructive"
                                          icon={<Trash className="w-3.5 h-3.5" />}
                                          aria-label={`Xóa kệ ${shelf.code}`}
                                          disabled={!isIdleStatus(shelf.status)}
                                          onClick={() => {
                                            setFormMode('none');
                                            setEditingShelf(null);
                                            setDeletingShelf(shelf);
                                          }}
                                        >
                                          Xóa
                                        </Button>
                                      </>
                                    )}
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

              {shelfPages.paged && (
                <div className="pt-2 border-t border-kumo-line">
                  <Pagination
                    page={shelfPages.page}
                    setPage={shelfPages.setPage}
                    perPage={SHELF_PAGE_SIZE}
                    totalCount={filteredShelves.length}
                  >
                    <Pagination.Info />
                    <Pagination.Controls />
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </DialogBody>
      </Dialog>
    </Dialog.Root>
  );
};
