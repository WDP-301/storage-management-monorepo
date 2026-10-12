import { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';
import type { WarehouseListQueryDto } from './dto/warehouse.dto';
import { rangeConditions } from './shelf-scope.query';
import type { ShelfSummary } from './warehouse.view';

interface SummaryRow {
  parentId: string;
  status: StorageUnitStatus;
  count: string;
  minPrice: string | null;
  minArea: string | null;
  maxArea: string | null;
  minVolume: string | null;
  maxVolume: string | null;
}

const toNumberOrNull = (value: string | null): number | null =>
  value === null ? null : Number(value);

const emptySummary = (): ShelfSummary => ({
  total: 0,
  available: 0,
  minMonthlyPrice: null,
  statusCounts: {},
  minAreaM2: null,
  maxAreaM2: null,
  minVolumeM3: null,
  maxVolumeM3: null,
});

/**
 * Rolls the live shelves of several shelf warehouses up in one grouped query. Price, area and
 * volume extremes cover AVAILABLE shelves that also satisfy `filter`, so a listing filtered by
 * price shows "from" the cheapest shelf that matched. Every id gets a summary, empty if it has no shelves.
 */
export async function loadShelfSummaries(
  manager: EntityManager,
  parentIds: string[],
  filter: WarehouseListQueryDto = {},
): Promise<Map<string, ShelfSummary>> {
  const summaries = new Map(parentIds.map((id) => [id, emptySummary()]));
  if (parentIds.length === 0) return summaries;

  const { conditions, params } = rangeConditions('s', filter);
  const matching = conditions.length > 0 ? conditions.join(' AND ') : 'TRUE';
  const rows = await manager
    .createQueryBuilder(StorageUnit, 's')
    .select('s.parentId', 'parentId')
    .addSelect('s.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .addSelect(`MIN(s.monthly_price) FILTER (WHERE ${matching})`, 'minPrice')
    .addSelect(`MIN(s.area_m2) FILTER (WHERE ${matching})`, 'minArea')
    .addSelect(`MAX(s.area_m2) FILTER (WHERE ${matching})`, 'maxArea')
    .addSelect(`MIN(s.volume_m3) FILTER (WHERE ${matching})`, 'minVolume')
    .addSelect(`MAX(s.volume_m3) FILTER (WHERE ${matching})`, 'maxVolume')
    .where('s.parentId IN (:...parentIds)', { parentIds })
    .setParameters(params)
    .groupBy('s.parentId')
    .addGroupBy('s.status')
    .getRawMany<SummaryRow>();

  for (const row of rows) {
    const summary = summaries.get(row.parentId);
    if (!summary) continue;
    const count = Number(row.count);
    summary.total += count;
    summary.statusCounts[row.status] = count;
    if (row.status === StorageUnitStatus.AVAILABLE) {
      summary.available = count;
      summary.minMonthlyPrice = toNumberOrNull(row.minPrice);
      summary.minAreaM2 = toNumberOrNull(row.minArea);
      summary.maxAreaM2 = toNumberOrNull(row.maxArea);
      summary.minVolumeM3 = toNumberOrNull(row.minVolume);
      summary.maxVolumeM3 = toNumberOrNull(row.maxVolume);
    }
  }
  return summaries;
}
