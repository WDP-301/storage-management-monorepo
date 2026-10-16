import { Badge, Button, Input, LayerCard, Text } from '@cloudflare/kumo';
import {
  ArrowsClockwise,
  ArrowsCounterClockwise,
  CornersIn,
  CornersOut,
  Cursor,
  Eraser,
  FloppyDisk,
  GridFour,
  HandPalm,
  MagicWand,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { LayoutElementType } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type ToolMode =
  | 'PAN'
  | 'SELECT'
  | 'PLACE_SHELF'
  | 'DOOR'
  | 'AISLE'
  | 'OBSTACLE'
  | 'LABEL'
  | 'ERASE';

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

  // Cinema-style Pan & Zoom Canvas State (with Touchpad & Gesture Support)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragDistanceRef = useRef(0);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastZoomTriggerRef = useRef<number>(0);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  const zoomAtPoint = useCallback((targetZoom: number, clientX: number, clientY: number) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;

    setZoom((currZoom) => {
      const nextZoom = Math.min(2.5, Math.max(0.35, Number(targetZoom.toFixed(2))));
      if (nextZoom === currZoom) return currZoom;

      setPan((currPan) => {
        const ratio = nextZoom / currZoom;
        const newX = Math.round(cursorX - (cursorX - currPan.x) * ratio);
        const newY = Math.round(cursorY - (cursorY - currPan.y) * ratio);
        return { x: newX, y: newY };
      });

      return nextZoom;
    });
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        setSpacePressed(true);
      }
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastZoomTriggerRef.current < 350) return;
    lastZoomTriggerRef.current = now;
    const factor = e.shiftKey ? 0.72 : 1.35;
    zoomAtPoint(zoom * factor, e.clientX, e.clientY);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    // 1. Touchpad Pinch-to-zoom OR Ctrl / Meta + Wheel (like Google Maps)
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      zoomAtPoint(zoom * factor, e.clientX, e.clientY);
      return;
    }

    // 2. Shift + Wheel: scroll horizontally
    if (e.shiftKey) {
      setPan((prev) => ({
        x: Math.round(prev.x - e.deltaY),
        y: prev.y,
      }));
      return;
    }

    // 3. Touchpad two-finger swipe or standard wheel: pan smoothly across the canvas
    setPan((prev) => ({
      x: Math.round(prev.x - e.deltaX),
      y: Math.round(prev.y - e.deltaY),
    }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch tracking for touchscreens
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      initialPinchDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialZoomRef.current = zoom;
      setIsPanning(false);
      return;
    }

    const shouldPan = tool === 'PAN' || spacePressed || e.button === 1 || e.button === 2;
    if (shouldPan) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      dragDistanceRef.current = 0;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    } else {
      dragDistanceRef.current = 0;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Multi-touch pinch zoom
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const targetZoom = (initialZoomRef.current * currentDist) / initialPinchDistRef.current;
      zoomAtPoint(targetZoom, midX, midY);
      return;
    }

    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      dragDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      setPan({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }

    if (isPanning) {
      setIsPanning(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    // Touchpad / touch tap timing for double tap detection
    const now = Date.now();
    if (lastTapRef.current) {
      const dt = now - lastTapRef.current.time;
      const dist = Math.hypot(e.clientX - lastTapRef.current.x, e.clientY - lastTapRef.current.y);
      if (dt < 320 && dist < 25) {
        lastTapRef.current = null;
        if (now - lastZoomTriggerRef.current > 350) {
          lastZoomTriggerRef.current = now;
          const factor = e.shiftKey ? 0.72 : 1.35;
          zoomAtPoint(zoom * factor, e.clientX, e.clientY);
        }
        return;
      }
    }
    lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitView = () => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current.getBoundingClientRect();
    const estimatedGridW = cols * 78 + 48;
    const estimatedGridH = rows * 68 + 48;
    const scaleX = (vp.width - 56) / estimatedGridW;
    const scaleY = (vp.height - 56) / estimatedGridH;
    const fitted = Math.min(1.5, Math.max(0.35, Math.min(scaleX, scaleY)));
    setZoom(Number(fitted.toFixed(2)));
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitView();
    }, 120);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

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
    if (tool === 'PAN' || dragDistanceRef.current > 5) {
      return;
    }
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

  const renderCanvas = (heightClass: string, isModal: boolean) => (
    <section
      ref={viewportRef}
      aria-label="Khung sơ đồ mặt bằng tương tác"
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full ${heightClass} overflow-hidden rounded-xl border border-kumo-line bg-slate-900/[0.03] select-none outline-none touch-none ${
        tool === 'PAN' || spacePressed
          ? isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : 'cursor-default'
      }`}
      style={{
        touchAction: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(100, 116, 139, 0.25) 1px, transparent 1px)',
        backgroundSize: `${Math.max(16, 24 * zoom)}px ${Math.max(16, 24 * zoom)}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Floating Tool Palette on top-left (only in modal mode, embedded has its own tool card) */}
      {isModal && (
        <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1 p-1 bg-kumo-base/95 backdrop-blur rounded-lg border border-kumo-line shadow-sm max-w-[calc(100%-250px)]">
          {(
            [
              ['PAN', 'Kéo xem', <HandPalm key="pan" className="w-3.5 h-3.5" />],
              ['SELECT', 'Chọn / Sửa', <Cursor key="sel" className="w-3.5 h-3.5" />],
              ['PLACE_SHELF', `Đặt kệ (${unplacedShelves.length})`, undefined],
              ['DOOR', 'Cửa', undefined],
              ['AISLE', 'Lối đi', undefined],
              ['OBSTACLE', 'Vật cản', undefined],
              ['LABEL', 'Nhãn', undefined],
              ['ERASE', 'Xóa ô', <Eraser key="era" className="w-3.5 h-3.5" />],
            ] as const
          ).map(([mode, label, icon]) => (
            <Button
              key={mode}
              size="xs"
              variant={tool === mode ? 'primary' : 'secondary'}
              icon={icon}
              onClick={() => setTool(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {/* Floating Unplaced Shelves Popover (in modal when tool === 'PLACE_SHELF') */}
      {isModal && tool === 'PLACE_SHELF' && (
        <div className="absolute top-14 left-3 z-20 w-64 max-h-80 p-3 bg-kumo-base/95 backdrop-blur rounded-xl border border-kumo-line shadow-lg flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-kumo-default border-b border-kumo-line pb-1.5">
            <span>Chọn kệ cần đặt ({unplacedShelves.length})</span>
          </div>
          {unplacedShelves.length === 0 ? (
            <p className="text-xs text-kumo-subtle py-2">Tất cả kệ đã được đặt lên sơ đồ.</p>
          ) : (
            <div className="overflow-y-auto space-y-1 pr-1 max-h-60">
              {unplacedShelves.map((shelf) => (
                <button
                  key={shelf.id}
                  type="button"
                  onClick={() => setActiveShelfId(shelf.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded border text-xs cursor-pointer flex items-center justify-between gap-2 ${
                    activeShelfId === shelf.id
                      ? 'bg-kumo-brand/10 border-kumo-brand text-kumo-default font-semibold'
                      : 'bg-kumo-base border-kumo-line text-kumo-default hover:bg-kumo-control'
                  }`}
                >
                  <span className="font-mono truncate">{shelf.code}</span>
                  <span className="text-kumo-subtle shrink-0">{formatArea(shelf.areaM2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Label Text Input (in modal when tool === 'LABEL') */}
      {isModal && tool === 'LABEL' && (
        <div className="absolute top-14 left-3 z-20 w-64 p-3 bg-kumo-base/95 backdrop-blur rounded-xl border border-kumo-line shadow-lg">
          <Input
            label="Nội dung nhãn (tối đa 60 ký tự)"
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
          />
        </div>
      )}

      {/* Floating Selected Item Inspector (in modal) */}
      {isModal && (selectedPlacement || selectedElement) && (
        <div className="absolute top-14 right-3 z-20 w-72 p-3 bg-kumo-base/95 backdrop-blur rounded-xl border border-kumo-line shadow-lg space-y-2.5">
          <div className="flex items-center justify-between border-b border-kumo-line pb-1.5">
            <Text as="strong" bold size="xs">
              {selectedPlacement
                ? `Kệ ${shelfMap.get(selectedPlacement.shelfId)?.code ?? ''}`
                : `Thành phần: ${selectedElement ? ELEMENT_META[selectedElement.type].label : ''}`}
            </Text>
            <div className="flex items-center gap-1">
              <Button size="xs" variant="secondary-destructive" onClick={removeSelected}>
                Gỡ
              </Button>
              <Button
                size="xs"
                variant="ghost"
                shape="square"
                icon={<X className="w-3.5 h-3.5" />}
                aria-label="Đóng bảng chi tiết"
                onClick={() => setSelected(null)}
              />
            </div>
          </div>
          {selectedPlacement && shelfMap.get(selectedPlacement.shelfId) && (
            <div className="text-xs space-y-0.5 text-kumo-subtle">
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
          <div className="grid grid-cols-2 gap-1.5">
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
              label="Hàng span"
              type="number"
              min="1"
              max={rows}
              value={String((selectedPlacement ?? selectedElement)?.rowSpan ?? 1)}
              onChange={(e) => updateSelectedRect({ rowSpan: Math.max(1, Number(e.target.value)) })}
            />
            <Input
              label="Cột span"
              type="number"
              min="1"
              max={cols}
              value={String((selectedPlacement ?? selectedElement)?.colSpan ?? 1)}
              onChange={(e) => updateSelectedRect({ colSpan: Math.max(1, Number(e.target.value)) })}
            />
          </div>
        </div>
      )}

      {/* Floating Zoom & Canvas Controls (Top Right) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 bg-kumo-base/95 backdrop-blur rounded-lg border border-kumo-line shadow-sm">
        <Button
          size="xs"
          variant="ghost"
          shape="square"
          icon={<MagnifyingGlassMinus className="w-3.5 h-3.5" />}
          aria-label="Thu nhỏ (-)"
          title="Thu nhỏ (-)"
          onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))))}
        />
        <span className="text-xs font-mono font-medium px-1 text-kumo-default min-w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="xs"
          variant="ghost"
          shape="square"
          icon={<MagnifyingGlassPlus className="w-3.5 h-3.5" />}
          aria-label="Phóng to (+)"
          title="Phóng to (+)"
          onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
        />
        <div className="w-[1px] h-4 bg-kumo-line mx-0.5" />
        <Button
          size="xs"
          variant="ghost"
          shape="square"
          icon={<ArrowsCounterClockwise className="w-3.5 h-3.5" />}
          aria-label="Đặt lại 100%"
          title="Đặt lại 100%"
          onClick={handleResetView}
        />
        <Button
          size="xs"
          variant="ghost"
          shape="square"
          icon={<GridFour className="w-3.5 h-3.5" />}
          aria-label="Vừa khung hình"
          title="Vừa khung hình"
          onClick={handleFitView}
        />
        <div className="w-[1px] h-4 bg-kumo-line mx-0.5" />
        <Button
          size="xs"
          variant={isModal ? 'secondary' : 'ghost'}
          shape="square"
          icon={
            isModal ? <CornersIn className="w-3.5 h-3.5" /> : <CornersOut className="w-3.5 h-3.5" />
          }
          aria-label={isModal ? 'Thu nhỏ về trang chi tiết (Esc)' : 'Toàn màn hình theo modal'}
          title={isModal ? 'Thu nhỏ về trang chi tiết (Esc)' : 'Toàn màn hình theo modal'}
          onClick={() => setIsFullscreen((prev) => !prev)}
        />
      </div>

      {/* Floating Legend (Bottom Left, in modal) */}
      {isModal && (
        <div className="absolute bottom-3 left-3 z-20 hidden sm:flex flex-wrap items-center gap-2 px-3 py-1.5 bg-kumo-base/90 backdrop-blur rounded-lg border border-kumo-line text-[11px] text-kumo-subtle shadow-sm pointer-events-none">
          <span className="font-semibold text-kumo-default">Chú thích:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/30 border border-emerald-500" />{' '}
            Còn trống
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-500/30 border border-blue-500" /> Đang
            thuê
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/30 border border-amber-500" /> Giữ
            / Chờ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-red-500/30 border border-red-500" /> Bảo trì
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600/30 border border-amber-600" /> Cửa
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 border border-slate-400" /> Lối đi
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-400/30 border border-rose-500" /> Vật
            cản
          </span>
        </div>
      )}

      {/* Floating Shortcut Hint (Bottom Right, in modal) */}
      {isModal && (
        <div className="absolute bottom-3 right-3 z-20 hidden md:block px-3 py-1.5 bg-kumo-base/90 backdrop-blur rounded-lg border border-kumo-line text-[11px] text-kumo-subtle shadow-sm pointer-events-none">
          Chạm 2 lần / cuộn chuột để zoom • Kéo chuột để di chuyển • Phím Esc để đóng
        </div>
      )}

      {/* Transform Canvas Surface */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.08s ease-out',
          }}
          className="pointer-events-auto"
        >
          <section
            aria-label={`Lưới sơ đồ mặt bằng ${warehouse.code}`}
            className="inline-grid gap-1.5 p-3 rounded-xl bg-kumo-base border border-kumo-line shadow-md"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(72px, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(60px, auto))`,
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
        </div>
      </div>
    </section>
  );

  return (
    <>
      {/* Fullscreen Modal: "Cho nó modal á - Chỉ map thôi" */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150"
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label="Sơ đồ mặt bằng toàn màn hình"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsFullscreen(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsFullscreen(false);
            }
          }}
        >
          <div className="w-full h-full max-w-[98vw] max-h-[96vh] bg-kumo-base rounded-2xl border border-kumo-line shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-kumo-line bg-kumo-base shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-kumo-brand/10 text-kumo-brand flex items-center justify-center font-bold">
                  <GridFour className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Text as="h2" variant="heading">
                      Sơ đồ mặt bằng: {warehouse.name} ({warehouse.code})
                    </Text>
                    <Badge variant="primary">
                      {rows} hàng × {cols} cột
                    </Badge>
                    {isDirty ? (
                      <Badge variant="warning">Có thay đổi chưa lưu</Badge>
                    ) : (
                      <Badge variant="success">Đã lưu</Badge>
                    )}
                  </div>
                  <Text variant="secondary" size="xs">
                    {warehouse.facility.name} ({warehouse.facility.code}) · {placements.length}/
                    {shelves.length} kệ đã đặt · Nhấn Esc hoặc nút Thu nhỏ để thoát
                  </Text>
                </div>
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
                <div className="w-[1px] h-6 bg-kumo-line mx-1" />
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<CornersIn className="w-4 h-4" />}
                  onClick={() => setIsFullscreen(false)}
                  title="Thu nhỏ về trang chi tiết (Esc)"
                >
                  Thu nhỏ
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X className="w-4 h-4" />}
                  aria-label="Đóng toàn màn hình"
                  title="Đóng toàn màn hình (Esc)"
                  onClick={() => setIsFullscreen(false)}
                />
              </div>
            </div>

            {/* Modal Body: CHỈ MAP THÔI */}
            <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
              {renderCanvas('h-full flex-1', true)}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Standard View */}
      <div className="space-y-4">
        {/* Embedded Header Bar */}
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
            <div className="w-[1px] h-6 bg-kumo-line mx-1" />
            <Button
              size="sm"
              variant="secondary"
              icon={<CornersOut className="w-3.5 h-3.5" />}
              onClick={() => setIsFullscreen(true)}
              title="Mở toàn màn hình theo modal"
            >
              Toàn màn hình
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
                  ['PAN', 'Kéo xem', <HandPalm key="pan" className="w-3.5 h-3.5" />],
                  ['SELECT', 'Chọn / Sửa', <Cursor key="sel" className="w-3.5 h-3.5" />],
                  ['PLACE_SHELF', `Đặt kệ (${unplacedShelves.length})`, undefined],
                  ['DOOR', 'Cửa ra vào', undefined],
                  ['AISLE', 'Lối đi', undefined],
                  ['OBSTACLE', 'Vật cản', undefined],
                  ['LABEL', 'Nhãn chữ', undefined],
                  ['ERASE', 'Xóa ô', <Eraser key="era" className="w-3.5 h-3.5" />],
                ] as const
              ).map(([mode, label, icon]) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={tool === mode ? 'primary' : 'secondary'}
                  icon={icon}
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

        {/* Embedded 4-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Column: Unplaced shelves + Inspector */}
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
                        <span className="text-kumo-subtle shrink-0">
                          {formatArea(shelf.areaM2)}
                        </span>
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
                    onChange={(e) =>
                      updateSelectedRect({ row: Math.max(0, Number(e.target.value)) })
                    }
                  />
                  <Input
                    label="Cột (0-based)"
                    type="number"
                    min="0"
                    max={cols - 1}
                    value={String((selectedPlacement ?? selectedElement)?.col ?? 0)}
                    onChange={(e) =>
                      updateSelectedRect({ col: Math.max(0, Number(e.target.value)) })
                    }
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

          {/* Right Column: Embedded Canvas */}
          <LayerCard className="p-4 ring ring-kumo-line lg:col-span-3 flex flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-kumo-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-kumo-default">
                  Sơ đồ {rows} hàng × {cols} cột
                </span>
                <span>
                  Chạm 2 lần hoặc pinch để thu phóng • Cuộn 2 ngón tay hoặc kéo chuột để di chuyển
                  sơ đồ
                </span>
              </div>
              {updatedAt && (
                <span>Cập nhật lần cuối: {new Date(updatedAt).toLocaleString('vi-VN')}</span>
              )}
            </div>

            {!isFullscreen && renderCanvas('h-[580px]', false)}
          </LayerCard>
        </div>
      </div>
    </>
  );
};
