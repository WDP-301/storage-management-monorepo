import type {
  CreateShelfReceiptInput,
  CreateShelfRecoveryInput,
  DropOffRequestLineView,
  PickupRequestLineView,
  ShelfItemView,
  ShelfReceiptType,
} from '@storage/types';

/** Form state of one receipt before it is sent; pure so the validation rules are testable. */

export type DraftLine = {
  /** Stable id inside the draft: the item id, or the normalised name for a new item. */
  key: string;
  itemId?: string;
  name: string;
  quantity: number;
  /** Pick-up only: what is on the shelf right now. */
  max?: number;
};

export type ReceiptDraft = { type: ShelfReceiptType; lines: DraftLine[] };

type Built<T> = { input: T } | { error: string };

export const MAX_ITEM_NAME = 120;
export const MAX_QUANTITY = 10000;

/** Same normalisation as the API: trim, collapse spaces, case-insensitive (Vietnamese). */
export const cleanName = (name: string): string =>
  name.normalize('NFC').trim().replace(/\s+/g, ' ');
export const nameKey = (name: string): string => cleanName(name).toLocaleLowerCase('vi');

export const newDraft = (type: ShelfReceiptType): ReceiptDraft => ({ type, lines: [] });

const clampQuantity = (quantity: number, max?: number): number => {
  const whole = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
  return Math.min(Math.max(whole, 0), max ?? MAX_QUANTITY);
};

const bump = (lines: DraftLine[], index: number): DraftLine[] =>
  lines.map((line, i) =>
    i === index ? { ...line, quantity: clampQuantity(line.quantity + 1, line.max) } : line,
  );

/** Drop-off of more of an item already on the shelf; a repeated tap raises the quantity. */
export function addTopUp(
  draft: ReceiptDraft,
  item: Pick<ShelfItemView, 'id' | 'name'>,
): ReceiptDraft {
  const key = nameKey(item.name);
  const index = draft.lines.findIndex(
    (line) => line.itemId === item.id || nameKey(line.name) === key,
  );
  if (index >= 0) return { ...draft, lines: bump(draft.lines, index) };
  return {
    ...draft,
    lines: [...draft.lines, { key: item.id, itemId: item.id, name: item.name, quantity: 1 }],
  };
}

/** Drop-off of an item not typed before; a name already in the form raises that line instead. */
export function addNewItem(draft: ReceiptDraft, name: string): ReceiptDraft {
  const cleaned = cleanName(name);
  if (!cleaned) return draft;
  const key = nameKey(cleaned);
  const index = draft.lines.findIndex((line) => nameKey(line.name) === key);
  if (index >= 0) return { ...draft, lines: bump(draft.lines, index) };
  return {
    ...draft,
    lines: [...draft.lines, { key: `new:${key}`, name: cleaned, quantity: 1 }],
  };
}

export const setQuantity = (draft: ReceiptDraft, key: string, quantity: number): ReceiptDraft => ({
  ...draft,
  lines: draft.lines.map((line) =>
    line.key === key ? { ...line, quantity: clampQuantity(quantity, line.max) } : line,
  ),
});

export const removeLine = (draft: ReceiptDraft, key: string): ReceiptDraft => ({
  ...draft,
  lines: draft.lines.filter((line) => line.key !== key),
});

/** Drop-off lines preset from the customer's request: known items by id, new ones by name. */
export function prefillDropOff(
  requestLines: readonly Pick<DropOffRequestLineView, 'itemId' | 'name' | 'quantity'>[] = [],
): ReceiptDraft {
  return {
    type: 'DROP_OFF',
    lines: requestLines.map((line) =>
      line.itemId
        ? {
            key: line.itemId,
            itemId: line.itemId,
            name: line.name,
            quantity: clampQuantity(line.quantity),
          }
        : {
            key: `new:${nameKey(line.name)}`,
            name: cleanName(line.name),
            quantity: clampQuantity(line.quantity),
          },
    ),
  };
}

