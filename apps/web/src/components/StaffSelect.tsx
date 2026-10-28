import { Select } from '@cloudflare/kumo';
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

const staffLabel = (member: FacilityStaffMember) =>
  member.phone ? `${member.fullName} · ${member.phone}` : member.fullName;

/** Picks one of a facility's staff; shared by contract, inspection and ticket assignment. */
export const StaffSelect: React.FC<Props> = ({
  ariaLabel,
  staff,
  value,
  onChange,
  placeholder,
  className,
}) => (
  <Select
    aria-label={ariaLabel}
    className={className}
    placeholder={
      placeholder ?? (staff.length > 0 ? 'Chọn nhân viên' : 'Chi nhánh chưa có nhân viên')
    }
    disabled={staff.length === 0}
    value={value || null}
    onValueChange={(v) => onChange(v ? String(v) : '')}
    items={staff.map((member) => ({ value: member.id, label: staffLabel(member) }))}
  />
);
