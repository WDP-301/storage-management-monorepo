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

const RANGE_FIELDS = [
  ['Diện tích từ (m²)', 'minArea'],
  ['Diện tích đến (m²)', 'maxArea'],
  ['Giá từ (đ/tháng)', 'minPrice'],
  ['Giá đến (đ/tháng)', 'maxPrice'],
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
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
      <div className="w-full lg:w-72">
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
      </div>
      <div className="w-full lg:w-56">
        <Select
          aria-label="Lọc theo cơ sở"
          value={filters.facility}
          onValueChange={(v) => onChange({ facility: String(v) })}
          items={[
            { value: ALL, label: 'Tất cả cơ sở' },
            ...facilities.map((f) => ({ value: f.id, label: `${f.name} (${f.code})` })),
          ]}
        />
      </div>
      <div className="w-full lg:w-48">
        <Select
          aria-label="Lọc trạng thái kho"
          value={filters.status}
          onValueChange={(v) => onChange({ status: String(v) })}
          items={STATUS_ITEMS}
        />
      </div>
      <div className="w-full lg:w-56">
        <Select
          aria-label="Lọc tỉnh thành"
          value={filters.province}
          onValueChange={(v) => onChange({ province: String(v) })}
          items={[
            { value: ALL, label: 'Tất cả tỉnh/thành' },
            ...provinces.map((p) => ({ value: p.code, label: p.name })),
          ]}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={onReset}>
          Xóa bộ lọc
        </Button>
      )}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {RANGE_FIELDS.map(([label, key]) => (
        <Input
          key={key}
          label={label}
          type="number"
          min="0"
          value={filters[key]}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      ))}
    </div>
  </LayerCard>
);
