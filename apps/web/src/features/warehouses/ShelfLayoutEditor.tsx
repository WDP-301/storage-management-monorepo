import { Badge, Button, Input, LayerCard, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  Eraser,
  FloppyDisk,
  MagicWand,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { LayoutElementType } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type ApiError, WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type {
  LayoutElement,
  LayoutRect,
  ShelfPlacement,
  Warehouse,
  WarehouseStatus,
} from '../../types/warehouse';
import { formatArea, formatVnd, WAREHOUSE_STATUS_LABEL } from './warehouse-display';

interface Props {
  warehouse: Warehouse;
  /** Latest shelves list from parent dialog so codes/statuses stay fresh. */
  shelves: Warehouse[];
}

type ToolMode = 'SELECT' | 'PLACE_SHELF' | 'DOOR' | 'AISLE' | 'OBSTACLE' | 'LABEL' | 'ERASE';

type SelectedItem = { kind: 'shelf'; shelfId: string } | { kind: 'element'; index: number } | null;

const ELEMENT_META: Record<
  LayoutElementType,
  { label: string; shortLabel: string; className: string }
> = {
  [LayoutElementType.DOOR]: {
    label: 'Cửa ra vào',
    shortLabel: 'Cửa',
    className: 'bg-amber-500/20 text-amber-800 border-amber-500/50',
  },
  [LayoutElementType.AISLE]: {
    label: 'Lối đi',
    shortLabel: 'Lối đi',
    className: 'bg-slate-200/70 text-slate-600 border-slate-300',
  },
  [LayoutElementType.OBSTACLE]: {
    label: 'Cột / Vật cản',
    shortLabel: 'Vật cản',
    className: 'bg-rose-500/15 text-rose-800 border-rose-400/50',
  },
  [LayoutElementType.LABEL]: {
    label: 'Nhãn khu vực',
    shortLabel: 'Nhãn',
    className: 'bg-indigo-500/15 text-indigo-800 border-indigo-400/50',
  },
};

const SHELF_STATUS_CELL_STYLE: Record<WarehouseStatus, string> = {
  AVAILABLE: 'bg-emerald-500/15 text-emerald-900 border-emerald-500/60',
  HELD: 'bg-amber-500/20 text-amber-900 border-amber-500/60',
  BOOKED: 'bg-sky-500/20 text-sky-900 border-sky-500/60',
  RENTED: 'bg-blue-500/20 text-blue-900 border-blue-500/60',
  PENDING_INSPECTION: 'bg-amber-500/20 text-amber-900 border-amber-500/60',
  MAINTENANCE: 'bg-red-500/15 text-red-900 border-red-500/60',
  INACTIVE: 'bg-neutral-300/60 text-neutral-700 border-neutral-400',
};

const coversCell = (rect: LayoutRect, r: number, c: number) =>
  r >= rect.row && r < rect.row + rect.rowSpan && c >= rect.col && c < rect.col + rect.colSpan;

const rectsOverlap = (a: LayoutRect, b: LayoutRect) =>
  a.row < b.row + b.rowSpan &&
  a.row + a.rowSpan > b.row &&
  a.col < b.col + b.colSpan &&
  a.col + a.colSpan > b.col;

export function describeLayoutError(err: unknown): string {
  if (!(err instanceof Error)) return 'Không thể lưu sơ đồ mặt bằng.';
  const { status, details } = err as ApiError;
  if (status === 409 && details?.reason === 'LAYOUT_VERSION_MISMATCH') {
    return 'Sơ đồ đã được người khác cập nhật trước đó. Vui lòng tải lại sơ đồ mới nhất rồi lưu lại.';
  }
  if (status === 409 && /too many shelves/i.test(err.message)) {
    return 'Số lượng kệ quá lớn để tạo sơ đồ tự động (tối đa 1000 kệ và 100 hàng).';
  }
  if (status === 400 && Array.isArray(details?.fields) && details.fields.length > 0) {
    const first = details.fields[0] as { field?: string; code?: string; message?: string };
    if (first.code === 'OVERLAP') {
      return 'Có kệ hoặc vật thể trên sơ đồ bị chồng lấp vị trí với nhau. Hãy kiểm tra lại các ô.';
    }
    if (first.code === 'OUT_OF_BOUNDS') {
      return 'Có kệ hoặc vật thể nằm ngoài phạm vi kích thước lưới (hàng × cột) hiện tại.';
    }
    if (first.code === 'TEXT_REQUIRED') {
      return 'Nhãn khu vực (LABEL) bắt buộc phải có nội dung văn bản.';
    }
    if (first.code === 'TEXT_TOO_LONG') {
      return 'Nội dung nhãn tối đa 60 ký tự.';
    }
    if (first.code === 'DUPLICATE_SHELF') {
      return 'Một kệ không thể được đặt ở 2 vị trí khác nhau trên sơ đồ.';
    }
    if (first.code === 'UNKNOWN_SHELF') {
      return 'Có kệ trên sơ đồ không còn tồn tại trong kho. Hãy tải lại sơ đồ.';
    }
  }
  return err.message || 'Không thể lưu sơ đồ mặt bằng.';
}

export const ShelfLayoutEditor: React.FC<Props> = ({ warehouse, shelves }) => {
  const toast = useAppToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(10);
  const [version, setVersion] = useState(0);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [placements, setPlacements] = useState<ShelfPlacement[]>([]);
  const [elements, setElements] = useState<LayoutElement[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const [tool, setTool] = useState<ToolMode>('SELECT');
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('Dãy A');
  const [selected, setSelected] = useState<SelectedItem>(null);

  const shelfMap = useMemo(() => new Map(shelves.map((s) => [s.id, s])), [shelves]);

  const loadLayout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setConfirmDelete(false);
    try {
      const view = await WarehousesApi.getLayoutAdmin(warehouse.id);
      if (view.layout) {
        setRows(view.layout.rows);
        setCols(view.layout.cols);
        setVersion(view.layout.version);
        setUpdatedAt(view.layout.updatedAt);
        setElements(view.layout.elements);
        setPlacements(
          view.placed.map(({ shelf, row, col, rowSpan, colSpan }) => ({
            shelfId: shelf.id,
            row,
            col,
            rowSpan,
            colSpan,
          })),
        );
        setHasSavedLayout(true);
      } else {
        setRows(8);
        setCols(10);
        setVersion(0);
        setUpdatedAt(null);
        setElements([]);
        setPlacements([]);
        setHasSavedLayout(false);
      }
      setIsDirty(false);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được sơ đồ mặt bằng.');
    } finally {
      setIsLoading(false);
    }
  }, [warehouse.id]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  const placedIds = useMemo(() => new Set(placements.map((p) => p.shelfId)), [placements]);
  const unplacedShelves = useMemo(
    () => shelves.filter((s) => !placedIds.has(s.id)),
    [shelves, placedIds],
  );

  useEffect(() => {
    if (activeShelfId && placedIds.has(activeShelfId)) {
      const next = unplacedShelves[0]?.id ?? null;
      setActiveShelfId(next);
    } else if (!activeShelfId && unplacedShelves.length > 0) {
      setActiveShelfId(unplacedShelves[0].id);
    }
  }, [activeShelfId, placedIds, unplacedShelves]);

  const isCellBlocked = (r: number, c: number, ignoreShelfId?: string, ignoreElemIdx?: number) => {
    const candidate: LayoutRect = { row: r, col: c, rowSpan: 1, colSpan: 1 };
    for (const p of placements) {
      if (p.shelfId !== ignoreShelfId && rectsOverlap(p, candidate)) return true;
    }
    for (let i = 0; i < elements.length; i += 1) {
      const el = elements[i];
      if (
        i !== ignoreElemIdx &&
        el.type !== LayoutElementType.LABEL &&
        rectsOverlap(el, candidate)
      ) {
        return true;
      }
    }
    return false;
  };

  const handleCellClick = (r: number, c: number) => {
    setError(null);
    const hitShelf = placements.find((p) => coversCell(p, r, c));
    const hitElemIdx = elements.findIndex((el) => coversCell(el, r, c));

    if (tool === 'ERASE') {
      if (hitShelf) {
        setPlacements((prev) => prev.filter((p) => p.shelfId !== hitShelf.shelfId));
        setSelected(null);
        setIsDirty(true);
      } else if (hitElemIdx !== -1) {
        setElements((prev) => prev.filter((_, i) => i !== hitElemIdx));
        setSelected(null);
        setIsDirty(true);
      }
      return;
    }

    if (tool === 'SELECT') {
      if (hitShelf) {
        setSelected({ kind: 'shelf', shelfId: hitShelf.shelfId });
      } else if (hitElemIdx !== -1) {
        setSelected({ kind: 'element', index: hitElemIdx });
      } else {
        setSelected(null);
      }
      return;
    }

    if (tool === 'PLACE_SHELF') {
      if (!activeShelfId) {
        toast.warning('Chưa chọn kệ', 'Hãy chọn một kệ trong danh sách kệ chưa đặt bên cạnh.');
        return;
      }
      if (isCellBlocked(r, c, activeShelfId)) {
        toast.warning('Ô đã có vật thể', 'Ô này đã có kệ hoặc vật cản khác.');
        return;
      }
      setPlacements((prev) => [
        ...prev.filter((p) => p.shelfId !== activeShelfId),
        { shelfId: activeShelfId, row: r, col: c, rowSpan: 1, colSpan: 1 },
      ]);
      setSelected({ kind: 'shelf', shelfId: activeShelfId });
      setIsDirty(true);
      return;
    }

    if (tool === 'LABEL') {
      const trimmed = labelText.trim();
      if (!trimmed) {
        toast.warning('Thiếu nội dung nhãn', 'Vui lòng nhập tên nhãn trước khi đặt lên sơ đồ.');
        return;
      }
      if (trimmed.length > 60) {
        toast.warning('Nhãn quá dài', 'Nội dung nhãn tối đa 60 ký tự.');
        return;
      }
      const nextElem: LayoutElement = {
        type: LayoutElementType.LABEL,
        row: r,
        col: c,
        rowSpan: 1,
        colSpan: 1,
        text: trimmed,
      };
      setElements((prev) => [...prev, nextElem]);
      setSelected({ kind: 'element', index: elements.length });
      setIsDirty(true);
      return;
    }

    // Blocking element tools: DOOR, AISLE, OBSTACLE
    const elemType = tool as LayoutElementType;
    if (isCellBlocked(r, c)) {
      toast.warning('Ô đã có vật thể', 'Ô này đã có kệ hoặc vật thể khác.');
      return;
    }
    const nextElem: LayoutElement = {
      type: elemType,
      row: r,
      col: c,
      rowSpan: 1,
      colSpan: 1,
    };
    setElements((prev) => [...prev, nextElem]);
    setSelected({ kind: 'element', index: elements.length });
    setIsDirty(true);
  };

  const handleAutoDraft = async () => {
    setIsDrafting(true);
    setError(null);
    try {
      const draft = await WarehousesApi.draftLayout(warehouse.id);
      setRows(draft.rows);
      setCols(draft.cols);
      setElements(draft.elements);
      setPlacements(draft.placements);
      setVersion(draft.basedOnVersion);
      setIsDirty(true);
      setSelected(null);
      toast.info(
        'Đã tạo bản nháp sơ đồ',
        `Đã tự động sắp xếp ${draft.placements.length} kệ lên lưới ${draft.rows}×${draft.cols}. Nhấn "Lưu sơ đồ" để áp dụng.`,
      );
    } catch (err) {
      const msg = describeLayoutError(err);
      setError(msg);
      toast.error('Không tạo được sơ đồ tự động', msg);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSave = async () => {
    if (!Number.isInteger(rows) || rows < 1 || rows > 100) {
      setError('Số hàng lưới phải từ 1 đến 100.');
      return;
    }
    if (!Number.isInteger(cols) || cols < 1 || cols > 100) {
      setError('Số cột lưới phải từ 1 đến 100.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await WarehousesApi.saveLayout(warehouse.id, {
        rows,
        cols,
        elements,
        placements,
        version,
      });
      if (saved.layout) {
        setRows(saved.layout.rows);
        setCols(saved.layout.cols);
        setVersion(saved.layout.version);
        setUpdatedAt(saved.layout.updatedAt);
        setElements(saved.layout.elements);
        setPlacements(
          saved.placed.map(({ shelf, row, col, rowSpan, colSpan }) => ({
            shelfId: shelf.id,
            row,
            col,
            rowSpan,
            colSpan,
          })),
        );
        setHasSavedLayout(true);
      }
      setIsDirty(false);
      toast.success(
        'Đã lưu sơ đồ mặt bằng',
        `Sơ đồ kho ${warehouse.code} (phiên bản v${saved.layout?.version ?? version + 1}) đã được cập nhật.`,
      );
    } catch (err) {
      const msg = describeLayoutError(err);
      setError(msg);
      toast.error('Lỗi lưu sơ đồ', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLayout = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await WarehousesApi.deleteLayout(warehouse.id, version);
      setHasSavedLayout(false);
      setVersion(0);
      setUpdatedAt(null);
      setPlacements([]);
      setElements([]);
      setIsDirty(false);
      setConfirmDelete(false);
      setSelected(null);
      toast.info('Đã xóa sơ đồ', `Đã xóa sơ đồ mặt bằng của kho ${warehouse.code}.`);
    } catch (err) {
      const msg = describeLayoutError(err);
      setError(msg);
      toast.error('Không xóa được sơ đồ', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedPlacement =
    selected?.kind === 'shelf'
      ? (placements.find((p) => p.shelfId === selected.shelfId) ?? null)
      : null;
  const selectedElement = selected?.kind === 'element' ? (elements[selected.index] ?? null) : null;

  const updateSelectedRect = (patch: Partial<LayoutRect & { text?: string }>) => {
    if (selected?.kind === 'shelf') {
      setPlacements((prev) =>
        prev.map((p) => (p.shelfId === selected.shelfId ? { ...p, ...patch } : p)),
      );
      setIsDirty(true);
    } else if (selected?.kind === 'element') {
      setElements((prev) =>
        prev.map((el, idx) => (idx === selected.index ? { ...el, ...patch } : el)),
      );
      setIsDirty(true);
    }
  };

  const removeSelected = () => {
    if (selected?.kind === 'shelf') {
      setPlacements((prev) => prev.filter((p) => p.shelfId !== selected.shelfId));
      setSelected(null);
      setIsDirty(true);
    } else if (selected?.kind === 'element') {
      setElements((prev) => prev.filter((_, idx) => idx !== selected.index));
      setSelected(null);
      setIsDirty(true);
    }
  };

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <Text variant="secondary">Đang tải sơ đồ mặt bằng kho kệ...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={hasSavedLayout ? 'success' : 'neutral'}>
            {hasSavedLayout ? `Phiên bản v${version}` : 'Chưa lưu sơ đồ'}
          </Badge>
          {isDirty && <Badge variant="warning">Có thay đổi chưa lưu</Badge>}
          <span className="text-xs text-kumo-subtle">
            Đã đặt {placements.length}/{shelves.length} kệ · {elements.length} thành phần phụ
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
            onClick={() => void loadLayout()}
            disabled={isSaving || isDrafting || isDeleting}
          >
            Tải lại
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<MagicWand className="w-3.5 h-3.5" />}
            loading={isDrafting}
            disabled={shelves.length === 0 || isSaving || isDeleting}
            onClick={handleAutoDraft}
          >
            Tạo sơ đồ tự động
          </Button>
          {hasSavedLayout && !confirmDelete && (
            <Button
              size="sm"
              variant="secondary-destructive"
              icon={<Trash className="w-3.5 h-3.5" />}
              disabled={isSaving || isDrafting || isDeleting}
              onClick={() => setConfirmDelete(true)}
            >
              Xóa sơ đồ
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            icon={<FloppyDisk className="w-3.5 h-3.5" />}
            loading={isSaving}
            disabled={isDrafting || isDeleting}
            onClick={handleSave}
          >
            Lưu sơ đồ
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="p-3 bg-kumo-warning-tint rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-kumo-default">
            Xóa sơ đồ mặt bằng của kho <strong>{warehouse.code}</strong>? Các kệ bên trong kho vẫn
            được giữ nguyên.
          </span>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Hủy
            </Button>
            <Button
              size="xs"
              variant="destructive"
              loading={isDeleting}
              onClick={handleDeleteLayout}
            >
              Xác nhận xóa sơ đồ
            </Button>
          </div>
        </div>
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

      {/* Grid Size & Tool Palette */}
      <LayerCard className="p-4 ring ring-kumo-line space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-kumo-default mr-1">Công cụ:</span>
            {(
              [
                ['SELECT', 'Chọn / Sửa ô'],
                ['PLACE_SHELF', `Đặt kệ (${unplacedShelves.length})`],
                ['DOOR', 'Cửa ra vào'],
                ['AISLE', 'Lối đi'],
                ['OBSTACLE', 'Vật cản'],
                ['LABEL', 'Nhãn chữ'],
                ['ERASE', 'Xóa ô'],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                size="sm"
                variant={tool === mode ? 'primary' : 'secondary'}
                icon={mode === 'ERASE' ? <Eraser className="w-3.5 h-3.5" /> : undefined}
                onClick={() => setTool(mode)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24">
              <Input
                label="Số hàng"
                type="number"
                min="1"
                max="100"
                value={String(rows)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isInteger(v) && v >= 1 && v <= 100) {
                    setRows(v);
                    setIsDirty(true);
                  }
                }}
              />
            </div>
            <div className="w-24">
              <Input
                label="Số cột"
                type="number"
                min="1"
                max="100"
                value={String(cols)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isInteger(v) && v >= 1 && v <= 100) {
                    setCols(v);
                    setIsDirty(true);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {tool === 'LABEL' && (
          <div className="max-w-xs">
            <Input
              label="Nội dung nhãn (tối đa 60 ký tự)"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
            />
          </div>
        )}
      </LayerCard>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Unplaced shelves + Selected Item Inspector */}
        <div className="space-y-4 lg:col-span-1">
          <LayerCard className="p-3.5 ring ring-kumo-line space-y-2.5">
            <div className="flex items-center justify-between">
              <Text as="strong" bold size="sm">
                Kệ chưa đặt ({unplacedShelves.length})
              </Text>
            </div>
            {unplacedShelves.length === 0 ? (
              <p className="text-xs text-kumo-subtle">
                {shelves.length === 0
                  ? 'Kho chưa có kệ nào. Hãy tạo kệ ở tab Danh sách kệ trước.'
                  : 'Tất cả kệ của kho đã được đặt lên sơ đồ.'}
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {unplacedShelves.map((shelf) => {
                  const isCurrent = activeShelfId === shelf.id && tool === 'PLACE_SHELF';
                  return (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={() => {
                        setActiveShelfId(shelf.id);
                        setTool('PLACE_SHELF');
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-md border text-xs cursor-pointer flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-kumo-brand/10 border-kumo-brand text-kumo-default font-semibold'
                          : 'bg-kumo-base border-kumo-line text-kumo-default hover:bg-kumo-control'
                      }`}
                    >
                      <span className="font-mono truncate">{shelf.code}</span>
                      <span className="text-kumo-subtle shrink-0">{formatArea(shelf.areaM2)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </LayerCard>

          {(selectedPlacement || selectedElement) && (
            <LayerCard className="p-3.5 ring ring-kumo-line space-y-3">
              <div className="flex items-center justify-between">
                <Text as="strong" bold size="sm">
                  {selectedPlacement
                    ? `Kệ ${shelfMap.get(selectedPlacement.shelfId)?.code ?? ''}`
                    : `Thành phần: ${selectedElement ? ELEMENT_META[selectedElement.type].label : ''}`}
                </Text>
                <Button size="xs" variant="secondary-destructive" onClick={removeSelected}>
                  Gỡ khỏi sơ đồ
                </Button>
              </div>

              {selectedPlacement && shelfMap.get(selectedPlacement.shelfId) && (
                <div className="text-xs space-y-1 text-kumo-subtle">
                  <div>
                    Giá:{' '}
                    <strong className="text-kumo-default">
                      {formatVnd(shelfMap.get(selectedPlacement.shelfId)?.monthlyPrice ?? 0)}
                    </strong>
                  </div>
                  <div>
                    Trạng thái:{' '}
                    <Badge
                      variant={
                        WAREHOUSE_STATUS_LABEL[
                          shelfMap.get(selectedPlacement.shelfId)?.status ?? 'AVAILABLE'
                        ].variant
                      }
                    >
                      {
                        WAREHOUSE_STATUS_LABEL[
                          shelfMap.get(selectedPlacement.shelfId)?.status ?? 'AVAILABLE'
                        ].label
                      }
                    </Badge>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Hàng (0-based)"
                  type="number"
                  min="0"
                  max={rows - 1}
                  value={String((selectedPlacement ?? selectedElement)?.row ?? 0)}
                  onChange={(e) => updateSelectedRect({ row: Math.max(0, Number(e.target.value)) })}
                />
                <Input
                  label="Cột (0-based)"
                  type="number"
                  min="0"
                  max={cols - 1}
                  value={String((selectedPlacement ?? selectedElement)?.col ?? 0)}
                  onChange={(e) => updateSelectedRect({ col: Math.max(0, Number(e.target.value)) })}
                />
                <Input
                  label="Số hàng (rowSpan)"
                  type="number"
                  min="1"
                  max={rows}
                  value={String((selectedPlacement ?? selectedElement)?.rowSpan ?? 1)}
                  onChange={(e) =>
                    updateSelectedRect({ rowSpan: Math.max(1, Number(e.target.value)) })
                  }
                />
                <Input
                  label="Số cột (colSpan)"
                  type="number"
                  min="1"
                  max={cols}
                  value={String((selectedPlacement ?? selectedElement)?.colSpan ?? 1)}
                  onChange={(e) =>
                    updateSelectedRect({ colSpan: Math.max(1, Number(e.target.value)) })
                  }
                />
              </div>

              {selectedElement?.type === LayoutElementType.LABEL && (
                <Input
                  label="Nội dung nhãn"
                  value={selectedElement.text ?? ''}
                  onChange={(e) => updateSelectedRect({ text: e.target.value })}
                />
              )}
            </LayerCard>
          )}
        </div>

        {/* Interactive Floor Plan Grid */}
        <LayerCard className="p-4 ring ring-kumo-line lg:col-span-3 overflow-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-kumo-subtle">
            <span>
              Nhấp vào ô trên lưới ({rows} hàng × {cols} cột) để thao tác theo công cụ đang chọn.
            </span>
            {updatedAt && (
              <span>Cập nhật lần cuối: {new Date(updatedAt).toLocaleString('vi-VN')}</span>
            )}
          </div>

          <section
            aria-label={`Lưới sơ đồ mặt bằng ${warehouse.code}`}
            className="inline-grid gap-1 p-2 rounded-lg bg-kumo-control border border-kumo-line"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(64px, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(56px, auto))`,
            }}
          >
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (__, c) => {
                const shelfPlacement = placements.find((p) => coversCell(p, r, c));
                const shelf = shelfPlacement ? shelfMap.get(shelfPlacement.shelfId) : undefined;
                const elemIdx = elements.findIndex(
                  (el) => el.type !== LayoutElementType.LABEL && coversCell(el, r, c),
                );
                const blockingElem = elemIdx !== -1 ? elements[elemIdx] : undefined;
                const labelIdx = elements.findIndex(
                  (el) => el.type === LayoutElementType.LABEL && coversCell(el, r, c),
                );
                const labelElem = labelIdx !== -1 ? elements[labelIdx] : undefined;

                // Merge spanned cells into a single block anchored at (rect.row, rect.col).
                const primaryRect = shelfPlacement ?? blockingElem ?? labelElem;
                if (primaryRect && (r !== primaryRect.row || c !== primaryRect.col)) {
                  return null;
                }

                const spanR = primaryRect
                  ? Math.max(1, Math.min(primaryRect.rowSpan, rows - r))
                  : 1;
                const spanC = primaryRect
                  ? Math.max(1, Math.min(primaryRect.colSpan, cols - c))
                  : 1;

                const isSelected =
                  (selected?.kind === 'shelf' && selected.shelfId === shelfPlacement?.shelfId) ||
                  (selected?.kind === 'element' &&
                    (selected.index === elemIdx || selected.index === labelIdx));

                const cellStyle = shelf
                  ? SHELF_STATUS_CELL_STYLE[shelf.status]
                  : blockingElem
                    ? ELEMENT_META[blockingElem.type].className
                    : labelElem
                      ? ELEMENT_META[LayoutElementType.LABEL].className
                      : 'bg-kumo-base border-kumo-line text-kumo-subtle hover:bg-kumo-tint';

                const shortCode = shelf
                  ? shelf.code.startsWith(`${warehouse.code}-`)
                    ? shelf.code.slice(warehouse.code.length + 1)
                    : shelf.code
                  : null;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    aria-label={`Ô (${r}, ${c})${shelf ? ` - Kệ ${shelf.code}` : ''}`}
                    onClick={() => handleCellClick(r, c)}
                    style={{
                      gridRow: `${r + 1} / span ${spanR}`,
                      gridColumn: `${c + 1} / span ${spanC}`,
                    }}
                    className={`min-h-14 h-full px-1.5 py-1 rounded border text-[11px] flex flex-col items-center justify-center text-center cursor-pointer select-none ${cellStyle} ${
                      isSelected ? 'ring-2 ring-kumo-brand font-semibold' : ''
                    }`}
                  >
                    {labelElem && (
                      <span className="text-[10px] font-semibold text-indigo-700 truncate max-w-full">
                        {labelElem.text}
                      </span>
                    )}
                    {shelf ? (
                      <>
                        <span className="font-mono font-semibold truncate max-w-full">
                          {shortCode}
                        </span>
                        <span className="text-[10px] opacity-80 truncate max-w-full">
                          {WAREHOUSE_STATUS_LABEL[shelf.status].label}
                        </span>
                        {(spanR > 1 || spanC > 1) && (
                          <span className="text-[10px] opacity-70 font-mono">
                            {spanR}×{spanC} ô
                          </span>
                        )}
                      </>
                    ) : blockingElem ? (
                      <span className="font-medium truncate max-w-full">
                        {ELEMENT_META[blockingElem.type].shortLabel}
                      </span>
                    ) : !labelElem ? (
                      <span className="opacity-40 font-mono text-[10px]">
                        {r},{c}
                      </span>
                    ) : null}
                  </button>
                );
              }),
            )}
          </section>
        </LayerCard>
      </div>
    </div>
  );
};
