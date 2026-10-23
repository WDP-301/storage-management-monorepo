/** Vietnamese shelf status labels and short codes, shared by the floor plan and the shelf list. */
export const shelfStatusLabel: Record<string, string> = {
  AVAILABLE: 'Còn trống',
  HELD: 'Đang giữ chỗ',
  BOOKED: 'Đã đặt',
  RENTED: 'Đang thuê',
  PENDING_INSPECTION: 'Chờ kiểm tra',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng sử dụng',
};

/** `HCM-KK-02-A-01` in warehouse `HCM-KK-02` → `A-01`. */
export const shortShelfCode = (code: string, parentCode: string) =>
  code.startsWith(`${parentCode}-`) ? code.slice(parentCode.length + 1) : code;

type ShelfLike = { id: string; status: string };

/**
 * Shelves missing from the floor plan that a customer may still pick, with the latest status from
 * the shelf list when it has one. Out-of-service (INACTIVE) shelves are hidden.
 */
export function rentableUnplacedShelves<T extends ShelfLike>(
  unplaced: readonly T[],
  latest: ReadonlyMap<string, T>,
): T[] {
  return unplaced
    .map((shelf) => latest.get(shelf.id) ?? shelf)
    .filter((shelf) => shelf.status !== 'INACTIVE');
}
