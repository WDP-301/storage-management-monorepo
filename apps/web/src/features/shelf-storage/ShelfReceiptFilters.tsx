import { Input, InputGroup, Select } from '@cloudflare/kumo';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { RECEIPT_TYPE_LABEL, type ReceiptFilterState } from './shelf-records-display';

const SEARCH_DEBOUNCE_MS = 300;
const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả loại phiếu' },
  { value: 'DROP_OFF', label: RECEIPT_TYPE_LABEL.DROP_OFF },
  { value: 'PICK_UP', label: RECEIPT_TYPE_LABEL.PICK_UP },
];

interface Props {
  value: ReceiptFilterState;
  onChange: (next: ReceiptFilterState) => void;
}

export const ShelfReceiptFilters: React.FC<Props> = ({ value, onChange }) => {
  const [searchText, setSearchText] = useState(value.search);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  // Typing is applied after a pause so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      const { value: current, onChange: emit } = latest.current;
      if (current.search !== searchText) emit({ ...current, search: searchText });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const set = (patch: Partial<ReceiptFilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="w-48">
          <Select
            aria-label="Lọc loại phiếu"
            value={value.type || 'ALL'}
            onValueChange={(v) =>
              v && set({ type: v === 'ALL' ? '' : (v as 'DROP_OFF' | 'PICK_UP') })
            }
            items={TYPE_OPTIONS}
            renderValue={(v) => TYPE_OPTIONS.find((o) => o.value === v)?.label ?? String(v)}
          />
        </div>
        <Input
          label="Từ ngày"
          type="date"
          max={value.to || undefined}
          value={value.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <Input
          label="Đến ngày"
          type="date"
          min={value.from || undefined}
          value={value.to}
          onChange={(e) => set({ to: e.target.value })}
        />
        <div className="w-full sm:w-72 sm:ml-auto">
          <InputGroup size="base">
            <InputGroup.Addon align="start">
              <MagnifyingGlass className="w-4 h-4 text-kumo-subtle" />
            </InputGroup.Addon>
            <InputGroup.Input
              type="text"
              placeholder="Mã phiếu, khách, hợp đồng..."
              aria-label="Tìm phiếu gửi / lấy"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="text-xs"
            />
          </InputGroup>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-1.5 text-sm text-kumo-default cursor-pointer">
          <input
            type="checkbox"
            checked={value.includeVoided}
            onChange={(e) => set({ includeVoided: e.target.checked })}
          />
          Gồm phiếu đã hủy
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm text-kumo-default cursor-pointer">
          <input
            type="checkbox"
            checked={value.disputedOnly}
            onChange={(e) => set({ disputedOnly: e.target.checked })}
          />
          Chỉ phiếu khách báo sai
        </label>
      </div>
    </div>
  );
};
