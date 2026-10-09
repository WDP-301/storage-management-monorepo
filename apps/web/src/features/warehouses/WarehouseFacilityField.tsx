import { Select, Text } from '@cloudflare/kumo';
import React from 'react';
import type { FacilityRecord } from '../../lib/api';

interface Props {
  facilities: FacilityRecord[];
  value: string;
  onChange: (facilityId: string) => void;
  /** Warehouse being edited is occupied, so it cannot change facility. */
  locked: boolean;
  isEdit: boolean;
}

export const WarehouseFacilityField: React.FC<Props> = ({
  facilities,
  value,
  onChange,
  locked,
  isEdit,
}) => (
  <div className="space-y-1.5">
    <Select
      label="Cơ sở"
      placeholder="Chọn cơ sở"
      value={value || null}
      disabled={locked}
      onValueChange={(v) => onChange(String(v))}
      items={facilities
        .filter((f) => f.status === 'ACTIVE' || f.id === value)
        .map((f) => ({ value: f.id, label: `${f.name} (${f.code})` }))}
    />
    {isEdit && (
      <Text variant="secondary" size="xs">
        Chỉ chuyển cơ sở khi kho đang trống.
      </Text>
    )}
  </div>
);
