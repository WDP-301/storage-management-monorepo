import type { CreateDropOffRequestInput } from '@storage/types';
import { NOTE_MAX, requestedForIso } from './pickup-request-draft';
import { cleanName, MAX_ITEM_NAME, MAX_QUANTITY, nameKey } from './shelf-receipt-draft';

/** Pure rules for the customer's drop-off request form, kept apart from the UI so they are testable. */

/** A new item the customer will bring, typed by name. */
export type NewItemLine = { key: string; name: string; quantity: number };

type StockItem = { id: string; name: string };

export type DropOffDraftResult = { input: CreateDropOffRequestInput } | { error: string };

/**
 * Adds a typed item, or raises the quantity of the line with the same name. A name matching an
 * item already on the shelf is left to the caller, which tops that item up instead.
 */
export function addNewLine(lines: readonly NewItemLine[], name: string): NewItemLine[] {
  const cleaned = cleanName(name);
  if (!cleaned) return [...lines];
  const key = nameKey(cleaned);
  if (lines.some((line) => line.key === key)) {
    return lines.map((line) =>
      line.key === key ? { ...line, quantity: Math.min(line.quantity + 1, MAX_QUANTITY) } : line,
    );
  }
  return [...lines, { key, name: cleaned, quantity: 1 }];
}

/** Validates the form and shapes the request body; `error` is ready to show the customer. */
export function toDropOffRequestInput(
  items: readonly StockItem[],
  quantities: Readonly<Record<string, number>>,
  newLines: readonly NewItemLine[],
  dayIso: string | null,
  hour: number | null,
  note: string,
): DropOffDraftResult {
  const lines: CreateDropOffRequestInput['lines'] = [];
  const names = new Set(items.map((item) => nameKey(item.name)));
  for (const item of items) {
    const quantity = quantities[item.id] ?? 0;
    if (quantity <= 0) continue;
    if (!Number.isInteger(quantity) || quantity > MAX_QUANTITY) {
      return { error: `${item.name}: số lượng tối đa ${MAX_QUANTITY}.` };
    }
    lines.push({ itemId: item.id, quantity });
  }
  for (const line of newLines) {
    if (line.quantity <= 0) continue;
    const name = cleanName(line.name);
    if (!name || name.length > MAX_ITEM_NAME) {
      return { error: `Tên món phải từ 1 đến ${MAX_ITEM_NAME} ký tự.` };
    }
    if (names.has(nameKey(name))) {
      return { error: `${name} đã có trên kệ, hãy chọn ở danh sách phía trên.` };
    }
    lines.push({ name, quantity: line.quantity });
  }
  if (lines.length === 0) return { error: 'Chọn hoặc thêm ít nhất một món sẽ gửi.' };
  if (!dayIso) return { error: 'Chọn ngày gửi đồ.' };
  if (hour === null) return { error: 'Chọn giờ gửi đồ.' };
  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX) return { error: `Ghi chú tối đa ${NOTE_MAX} ký tự.` };
  return {
    input: {
      lines,
      requestedFor: requestedForIso(dayIso, hour),
      ...(trimmed ? { note: trimmed } : {}),
    },
  };
}
