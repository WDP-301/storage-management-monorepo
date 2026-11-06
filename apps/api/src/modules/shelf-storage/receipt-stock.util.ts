import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { type ShelfItemView, ShelfReceiptType } from '@storage/types';
import type { EntityManager } from 'typeorm';
import type { NormalizedLine } from './receipt-input.util';
import { itemNameKey } from './shelf-rules';

/** A receipt line as applied to stock: the item and its name at that moment. */
export interface AppliedLine {
  itemId: string;
  name: string;
  quantity: number;
}

interface Shortage {
  itemId: string;
  name: string;
  requested: number;
  available: number;
}

const notInContract = (itemIds: string[]) =>
  new DomainException(
    ErrorCode.SHELF_RECEIPT_NOT_ALLOWED,
    'Món đồ không thuộc kệ của hợp đồng này',
    HttpStatus.CONFLICT,
    { reason: 'ITEM_NOT_IN_CONTRACT', itemIds },
  );

const insufficient = (reason: 'PICK_UP' | 'VOID', items: Shortage[]) =>
  new DomainException(
    ErrorCode.SHELF_STOCK_INSUFFICIENT,
    reason === 'VOID'
      ? 'Không thể hủy phiếu: số đồ trên kệ không đủ để hoàn lại'
      : 'Số đồ trên kệ không đủ để lấy',
    HttpStatus.CONFLICT,
    { reason, items },
  );

/**
 * One statement for all changed items; the rows are already locked by the caller. Changes to one
 * item are summed first: an UPDATE … FROM applies only one of several matching join rows.
 */
async function adjustStock(
  em: EntityManager,
  changes: { itemId: string; delta: number }[],
): Promise<void> {
  const totals = new Map<string, number>();
  for (const { itemId, delta } of changes) totals.set(itemId, (totals.get(itemId) ?? 0) + delta);
  if (totals.size === 0) return;
  await em.query(
    `UPDATE "shelf_items" i SET "quantity" = i."quantity" + d."delta", "updated_at" = now()
       FROM (SELECT unnest($1::uuid[]) AS "id", unnest($2::int[]) AS "delta") d
      WHERE i."id" = d."id"`,
    [[...totals.keys()], [...totals.values()]],
  );
}

/**
 * Adds a drop-off to the stock (rows locked by the caller, emptied ones included). A line names
 * an item of the contract or a name: a name matching an existing item (case and spacing ignored)
 * tops it up, otherwise it starts a new item. Lines landing on one item are merged.
 */
export async function applyDropOff(
  em: EntityManager,
  contractId: string,
  lines: NormalizedLine[],
  stock: ShelfItemView[],
): Promise<AppliedLine[]> {
  const byId = new Map(stock.map((item) => [item.id, item]));
  const byKey = new Map(stock.map((item) => [itemNameKey(item.name), item]));
  const unknown = lines.flatMap((line) =>
    line.itemId && !byId.has(line.itemId) ? [line.itemId] : [],
  );
  if (unknown.length > 0) throw notInContract(unknown);

  const applied = new Map<string, AppliedLine>();
  const topUps: { itemId: string; delta: number }[] = [];
  for (const line of lines) {
    const existing = line.itemId ? byId.get(line.itemId) : byKey.get(itemNameKey(line.name ?? ''));
    let itemId: string;
    let name: string;
    if (existing) {
      ({ id: itemId, name } = existing);
      topUps.push({ itemId, delta: line.quantity });
    } else {
      name = line.name as string;
      const [created]: { id: string }[] = await em.query(
        `INSERT INTO "shelf_items" ("contract_id", "name", "quantity") VALUES ($1, $2, $3) RETURNING "id"`,
        [contractId, name, line.quantity],
      );
      itemId = created.id;
      // A later line with the same name must top this item up, not insert a duplicate.
      byKey.set(itemNameKey(name), {
        id: itemId,
        name,
        quantity: line.quantity,
        updatedAt: new Date(),
      });
    }
    const before = applied.get(itemId);
    applied.set(itemId, { itemId, name, quantity: (before?.quantity ?? 0) + line.quantity });
  }
  await adjustStock(em, topUps);
  return [...applied.values()];
}

/** Takes a pick-up out of the stock; every shortage is reported at once and nothing changes. */
export async function applyPickUp(
  em: EntityManager,
  lines: NormalizedLine[],
  stock: ShelfItemView[],
): Promise<AppliedLine[]> {
  const byId = new Map(stock.map((item) => [item.id, item]));
  const unknown = lines.flatMap((line) =>
    line.itemId && !byId.has(line.itemId) ? [line.itemId] : [],
  );
  if (unknown.length > 0) throw notInContract(unknown);

  const shortages: Shortage[] = [];
  const applied = lines.map((line): AppliedLine => {
    const item = byId.get(line.itemId as string) as ShelfItemView;
    if (line.quantity > item.quantity) {
      shortages.push({
        itemId: item.id,
        name: item.name,
        requested: line.quantity,
        available: item.quantity,
      });
    }
    return { itemId: item.id, name: item.name, quantity: line.quantity };
  });
  if (shortages.length > 0) throw insufficient('PICK_UP', shortages);
  await adjustStock(
    em,
    applied.map((line) => ({ itemId: line.itemId, delta: -line.quantity })),
  );
  return applied;
}

/**
 * Undoes a receipt: a drop-off's goods leave the shelf, a pick-up's come back. A voided drop-off
 * is refused (reason VOID) when some of its goods have since been taken, so stock never goes below 0.
 */
export async function reverseReceiptStock(
  em: EntityManager,
  type: ShelfReceiptType,
  lines: AppliedLine[],
  stock: ShelfItemView[],
): Promise<void> {
  const byId = new Map(stock.map((item) => [item.id, item]));
  if (type === ShelfReceiptType.DROP_OFF) {
    const shortages = lines.flatMap((line): Shortage[] => {
      const available = byId.get(line.itemId)?.quantity ?? 0;
      return line.quantity > available
        ? [{ itemId: line.itemId, name: line.name, requested: line.quantity, available }]
        : [];
    });
    if (shortages.length > 0) throw insufficient('VOID', shortages);
  }
  const sign = type === ShelfReceiptType.DROP_OFF ? -1 : 1;
  await adjustStock(
    em,
    lines.map((line) => ({ itemId: line.itemId, delta: sign * line.quantity })),
  );
}
