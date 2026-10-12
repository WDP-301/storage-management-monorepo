import type { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import type { SelectQueryBuilder } from 'typeorm';
import type {
  AdminWarehouseListQueryDto,
  WarehouseListQueryDto,
  WarehouseSort,
} from './dto/warehouse.dto';

/**
 * catalogue: what a customer can rent — a shelf warehouse counts only through its AVAILABLE shelves.
 * admin: back-office listing — a shelf warehouse counts through any live shelf.
 */
export type ListMode = 'catalogue' | 'admin';

/** Alias `unit` is the query builder's entity (property paths); `s` is a raw subquery over shelves. */
type Alias = 'unit' | 's';

const RANGES: readonly [
  key: keyof WarehouseListQueryDto,
  property: 'areaM2' | 'volumeM3' | 'monthlyPrice',
  column: 'area_m2' | 'volume_m3' | 'monthly_price',
  operator: '>=' | '<=',
][] = [
  ['minArea', 'areaM2', 'area_m2', '>='],
  ['maxArea', 'areaM2', 'area_m2', '<='],
  ['minVolume', 'volumeM3', 'volume_m3', '>='],
  ['maxVolume', 'volumeM3', 'volume_m3', '<='],
  ['minPrice', 'monthlyPrice', 'monthly_price', '>='],
  ['maxPrice', 'monthlyPrice', 'monthly_price', '<='],
];

export interface RangeConditions {
  conditions: string[];
  params: Record<string, number>;
}

/** Area, volume and price bounds of the query, written against the unit itself or against a shelf. */
export function rangeConditions(alias: Alias, query: WarehouseListQueryDto): RangeConditions {
  const conditions: string[] = [];
  const params: Record<string, number> = {};
  for (const [key, property, column, operator] of RANGES) {
    const value = query[key];
    if (typeof value !== 'number') continue;
    conditions.push(`${alias === 'unit' ? `unit.${property}` : `s.${column}`} ${operator} :${key}`);
    params[key] = value;
  }
  return { conditions, params };
}

/** WHERE parts that select the live shelves of `unit` relevant to the mode. */
function shelfWhere(mode: ListMode, extra: string[] = []): string {
  const parts = ['s.parent_id = unit.id', 's.deleted_at IS NULL', ...extra];
  if (mode === 'catalogue') parts.push(`s.status = '${StorageUnitStatus.AVAILABLE}'`);
  return parts.join(' AND ');
}

export const shelfExists = (mode: ListMode, extra: string[] = []): string =>
  `EXISTS (SELECT 1 FROM storage_units s WHERE ${shelfWhere(mode, extra)})`;

/** Admin search also finds a building through the code or name of one of its shelves. */
export const shelfSearchExists = `EXISTS (SELECT 1 FROM storage_units s WHERE s.parent_id = unit.id AND s.deleted_at IS NULL AND (s.code ILIKE :search OR s.name ILIKE :search))`;

/**
 * Restricts the query to what lists show — never a shelf itself. Self-storage units match on their
 * own status and size/price; shelf warehouses match through their shelves, because the building
 * has no price or occupancy of its own.
 */
export function applyUnitScope(
  qb: SelectQueryBuilder<StorageUnit>,
  query: AdminWarehouseListQueryDto,
  mode: ListMode,
): void {
  const own = rangeConditions('unit', query);
  const onShelf = rangeConditions('s', query);
  const status = mode === 'admin' ? query.status : undefined;

  const selfBranch = ['unit.kind = :selfKind', ...own.conditions];
  if (status) selfBranch.push('unit.status = :status');

  const shelfClauses = [...onShelf.conditions, ...(status ? ['s.status = :status'] : [])];
  const parentBranch = ['unit.kind = :parentKind'];
  if (mode === 'catalogue' || shelfClauses.length > 0) {
    const exists = shelfExists(mode, shelfClauses);
    // The building itself can be out of service too, so an admin status filter also matches it.
    // An active building is always AVAILABLE, so "available" must come from its shelves alone.
    const matchesOwnStatus =
      status && status !== StorageUnitStatus.AVAILABLE && onShelf.conditions.length === 0;
    parentBranch.push(matchesOwnStatus ? `(unit.status = :status OR ${exists})` : exists);
  }

  qb.andWhere(`((${selfBranch.join(' AND ')}) OR (${parentBranch.join(' AND ')}))`, {
    ...own.params,
    ...(status ? { status } : {}),
    selfKind: StorageUnitKind.SELF_STORAGE,
    parentKind: StorageUnitKind.SHELF_WAREHOUSE,
  });
}

const SORTS: Record<
  WarehouseSort,
  { property: string; column: string; direction: 'ASC' | 'DESC' }
> = {
  newest: { property: 'createdAt', column: 'created_at', direction: 'DESC' },
  price_asc: { property: 'monthlyPrice', column: 'monthly_price', direction: 'ASC' },
  price_desc: { property: 'monthlyPrice', column: 'monthly_price', direction: 'DESC' },
  area_asc: { property: 'areaM2', column: 'area_m2', direction: 'ASC' },
  area_desc: { property: 'areaM2', column: 'area_m2', direction: 'DESC' },
};

/**
 * Price and area sorts use the unit's own value, or the matching shelves' range for a shelf
 * warehouse (whose own price is 0 and would otherwise top every ascending sort): the cheapest/
 * smallest shelf ascending, the dearest/largest descending. The shelf subquery honours the same
 * range filters as the listing, so a parent sorts by the shelves that made it match. A parent
 * with no matching shelf (admin list only) sorts last either way.
 */
export function applySort(
  qb: SelectQueryBuilder<StorageUnit>,
  sort: WarehouseSort,
  mode: ListMode,
  query: WarehouseListQueryDto,
): void {
  const { property, column, direction } = SORTS[sort];
  if (sort === 'newest') {
    qb.orderBy(`unit.${property}`, direction);
  } else {
    const { conditions, params } = rangeConditions('s', query);
    const edge = direction === 'ASC' ? 'MIN' : 'MAX';
    const shelfValue = `(SELECT ${edge}(s.${column}) FROM storage_units s WHERE ${shelfWhere(mode, conditions)})`;
    qb.addSelect(
      `CASE WHEN unit.kind = :parentKind THEN ${shelfValue} ELSE unit.${property} END`,
      'sort_value',
    )
      .setParameters({ ...params, parentKind: StorageUnitKind.SHELF_WAREHOUSE })
      .orderBy('sort_value', direction, 'NULLS LAST');
  }
  qb.addOrderBy('unit.id', 'ASC');
}
