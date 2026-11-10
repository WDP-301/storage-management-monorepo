import { Button } from 'heroui-native';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ChangeRequestsApi, type UnitChangeRequest } from '../../../lib/change-requests-api';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { localDayIso, StatusPill, type StatusTone } from './contract-display';

type Display = { label: string; tone: StatusTone };

const STATUS_DISPLAY: Partial<Record<UnitChangeRequest['status'], Display>> = {
  REQUESTED: { label: 'Chờ duyệt', tone: 'accent' },
  PROPOSED: { label: 'Chờ duyệt', tone: 'accent' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  TRANSITIONING: { label: 'Đang chuyển', tone: 'warning' },
};

const STATUS_HINT: Partial<Record<UnitChangeRequest['status'], string>> = {
  REQUESTED: 'Quản lý kho sẽ xem xét yêu cầu của bạn.',
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
  const [isCancelling, setIsCancelling] = useState(false);
  const display = STATUS_DISPLAY[request.status] ?? { label: request.status, tone: 'neutral' };
  const hint = STATUS_HINT[request.status] ?? null;
  const moveDay = request.move_at ? formatIsoDate(localDayIso(request.move_at)) : null;
  const depositTopup = Number(request.deposit_difference ?? 0);

  const cancel = () => {
    Alert.alert('Huỷ yêu cầu đổi kho?', 'Yêu cầu của bạn sẽ bị rút lại.', [
      { text: 'Giữ yêu cầu', style: 'cancel' },
      {
        text: 'Huỷ yêu cầu',
        style: 'destructive',
        onPress: () => {
          setIsCancelling(true);
          ChangeRequestsApi.cancel(request.id)
            .then(onChanged)
            .catch((e: unknown) => {
              setIsCancelling(false);
              Alert.alert(
                'Không huỷ được',
                e instanceof ApiError ? e.message : 'Vui lòng thử lại sau.',
              );
            });
        },
      },
    ]);
  };

  return (
    <View className="gap-2 rounded-xl border border-border bg-surface p-3">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 font-strong text-foreground text-title-sm">Yêu cầu đổi kho</Text>
        <StatusPill label={display.label} tone={display.tone} />
      </View>
      {request.new_unit ? (
        <Text className="font-body text-body-sm text-muted">Kho mới: {request.new_unit.code}</Text>
      ) : null}
      {moveDay ? (
        <Text className="font-numeric text-body-sm text-foreground">Ngày chuyển: {moveDay}</Text>
      ) : null}
      {depositTopup > 0 ? (
        <Text className="font-body text-caption text-warning">
          Cần bù cọc thêm {formatMoney(depositTopup)} — hoá đơn sẽ xuất hiện trong mục Hoá đơn sau
          khi được duyệt.
        </Text>
      ) : null}
      {hint ? <Text className="font-ui text-body-sm text-accent">{hint}</Text> : null}
      {request.status === 'REQUESTED' ? (
        <Button
          variant="secondary"
          isDisabled={isCancelling}
          onPress={cancel}
          className="self-start"
        >
          <Button.Label className="font-ui">
            {isCancelling ? 'Đang huỷ…' : 'Huỷ yêu cầu'}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
