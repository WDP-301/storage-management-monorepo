import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ChangeRequestsApi, type UnitChangeRequest } from '../../../lib/change-requests-api';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { formatVnTime } from '../../../lib/receiving-time';
import { AlertSheet, Button, Dashed, InlineMessage, Text } from '../../components/ui';
import { localDayIso, StatusPill, type StatusTone } from './contract-display';

type Display = { label: string; tone: StatusTone };

const STATUS_DISPLAY: Partial<Record<UnitChangeRequest['status'], Display>> = {
  REQUESTED: { label: 'Chờ duyệt', tone: 'accent' },
  AWAITING_PAYMENT: { label: 'Đã duyệt lần 1', tone: 'success' },
  AWAITING_HANDOVER: { label: 'Đã duyệt lần 1', tone: 'success' },
  AWAITING_FINAL_APPROVAL: { label: 'Đã bàn giao · chờ chốt', tone: 'accent' },
  PROPOSED: { label: 'Chờ duyệt', tone: 'accent' },
  APPROVED: { label: 'Đã duyệt lần 1', tone: 'success' },
  TRANSITIONING: { label: 'Đang chuyển', tone: 'warning' },
};

const STATUS_HINT: Partial<Record<UnitChangeRequest['status'], string>> = {
  REQUESTED: 'Quản lý kho sẽ xem xét yêu cầu của bạn.',
  AWAITING_PAYMENT: 'Đã duyệt lần 1 thành công. Thanh toán khoản bù cọc để tiếp tục chuyển kho.',
  AWAITING_HANDOVER:
    'Đã duyệt. Kho mới đã được giữ chỗ; nhân viên sẽ bàn giao cho bạn vào ngày hẹn.',
  AWAITING_FINAL_APPROVAL: 'Đã bàn giao xong. Chi nhánh sẽ chốt hoàn tất yêu cầu đổi kho.',
  APPROVED: 'Kho mới đã được giữ chỗ. Nhân viên sẽ hỗ trợ bạn chuyển đồ vào ngày hẹn.',
  TRANSITIONING: 'Đang trong ngày chuyển đồ. Nhân viên sẽ xác nhận khi bàn giao xong.',
};

/** The open unit-change request on a contract: status, destination, move day, cancel. */
export function UnitChangeStatusCard({
  request,
  onChanged,
}: {
  request: UnitChangeRequest;
  onChanged: () => void;
}) {
  const confirmRef = useRef<BottomSheetModal>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const display = STATUS_DISPLAY[request.status] ?? { label: request.status, tone: 'neutral' };
  const hint = STATUS_HINT[request.status] ?? null;
  const moveDay = request.move_at ? formatIsoDate(localDayIso(request.move_at)) : null;
  const moveTime = request.move_at ? formatVnTime(request.move_at) : null;
  const depositTopup = Number(request.deposit_difference ?? 0);
  const canCancel = request.status === 'REQUESTED' || request.status === 'AWAITING_PAYMENT';

  const performCancel = () => {
    confirmRef.current?.dismiss();
    setIsCancelling(true);
    setError(null);
    ChangeRequestsApi.cancel(request.id)
      .then(onChanged)
      .catch((e: unknown) => {
        setIsCancelling(false);
        setError(e instanceof ApiError ? e.message : 'Vui lòng thử lại sau.');
      });
  };

  return (
    <View className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-lead font-bold text-text-primary">Yêu cầu đổi kho</Text>
        <StatusPill label={display.label} tone={display.tone} />
      </View>
      <Dashed />
      {request.new_unit ? (
        <Text className="text-body-sm text-text-secondary">Kho mới: {request.new_unit.code}</Text>
      ) : null}
      {moveDay ? (
        <Text className="text-body-sm font-medium text-text-primary tabular-nums">
          Ngày chuyển: {moveDay}
          {moveTime ? ` · ${moveTime}` : ''}
        </Text>
      ) : null}
      {request.status === 'AWAITING_PAYMENT' && depositTopup > 0 ? (
        <InlineMessage
          message={`Cần thanh toán bù cọc ${formatMoney(depositTopup)} — hoá đơn có mã QR ở mục Hoá đơn bên dưới.`}
          type="warning"
        />
      ) : null}
      {hint ? <Text className="text-body-sm font-medium text-text-link">{hint}</Text> : null}
      {error ? <InlineMessage message={error} type="error" /> : null}
      {canCancel ? (
        <Button
          className="self-start"
          disabled={isCancelling}
          label={isCancelling ? 'Đang huỷ…' : 'Huỷ yêu cầu'}
          loading={isCancelling}
          onPress={() => confirmRef.current?.present()}
          size="sm"
          variant="destructive"
        />
      ) : null}

      <AlertSheet
        ref={confirmRef}
        destructive
        message="Yêu cầu của bạn sẽ bị rút lại."
        onPrimary={performCancel}
        onSecondary={() => confirmRef.current?.dismiss()}
        primaryLabel="Huỷ yêu cầu"
        secondaryLabel="Giữ yêu cầu"
        title="Huỷ yêu cầu đổi kho?"
      />
    </View>
  );
}
