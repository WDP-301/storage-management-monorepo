import { Badge, Button, Input, Select } from '@cloudflare/kumo';
import { Trash } from '@phosphor-icons/react';
import React from 'react';
import type { Amenity } from '../../types/amenity';
import {
  type AmenityCatalogStatus,
  type AmenityRow,
  availableOptions,
  isInactiveRow,
  MAX_AMENITY_NOTE,
  MAX_WAREHOUSE_AMENITIES,
} from './warehouse-amenities';

interface Props {
  rows: AmenityRow[];
  /** Active catalog entries offered for adding. */
  catalog: Amenity[];
  /**
   * Retired badges and the add picker need the loaded catalog: while it loads every row would look
   * retired, and when it fails existing rows stay editable but nothing can be added.
   */
  catalogStatus: AmenityCatalogStatus;
  onChange: (rows: AmenityRow[]) => void;
}

/** Equipment that comes with the warehouse; included in the rent, so no price is captured. */
export const WarehouseAmenitiesField: React.FC<Props> = ({
  rows,
  catalog,
  catalogStatus,
  onChange,
}) => {
  const catalogFailed = catalogStatus === 'failed';
  const catalogReady = catalogStatus === 'ready';
  const options = availableOptions(catalog, rows);
  const full = rows.length >= MAX_WAREHOUSE_AMENITIES;

  const update = (amenityId: string, patch: Partial<AmenityRow>) =>
    onChange(rows.map((r) => (r.amenityId === amenityId ? { ...r, ...patch } : r)));

  const add = (amenityId: string) => {
    const picked = options.find((a) => a.id === amenityId);
    if (picked) onChange([...rows, { amenityId, name: picked.name, quantity: '1', note: '' }]);
  };

  return (
    <section className="space-y-2">
      <span className="text-xs font-semibold text-kumo-default block">
        Tiện ích có sẵn ({rows.length}/{MAX_WAREHOUSE_AMENITIES})
      </span>
      {catalogFailed && (
        <p role="alert" className="text-xs text-kumo-warning">
          Không tải được danh sách tiện ích để thêm mới. Các tiện ích hiện có vẫn chỉnh sửa được.
        </p>
      )}
      {rows.length === 0 && <p className="text-sm text-kumo-subtle">Chưa khai báo tiện ích.</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.amenityId}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_90px_minmax(0,1.5fr)_auto] gap-2 items-end p-2.5 rounded-lg ring ring-kumo-line"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-kumo-default min-h-9">
              <span>{row.name}</span>
              {catalogReady && isInactiveRow(row, catalog) && (
                <Badge variant="neutral">Ngừng dùng</Badge>
              )}
            </div>
            <Input
              label="Số lượng"
              aria-label={`Số lượng ${row.name}`}
              className="w-full"
              type="number"
              min="1"
              max="99"
              step="1"
              value={row.quantity}
              onChange={(e) => update(row.amenityId, { quantity: e.target.value })}
            />
            <Input
              label="Ghi chú (khách xem được)"
              aria-label={`Ghi chú ${row.name}`}
              className="w-full"
              value={row.note}
              maxLength={MAX_AMENITY_NOTE}
              onChange={(e) => update(row.amenityId, { note: e.target.value })}
            />
            <Button
              variant="secondary"
              aria-label={`Xoá tiện ích ${row.name}`}
              icon={<Trash className="w-4 h-4" />}
              onClick={() => onChange(rows.filter((r) => r.amenityId !== row.amenityId))}
            >
              Xoá
            </Button>
          </li>
        ))}
      </ul>
      {!catalogFailed && (
        <Select
          label="Thêm tiện ích"
          placeholder={
            full
              ? 'Đã đạt số tiện ích tối đa'
              : !catalogReady
                ? 'Đang tải danh sách tiện ích…'
                : options.length === 0
                  ? 'Không còn tiện ích để thêm'
                  : 'Chọn tiện ích'
          }
          value={null}
          disabled={full || !catalogReady || options.length === 0}
          onValueChange={(v) => add(String(v))}
          items={options.map((a) => ({ value: a.id, label: a.name }))}
        />
      )}
    </section>
  );
};
