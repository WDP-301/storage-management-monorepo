import { Button } from '@cloudflare/kumo';
import type React from 'react';
import { formatVnDay, vnToday } from '../../lib/vn-day';
import type { InspectionRecord } from '../../types/inspection';
import { finalizeConsequence } from './inspection-display';

interface Props {
  inspection: InspectionRecord;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Last check before signing an inspection off. A return is recorded on the day it is finalized:
 * rent, notice and penalties count to that day, whatever the appointment says.
 */
export const InspectionFinalizeConfirm: React.FC<Props> = ({
  inspection,
  busy,
  onCancel,
  onConfirm,
}) => (
  <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
    <p className="text-kumo-default">
      {finalizeConsequence(inspection)} Biên bản không sửa được sau khi chốt.
    </p>
    {inspection.type === 'RETURN' && (
      <p role="status" className="text-kumo-default">
        Ngày trả ghi nhận là hôm nay ({formatVnDay(vnToday())}) — tiền thuê, thời hạn báo trước và
        phí quá hạn tính tới ngày này.
      </p>
    )}
    <div className="flex justify-end gap-2">
      <Button variant="secondary" disabled={busy} onClick={onCancel}>
        Huỷ
      </Button>
      <Button variant="primary" loading={busy} onClick={onConfirm}>
        Xác nhận chốt
      </Button>
    </div>
  </div>
);
