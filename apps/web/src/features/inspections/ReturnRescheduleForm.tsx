import { Button, Input } from '@cloudflare/kumo';
import type React from 'react';
import { useEffect, useState } from 'react';
import { InspectionsApi } from '../../lib/api';
import { addDays, vnDay, vnNoonIso, vnToday } from '../../lib/vn-day';
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
  const current = inspection.scheduledAt ? vnDay(inspection.scheduledAt) : '';
  const [day, setDay] = useState(current || today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDay(current || vnToday());
    setError(null);
  }, [current]);

  const outOfRange = !day || day < today || day > lastDay;

  const save = async () => {
    if (outOfRange) return setError('Ngày hẹn trả phải từ hôm nay đến 365 ngày tới.');
    setBusy(true);
    setError(null);
    try {
      await InspectionsApi.reschedule(inspection.id, vnNoonIso(day));
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
          <Input
            label="Ngày hẹn trả kho"
            type="date"
            min={today}
            max={lastDay}
            value={day}
            disabled={busy || disabled}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          disabled={day === current || busy || disabled}
          loading={busy}
          onClick={() => void save()}
        >
          Lưu ngày hẹn
        </Button>
      </div>
      <p className="text-xs text-kumo-subtle">
        Ngày hẹn chỉ để sắp lịch, không đổi số tiền: tiền thuê và thời hạn báo trước tính tới ngày
        chốt biên bản. Khách sẽ nhận thông báo khi ngày hẹn thay đổi.
      </p>
      {error && (
        <p role="alert" className="text-sm text-kumo-danger">
          {error}
        </p>
      )}
    </section>
  );
};
