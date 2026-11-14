import { Select } from '@cloudflare/kumo';
import type React from 'react';
import type { OfficeTimeSlots } from '../lib/use-office-time-slots';

interface Props {
  label: string;
  slots: OfficeTimeSlots;
  /** A day must be picked before any hour is offered. */
  hasDay: boolean;
  disabled?: boolean;
}

/** Hour picker over the OFFICE-staffed slots of the chosen day (see `useOfficeTimeSlots`). */
export const OfficeTimeSelect: React.FC<Props> = ({ label, slots, hasDay, disabled }) => (
  <Select
    label={label}
    aria-label={label}
    className="w-full"
    placeholder="Chọn giờ"
    value={slots.chosen}
    onValueChange={(v) => v && slots.setPick(String(v))}
    items={slots.options}
    renderValue={(v) => slots.options.find((o) => o.value === v)?.label ?? 'Chọn giờ'}
    disabled={disabled || !hasDay || slots.state !== 'idle' || slots.options.length === 0}
    loading={slots.state === 'loading'}
    description={slots.hint}
    error={slots.error}
  />
);
