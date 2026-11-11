import { Combobox } from '@cloudflare/kumo';
import type React from 'react';
import type { FacilityStaffMember } from '../types/inspection';

interface Props {
  ariaLabel: string;
  staff: FacilityStaffMember[];
  /** Empty string while nothing is picked, matching the callers' form state. */
  value: string;
  onChange: (staffId: string) => void;
  placeholder?: string;
  className?: string;
}

type StaffOption = { value: string; label: string; phone: string | null };

/**
 * Picks one of a facility's staff; shared by contract, inspection and ticket assignment.
 * Searchable by name or phone so long staff lists stay quick to pick from.
 */
export const StaffSelect: React.FC<Props> = ({
  ariaLabel,
  staff,
  value,
  onChange,
  placeholder,
  className,
}) => {
  const { contains: matches } = Combobox.useFilter({ locale: 'vi' });
  const options: StaffOption[] = staff.map((member) => ({
    value: member.id,
    label: member.fullName,
    phone: member.phone,
  }));
  const selected = options.find((opt) => opt.value === value) ?? null;

  return (
    // Root takes no className; the wrapper carries the caller's sizing (e.g. flex-1).
    <div className={className}>
      <Combobox
        items={options}
        value={selected}
        disabled={staff.length === 0}
        autoHighlight
        itemToStringLabel={(opt: StaffOption) => opt.label}
        filter={(opt: StaffOption, query: string) =>
          matches(opt.label, query) || (opt.phone ? matches(opt.phone, query) : false)
        }
        onValueChange={(opt: StaffOption | null) => onChange(opt?.value ?? '')}
      >
        <Combobox.TriggerInput
          aria-label={ariaLabel}
          placeholder={
            placeholder ??
            (staff.length > 0 ? 'Tìm theo tên hoặc số điện thoại…' : 'Chi nhánh chưa có nhân viên')
          }
          clearLabel="Xóa lựa chọn"
          showOptionsLabel="Xem danh sách nhân viên"
        />
        <Combobox.Content>
          <Combobox.Empty>Không tìm thấy nhân viên.</Combobox.Empty>
          <Combobox.List>
            {(opt: StaffOption) => (
              <Combobox.Item key={opt.value} value={opt}>
                <span className="min-w-0">
                  <span className="block truncate">{opt.label}</span>
                  {opt.phone && (
                    <span className="block truncate text-xs text-kumo-secondary">{opt.phone}</span>
                  )}
                </span>
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
  );
};
