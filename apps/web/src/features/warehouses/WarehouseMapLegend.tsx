import type { Warehouse } from '../../types/warehouse';
import { countByMapStatus, MAP_STATUS_GROUPS, type MapStatusGroup } from './warehouse-map-status';

export function WarehouseMapLegend({ warehouses }: { warehouses: readonly Warehouse[] }) {
  const counts = countByMapStatus(warehouses);
  return (
    <ul
      aria-label="Chú thích màu trạng thái kho"
      className="absolute left-3 top-3 space-y-1 rounded-md bg-kumo-base px-3 py-2 text-sm shadow-sm ring ring-kumo-line"
    >
      {(Object.keys(MAP_STATUS_GROUPS) as MapStatusGroup[]).map((group) => (
        <li key={group} className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: MAP_STATUS_GROUPS[group].color }}
          />
          <span className="text-kumo-default">{MAP_STATUS_GROUPS[group].label}</span>
          <span className="ml-auto pl-3 tabular-nums text-kumo-subtle">{counts[group]}</span>
        </li>
      ))}
    </ul>
  );
}
