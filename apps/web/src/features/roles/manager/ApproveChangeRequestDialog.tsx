import { Button, Dialog, Input, Select, Text } from '@cloudflare/kumo';
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
import type { UnitChangeRequestRecord } from '../../../lib/api';
import {
  DEFAULT_UNIT_CHANGE_WINDOW,
  MoveSlotsApi,
  type MoveWindow,
  moveTimeOptions,
  pickMoveTime,
} from '../../../lib/move-slots-api';
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
  const [moveTime, setMoveTime] = React.useState<string | null>(null);
  const [windows, setWindows] = React.useState<MoveWindow[]>([]);
  const [slotsState, setSlotsState] = React.useState<'idle' | 'loading' | 'error'>('idle');
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

  React.useEffect(() => {
    setWindows([]);
    setMoveTime(null);
    setSlotsState('idle');
    if (!moveDay) return;
    let cancelled = false;
    setSlotsState('loading');
    MoveSlotsApi.windows(moveDay)
      .then((next) => {
        if (cancelled) return;
        setWindows(next);
        setMoveTime(pickMoveTime(moveTimeOptions(next), customerMoveAt));
        setSlotsState('idle');
      })
      .catch(() => !cancelled && setSlotsState('error'));
    return () => {
      cancelled = true;
    };
  }, [moveDay, customerMoveAt]);

  const options = React.useMemo(() => moveTimeOptions(windows), [windows]);
  // A pick only counts while it is one of the shown day's slots.
  const chosen = options.some((o) => o.value === moveTime) ? moveTime : null;

  const slotError =
    slotsState === 'error'
      ? 'Không tải được khung giờ — đóng và mở lại hộp thoại để thử lại.'
      : moveDay && slotsState === 'idle' && options.length === 0
        ? 'Ngày này không còn khung giờ hành chính. Vui lòng chọn ngày khác.'
        : undefined;
  const slotHint = !moveDay
    ? 'Chọn ngày chuyển đồ trước.'
    : slotsState === 'loading'
      ? 'Đang tải khung giờ hành chính…'
      : slotError
        ? undefined
        : 'Chỉ hiển thị giờ trong ca hành chính còn lại của ngày.';

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
            <Select
              label="Giờ chuyển đồ"
              aria-label="Giờ chuyển đồ"
              className="w-full"
              placeholder="Chọn giờ"
              value={chosen}
              onValueChange={(v) => v && setMoveTime(String(v))}
              items={options}
              renderValue={(v) => options.find((o) => o.value === v)?.label ?? 'Chọn giờ'}
              disabled={!moveDay || slotsState !== 'idle' || options.length === 0}
              loading={slotsState === 'loading'}
              description={slotHint}
              error={slotError}
            />
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
