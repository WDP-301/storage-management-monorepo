import { Button, cn, DatePicker, inputVariants, Popover } from '@cloudflare/kumo';
import { CalendarBlank } from '@phosphor-icons/react';
import React, { useId, useState } from 'react';
import { formatVnDay, vnToday } from '../lib/vn-day';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local `Date` for a `YYYY-MM-DD` day; `undefined` for anything else. */
const parseDay = (day: string | undefined): Date | undefined => {
  const match = day ? DAY_PATTERN.exec(day) : null;
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const toDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

interface DateFieldProps {
  label?: React.ReactNode;
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Single-day field: a read-only input opening a kumo `DatePicker` popover.
 * Keeps the `YYYY-MM-DD` string contract of a native `<input type="date">`.
 */
export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  placeholder = 'Chọn ngày',
  id,
  className,
  'aria-label': ariaLabel,
}) => {
  const autoId = useId();
  const controlId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);
  const minDate = parseDay(min);
  const maxDate = parseDay(max);
  const today = parseDay(vnToday());
  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];
  const todayDisabled =
    (minDate !== undefined && today !== undefined && today < minDate) ||
    (maxDate !== undefined && today !== undefined && today > maxDate);

  const pick = (day: Date | undefined) => {
    onChange(day ? toDay(day) : '');
    setOpen(false);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-xs font-medium text-kumo-default" htmlFor={controlId}>
          {label}
          {required && <span className="text-kumo-danger"> *</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        {/* Trigger renders the wrapper — putting the input itself in `render` makes
            Base UI drop its onChange, which tests and forms rely on. Clicks on the
            read-only input bubble up and open the popover. */}
        <Popover.Trigger nativeButton={false} render={<div className="relative" />}>
          <input
            id={controlId}
            aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
            readOnly
            disabled={disabled}
            placeholder={placeholder}
            value={selected ? formatVnDay(value) : value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={cn(
              inputVariants({ focusIndicator: true }),
              'w-full pr-9 text-left cursor-pointer',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          />
          <CalendarBlank className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kumo-subtle" />
        </Popover.Trigger>
        {/* A read-only input is barred from constraint validation, so keep a hidden editable one. */}
        {required && (
          <input
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            value={value}
            required
            onChange={() => {}}
          />
        )}
        <Popover.Content align="start" className="w-auto">
          <DatePicker
            mode="single"
            selected={selected}
            onChange={pick}
            defaultMonth={selected ?? minDate}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={disabledDays.length > 0 ? disabledDays : undefined}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-kumo-line">
            <Button variant="ghost" size="sm" disabled={todayDisabled} onClick={() => pick(today)}>
              Hôm nay
            </Button>
            {value && (
              <Button variant="ghost" size="sm" onClick={() => pick(undefined)}>
                Xóa
              </Button>
            )}
          </div>
        </Popover.Content>
      </Popover>
    </div>
  );
};