/** One stepper per item on the shelf, preset to what the customer asked for (never above stock). */
export function prefillPickUp(
  items: readonly ShelfItemView[],
  requestLines: readonly Pick<PickupRequestLineView, 'itemId' | 'quantity'>[] = [],
): ReceiptDraft {
  const wanted = new Map(requestLines.map((line) => [line.itemId, line.quantity]));
  return {
    type: 'PICK_UP',
    lines: items.map((item) => ({
      key: item.id,
      itemId: item.id,
      name: item.name,
      quantity: clampQuantity(wanted.get(item.id) ?? 0, item.quantity),
      max: item.quantity,
    })),
  };
}

/** Lines with a quantity, or the Vietnamese reason the draft cannot be sent. */
function validLines(draft: ReceiptDraft): { lines: DraftLine[] } | { error: string } {
  const lines = draft.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) return { error: 'Thêm ít nhất một món với số lượng từ 1.' };
  const seen = new Set<string>();
  for (const line of lines) {
    const label = line.name || 'Món đồ';
    if (!line.itemId && (!cleanName(line.name) || cleanName(line.name).length > MAX_ITEM_NAME)) {
      return { error: `Tên món phải từ 1 đến ${MAX_ITEM_NAME} ký tự.` };
    }
    if (line.max !== undefined && line.quantity > line.max) {
      return { error: `${label}: trên kệ chỉ còn ${line.max}.` };
    }
    const key = line.itemId ?? nameKey(line.name);
    if (seen.has(key) || seen.has(nameKey(line.name))) {
      return { error: `${label} bị nhập trùng, hãy gộp thành một dòng.` };
    }
    seen.add(key);
    seen.add(nameKey(line.name));
  }
  return { lines };
}

export type ReceiptContext = {
  clientRequestId: string;
  sessionId: string;
  contractId: string;
  photos: NonNullable<CreateShelfReceiptInput['photos']>;
  note: string;
  /** Set when the pick-up completes the customer's open request. */
  pickupRequestId?: string;
  /** Set when the drop-off completes the customer's open drop-off request. */
  dropOffRequestId?: string;
};

export function toReceiptInput(
  draft: ReceiptDraft,
  ctx: ReceiptContext,
): Built<CreateShelfReceiptInput> {
  const checked = validLines(draft);
  if ('error' in checked) return checked;
  if (draft.type === 'DROP_OFF' && ctx.photos.length === 0) {
    return { error: 'Cần ít nhất 1 ảnh đồ nhận.' };
  }
  const note = ctx.note.trim();
  return {
    input: {
      clientRequestId: ctx.clientRequestId,
      sessionId: ctx.sessionId,
      contractId: ctx.contractId,
      type: draft.type,
      lines: checked.lines.map((line) =>
        line.itemId
          ? { itemId: line.itemId, quantity: line.quantity }
          : { name: cleanName(line.name), quantity: line.quantity },
      ),
      ...(ctx.photos.length > 0 ? { photos: ctx.photos } : {}),
      ...(note ? { note } : {}),
      ...(draft.type === 'PICK_UP' && ctx.pickupRequestId
        ? { pickupRequestId: ctx.pickupRequestId }
        : {}),
      ...(draft.type === 'DROP_OFF' && ctx.dropOffRequestId
        ? { dropOffRequestId: ctx.dropOffRequestId }
        : {}),
    },
  };
}

export type RecoveryContext = {
  clientRequestId: string;
  contractId: string;
  photos: CreateShelfRecoveryInput['photos'];
  note: string;
};

/** Scan-less recovery: pick-up of existing items only, with a photo and a note on record. */
export function toRecoveryInput(
  draft: ReceiptDraft,
  ctx: RecoveryContext,
): Built<CreateShelfRecoveryInput> {
  const checked = validLines(draft);
  if ('error' in checked) return checked;
  if (ctx.photos.length === 0) return { error: 'Cần ít nhất 1 ảnh khi thu hồi đồ.' };
  const note = ctx.note.trim();
  if (!note) return { error: 'Cần ghi chú lý do thu hồi.' };
  return {
    input: {
      clientRequestId: ctx.clientRequestId,
      contractId: ctx.contractId,
      lines: checked.lines.flatMap((line) =>
        line.itemId ? [{ itemId: line.itemId, quantity: line.quantity }] : [],
      ),
      photos: ctx.photos,
      note,
    },
  };
}
