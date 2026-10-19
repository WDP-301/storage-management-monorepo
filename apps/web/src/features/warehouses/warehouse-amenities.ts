import type { Amenity, WarehouseAmenity, WarehouseAmenityInput } from '../../types/amenity';

export const MAX_AMENITY_QUANTITY = 99;
export const MAX_AMENITY_NOTE = 255;
export const MAX_WAREHOUSE_AMENITIES = 30;

export type AmenityCatalogStatus = 'loading' | 'ready' | 'failed';

/** Form row; quantity and note stay strings so half-typed input is not coerced away. */
export interface AmenityRow {
  amenityId: string;
  name: string;
  quantity: string;
  note: string;
}

export const toAmenityRows = (amenities: readonly WarehouseAmenity[] = []): AmenityRow[] =>
  amenities.map((a) => ({
    amenityId: a.amenityId,
    name: a.name,
    quantity: String(a.quantity),
    note: a.note ?? '',
  }));

export const toAmenityInputs = (rows: readonly AmenityRow[]): WarehouseAmenityInput[] =>
  rows.map((r) => ({
    amenityId: r.amenityId,
    quantity: Number(r.quantity),
    note: r.note.trim() || null,
  }));

/** Order-independent signature, so reordering rows is not mistaken for an edit. */
export const amenityKey = (rows: readonly AmenityRow[]): string =>
  toAmenityInputs(rows)
    .sort((a, b) => a.amenityId.localeCompare(b.amenityId))
    .map((r) => `${r.amenityId}:${r.quantity}:${r.note ?? ''}`)
    .join('\n');

/** Active amenities not yet on the warehouse. */
export const availableOptions = (active: readonly Amenity[], rows: readonly AmenityRow[]) => {
  const taken = new Set(rows.map((r) => r.amenityId));
  return active.filter((a) => !taken.has(a.id));
};

/** A retired amenity may stay on a warehouse but cannot be added again once removed. */
export const isInactiveRow = (row: AmenityRow, active: readonly Amenity[]) =>
  !active.some((a) => a.id === row.amenityId);

export function validateAmenityRows(rows: readonly AmenityRow[]): string | null {
  if (rows.length > MAX_WAREHOUSE_AMENITIES) {
    return `Mỗi kho tối đa ${MAX_WAREHOUSE_AMENITIES} tiện ích.`;
  }
  for (const row of rows) {
    const quantity = Number(row.quantity);
    if (
      row.quantity.trim() === '' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_AMENITY_QUANTITY
    ) {
      return `Số lượng của "${row.name}" phải là số nguyên từ 1 đến ${MAX_AMENITY_QUANTITY}.`;
    }
    if (row.note.trim().length > MAX_AMENITY_NOTE) {
      return `Ghi chú của "${row.name}" tối đa ${MAX_AMENITY_NOTE} ký tự.`;
    }
  }
  return null;
}
