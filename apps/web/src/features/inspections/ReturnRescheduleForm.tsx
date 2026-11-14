import { Button } from '@cloudflare/kumo';
import type React from 'react';
import { useEffect, useState } from 'react';
import { DateField } from '../../components/DateField';
import { OfficeTimeSelect } from '../../components/OfficeTimeSelect';
import { InspectionsApi } from '../../lib/api';
import { useOfficeTimeSlots } from '../../lib/use-office-time-slots';
import { addDays, vnDay, vnToday } from '../../lib/vn-day';
import type { InspectionRecord } from '../../types/inspection';
import { describeApiError } from '../contracts/settlement-display';

const MAX_DAYS_AHEAD = 365;

interface Props {
  inspection: InspectionRecord;
  disabled: boolean;
  onSaved: () => void;
}

/**
 * Moves the appointment of an open return, e.g. when the customer calls to change it. The
 * appointment is only a schedule: money counts to the day the return is finalized.
 */
export const ReturnRescheduleForm: React.FC<Props> = ({ inspection, disabled, onSaved }) => {
  const today = vnToday();
  const lastDay = addDays(today, MAX_DAYS_AHEAD);
  const currentAt = inspection.scheduledAt;
  const current = currentAt ? vnDay(currentAt) : '';
  const [day, setDay] = useState(current || today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDay(current || vnToday());
    setError(null);
  }, [current]);

  const slots = useOfficeTimeSlots(day, currentAt, 'hẹn trả');
  const outOfRange = !day || day < today || day > lastDay;

  // Re-sending the current instant would change nothing.
  const isUnchanged =
    slots.chosen !== null &&
    currentAt !== null &&
    new Date(slots.chosen).getTime() === new Date(currentAt).getTime();

  const save = async () => {
    if (outOfRange) return setError('Ngày hẹn trả phải từ hôm nay đến 365 ngày tới.');
    if (!slots.chosen) return setError('Chọn giờ hẹn trả trong ca hành chính.');
    setBusy(true);
    setError(null);
    try {
      await InspectionsApi.reschedule(inspection.id, slots.chosen);
      onSaved();
    } catch (err) {
      setError(describeApiError(err, 'Không đổi được ngày hẹn trả kho.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="sm:w-56">
          <DateField
            label="Ngày hẹn trả kho"
            min={today}
            max={lastDay}
            value={day}
            disabled={busy || disabled}
            onChange={setDay}
          />
        </div>
        <div className="sm:w-40">
          <OfficeTimeSelect
            label="Giờ hẹn trả"
            slots={slots}
            hasDay={Boolean(day)}
            disabled={busy || disabled}
          />
        </div>
        <Button
          variant="secondary"
          disabled={!slots.chosen || isUnchanged || busy || disabled}
          loading={busy}
          onClick={() => void save()}
        >
          Lưu ngày hẹn
        </Button>
      </div>
      <p className="text-xs text-kumo-subtle">
        Lịch hẹn chỉ để sắp xếp, không đổi số tiền: tiền thuê và thời hạn báo trước tính tới ngày
        chốt biên bản. Khách sẽ nhận thông báo khi lịch hẹn thay đổi.
      </p>
      {error && (
        <p role="alert" className="text-sm text-kumo-danger">
          {error}
        </p>
      )}
    </section>
  );
};
