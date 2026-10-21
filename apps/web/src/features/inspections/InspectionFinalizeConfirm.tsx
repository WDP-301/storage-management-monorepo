import { Button, Input } from '@cloudflare/kumo';
import type React from 'react';
import { useState } from 'react';
import { formatVnDay, vnDay, vnToday } from '../../lib/vn-day';
import type { InspectionRecord } from '../../types/inspection';
import { finalizeConsequence } from './inspection-display';

interface Props {
  inspection: InspectionRecord;
  busy: boolean;
  onCancel: () => void;
  /** `returnedOn` is the Vietnam day the unit came back; returns only. */
  onConfirm: (returnedOn?: string) => void;
}

/**
 * Last check before signing an inspection off. A return also records the day the unit actually
 * came back: from the day it was requested up to today.
 */
export const InspectionFinalizeConfirm: React.FC<Props> = ({
  inspection,
  busy,
  onCancel,
  onConfirm,
}) => {
  const isReturn = inspection.type === 'RETURN';
  const today = vnToday();
  const earliest = vnDay(inspection.createdAt);
  const scheduled = inspection.scheduledAt ? vnDay(inspection.scheduledAt) : null;
  const [returnedOn, setReturnedOn] = useState(today);
  const invalid = isReturn && (!returnedOn || returnedOn < earliest || returnedOn > today);

  return (
    <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
      <p className="text-kumo-default">
        {finalizeConsequence(inspection)} Biên bản không sửa được sau khi chốt.
      </p>
      {isReturn && (
        <div className="space-y-1.5">
          <div className="w-56">
            <Input
              label="Ngày trả thực tế"
              type="date"
              min={earliest}
              max={today}
              value={returnedOn}
              disabled={busy}
              onChange={(e) => setReturnedOn(e.target.value)}
            />
          </div>
          {invalid ? (
            <p role="alert" className="text-kumo-danger">
              Ngày trả thực tế phải từ {formatVnDay(earliest)} đến hôm nay.
            </p>
          ) : (
            scheduled &&
            returnedOn !== scheduled && (
              <p role="status" className="text-kumo-warning">
                Khác ngày hẹn trả {formatVnDay(scheduled)} — tiền thuê và phí được tính đến ngày
                muộn hơn trong hai ngày.
              </p>
            )
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Huỷ
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={invalid}
          onClick={() => onConfirm(isReturn ? returnedOn : undefined)}
        >
          Xác nhận chốt
        </Button>
      </div>
    </div>
  );
};
