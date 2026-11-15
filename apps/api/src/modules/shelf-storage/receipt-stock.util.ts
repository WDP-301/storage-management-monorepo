import { HttpStatus } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { type ShelfItemUnit, type ShelfItemView, ShelfReceiptType } from '@storage/types';
import type { EntityManager } from 'typeorm';
import type { NormalizedLine } from './receipt-input.util';
import { itemNameKey } from './shelf-rules';

/** A receipt line as applied to stock: the item and its name and unit at that moment. */
export interface AppliedLine {
  itemId: string;
  name: string;
  quantity: number;
  unit: ShelfItemUnit;
}

/** A line whose unit differs from the one its item is counted in. */
export interface UnitMismatch {
  itemId: string;
  name: string;
  unit: ShelfItemUnit;
  requested: ShelfItemUnit;
}

/**
 * Unit rules shared by drop-off receipts and requests, given the item each line lands on (none =
 * a new item). A new item needs a unit; an existing one keeps its own, so a line naming another
 * unit is refused rather than silently counted as something it is not.
 */
export function assertUnits(
  lines: readonly NormalizedLine[],
  targets: readonly ({ id: string; name: string; unit: ShelfItemUnit } | undefined)[],
  mismatch: (items: UnitMismatch[]) => Error,
): void {
  const missing = lines.findIndex((line, index) => !targets[index] && !line.unit);
  if (missing !== -1) {
    throw fieldValidationError(`lines[${missing}].unit`, 'unitRequired', 'Chọn đơn vị cho món mới');
  }
  const mismatched = lines.flatMap((line, index): UnitMismatch[] => {
    const item = targets[index];
    return item && line.unit && line.unit !== item.unit
      ? [
          {
            itemId: item.id,
            name: item.name,
            unit: item.unit,
            requested: line.unit,
          },
        ]
      : [];
  });
  if (mismatched.length > 0) throw mismatch(mismatched);
}

const receiptUnitMismatch = (items: UnitMismatch[]) =>
  new DomainException(
    ErrorCode.SHELF_RECEIPT_NOT_ALLOWED,
    'Đơn vị khác với đơn vị món đang có trên kệ',
    HttpStatus.CONFLICT,
    { reason: 'UNIT_MISMATCH', items },
  );

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
  const targets = lines.map((line) =>
    line.itemId ? byId.get(line.itemId) : byKey.get(itemNameKey(line.name ?? '')),
  );
  assertUnits(lines, targets, receiptUnitMismatch);

  const applied = new Map<string, AppliedLine>();
  const topUps: { itemId: string; delta: number }[] = [];
  for (const [index, line] of lines.entries()) {
    const existing = targets[index];
    let item: { id: string; name: string; unit: ShelfItemUnit };
    if (existing) {
      item = existing;
      topUps.push({ itemId: item.id, delta: line.quantity });
    } else {
      // assertUnits already required a unit on every line that starts an item.
      const unit = line.unit as ShelfItemUnit;
      // The DB identity is lower("name"); where it is wider than itemNameKey the name already
      // exists, so the conflict is merged as a top-up instead of failing the whole receipt.
      const [created]: { id: string }[] = await em.query(
        `INSERT INTO "shelf_items" ("contract_id", "name", "quantity", "unit") VALUES ($1, $2, $3, $4)
         ON CONFLICT ("contract_id", lower("name")) DO NOTHING RETURNING "id"`,
        [contractId, line.name, line.quantity, unit],
      );
      if (created) {
        item = { id: created.id, name: line.name as string, unit };
      } else {
        const [clash]: { id: string; name: string; unit: ShelfItemUnit }[] = await em.query(
          `SELECT "id", "name", "unit" FROM "shelf_items" WHERE "contract_id" = $1 AND lower("name") = lower($2)`,
          [contractId, line.name],
        );
        if (clash.unit !== unit) {
          throw receiptUnitMismatch([
            {
              itemId: clash.id,
              name: clash.name,
              unit: clash.unit,
              requested: unit,
            },
          ]);
        }
        item = clash;
        topUps.push({ itemId: item.id, delta: line.quantity });
      }
      // A later line with the same name must top this item up, not insert a duplicate.
      const later = lines.findIndex(
        (other, at) =>
          at > index && !other.itemId && itemNameKey(other.name ?? '') === itemNameKey(item.name),
      );
      if (later !== -1)
        targets[later] = {
          ...item,
          quantity: line.quantity,
          updatedAt: new Date(),
        };
    }
    const before = applied.get(item.id);
    applied.set(item.id, {
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      quantity: (before?.quantity ?? 0) + line.quantity,
    });
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

  assertUnits(
    lines,
    lines.map((line) => byId.get(line.itemId as string)),
    receiptUnitMismatch,
  );
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
    return {
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      quantity: line.quantity,
    };
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
        ? [
            {
              itemId: line.itemId,
              name: line.name,
              requested: line.quantity,
              available,
            },
          ]
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
