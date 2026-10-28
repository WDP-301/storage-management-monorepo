import { Button, Input, InputGroup, LayerCard, Select } from '@cloudflare/kumo';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import React from 'react';
import type { FacilityRecord } from '../../lib/api';
import type { Province, WarehouseStatus } from '../../types/warehouse';
import { WAREHOUSE_STATUS_LABEL } from './warehouse-display';

export const ALL = 'ALL';

export interface WarehouseFilterState {
  search: string;
  status: string;
  province: string;
  facility: string;
  minArea: string;
  maxArea: string;
  minPrice: string;
  maxPrice: string;
}

export const EMPTY_FILTERS: WarehouseFilterState = {
  search: '',
  status: ALL,
  province: ALL,
  facility: ALL,
  minArea: '',
  maxArea: '',
  minPrice: '',
  maxPrice: '',
};

const STATUS_ITEMS = [
  { value: ALL, label: 'Tất cả trạng thái' },
  ...(Object.keys(WAREHOUSE_STATUS_LABEL) as WarehouseStatus[]).map((s) => ({
    value: s,
    label: WAREHOUSE_STATUS_LABEL[s].label,
  })),
];

/** Each range sits in one grid column: a caption over "from" and "to" side by side. */
const RANGES = [
  {
    caption: 'Diện tích (m²)',
    fields: [
      ['minArea', 'Diện tích từ (m²)', 'Từ'],
      ['maxArea', 'Diện tích đến (m²)', 'Đến'],
    ],
  },
  {
    caption: 'Giá thuê (đ/tháng)',
    fields: [
      ['minPrice', 'Giá từ (đ/tháng)', 'Từ'],
      ['maxPrice', 'Giá đến (đ/tháng)', 'Đến'],
    ],
  },
] as const;

interface Props {
  filters: WarehouseFilterState;
  facilities: FacilityRecord[];
  provinces: Province[];
  hasFilters: boolean;
  onChange: (patch: Partial<WarehouseFilterState>) => void;
  onReset: () => void;
}

export const WarehouseFilters: React.FC<Props> = ({
  filters,
  facilities,
  provinces,
  hasFilters,
  onChange,
  onReset,
}) => (
  <LayerCard className="px-5 py-4 ring ring-kumo-line space-y-3">
    {/* Both rows share the same 4 columns so every control lines up. */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <InputGroup size="base">
        <InputGroup.Addon align="start">
          <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
        </InputGroup.Addon>
        <InputGroup.Input
          type="text"
          placeholder="Tìm theo mã, tên, địa chỉ..."
          aria-label="Tìm kiếm kho"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </InputGroup>
      <Select
        aria-label="Lọc theo chi nhánh"
        className="w-full"
        value={filters.facility}
        onValueChange={(v) => onChange({ facility: String(v) })}
        items={[
          { value: ALL, label: 'Tất cả chi nhánh' },
          ...facilities.map((f) => ({ value: f.id, label: `${f.name} (${f.code})` })),
        ]}
      />
      <Select
        aria-label="Lọc trạng thái kho"
        className="w-full"
        value={filters.status}
        onValueChange={(v) => onChange({ status: String(v) })}
        items={STATUS_ITEMS}
      />
      <Select
        aria-label="Lọc tỉnh thành"
        className="w-full"
        value={filters.province}
        onValueChange={(v) => onChange({ province: String(v) })}
        items={[
          { value: ALL, label: 'Tất cả tỉnh/thành' },
          ...provinces.map((p) => ({ value: p.code, label: p.name })),
        ]}
      />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
      {RANGES.map(({ caption, fields }) => (
        <div key={caption} className="space-y-1.5">
          <span className="block text-xs font-medium text-kumo-subtle">{caption}</span>
          <div className="flex items-center gap-2">
            {fields.map(([key, label, placeholder], i) => (
              <React.Fragment key={key}>
                {i === 1 && <span className="text-kumo-subtle">-</span>}
                <Input
                  aria-label={label}
                  placeholder={placeholder}
                  className="w-full min-w-0"
                  type="number"
                  min="0"
                  value={filters[key]}
                  onChange={(e) => onChange({ [key]: e.target.value })}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
      {hasFilters && (
        <div className="lg:col-start-4 flex justify-end">
          <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={onReset}>
            Xóa bộ lọc
          </Button>
        </div>
      )}
    </div>
  </LayerCard>
);
