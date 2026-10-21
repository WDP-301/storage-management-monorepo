import { Select } from '@cloudflare/kumo';
import type React from 'react';

interface Props {
  ariaLabel: string;
  /** Shown before the chosen label, e.g. "Trạng thái". */
  prefix: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** One filter of the contract list; picking a value is what resets the page. */
export const ContractFilterSelect: React.FC<Props> = ({
  ariaLabel,
  prefix,
  value,
  options,
  onChange,
}) => (
  <div className="w-60">
    <Select
      aria-label={ariaLabel}
      value={value}
      onValueChange={(v) => {
        if (v) onChange(String(v));
      }}
      items={options}
      renderValue={(v) => `${prefix}: ${options.find((o) => o.value === v)?.label ?? v}`}
    />
  </div>
);
