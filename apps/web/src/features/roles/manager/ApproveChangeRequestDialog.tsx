import { Button, Dialog, Input, Text } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import React from 'react';
import { DateField } from '../../../components/DateField';
import {
  DIALOG_FORM,
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../../components/dialog-layout';
import { OfficeTimeSelect } from '../../../components/OfficeTimeSelect';
import type { UnitChangeRequestRecord } from '../../../lib/api';
import { DEFAULT_UNIT_CHANGE_WINDOW, MoveSlotsApi } from '../../../lib/move-slots-api';
import { useOfficeTimeSlots } from '../../../lib/use-office-time-slots';
import { addDays, vnDay, vnToday } from '../../../lib/vn-day';

interface Props {
  request: UnitChangeRequestRecord | null;
  busy: boolean;
  onClose: () => void;
  onApprove: (moveAt: string, decisionNote?: string) => void;
}

/**
 * Approve a unit change: confirm (or move) the day and the in-shift hour the goods go into the
 * new unit. The hours come from the OFFICE shifts, so a staffed slot is the only thing offered.
 */
export const ApproveChangeRequestDialog: React.FC<Props> = ({
  request,
  busy,
  onClose,
  onApprove,
}) => {
  const [moveDay, setMoveDay] = React.useState('');
  const [maxDaysAhead, setMaxDaysAhead] = React.useState(DEFAULT_UNIT_CHANGE_WINDOW.maxDaysAhead);
  const [note, setNote] = React.useState('');

  const today = vnToday();
  const requestId = request?.id;
  const customerMoveAt = request?.move_at ?? null;

  // Start from the customer's pick; a day already gone has to be chosen again.
  React.useEffect(() => {
    // Cleared on close, so reopening reloads the day's slots instead of showing stale ones.
    if (!requestId) {
      setMoveDay('');
      return;
    }
    const proposed = customerMoveAt ? vnDay(customerMoveAt) : '';
    setMoveDay(proposed >= vnToday() ? proposed : '');
    setNote('');
  }, [requestId, customerMoveAt]);

  React.useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    MoveSlotsApi.unitChangeWindow()
      .then((rules) => !cancelled && setMaxDaysAhead(rules.maxDaysAhead))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const slots = useOfficeTimeSlots(moveDay, customerMoveAt, 'chuyển đồ');
  const { chosen } = slots;

  return (
    <Dialog.Root open={request !== null} onOpenChange={(next) => !next && onClose()}>
      <Dialog size="lg" className={`${DIALOG_SHELL} max-w-lg w-full`}>
        <form
          className={DIALOG_FORM}
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen) return;
            onApprove(chosen, note.trim() || undefined);
          }}
        >
          <DialogHeader>
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              Duyệt yêu cầu đổi kho
            </Dialog.Title>
            <Dialog.Close
              render={(props) => (
                <button
                  type="button"
                  {...props}
                  className="p-1.5 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-control cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            />
          </DialogHeader>
          <DialogBody>
            {request ? (
              <Text variant="secondary" size="sm">
                {`Kho ${request.new_unit?.code ?? '—'} sẽ được giữ chỗ cho khách ngay khi duyệt.`}
                {Number(request.deposit_difference) > 0
                  ? ` Vì tiền cọc mới cao hơn, hệ thống xuất hoá đơn bù cọc ${Number(
                      request.deposit_difference,
                    ).toLocaleString(
                      'vi-VN',
                    )} đ và vẫn giữ kho đích đến khi khách thanh toán xong — khi đó mới huỷ hợp đồng cũ và tạo hợp đồng mới cho kho này.`
                  : ' Tiền cọc không tăng, nên ngay sau khi duyệt hệ thống huỷ hợp đồng cũ, tạo hợp đồng mới cho kho này và lên lịch bàn giao.'}
              </Text>
            ) : null}
            <DateField
              label="Ngày chuyển đồ vào kho mới"
              required
              value={moveDay}
              onChange={setMoveDay}
              min={today}
              max={addDays(today, maxDaysAhead)}
            />
            <OfficeTimeSelect label="Giờ chuyển đồ" slots={slots} hasDay={Boolean(moveDay)} />
            <Input
              label="Ghi chú (không bắt buộc)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="primary" type="submit" disabled={!chosen || busy}>
              Duyệt và giữ chỗ
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
