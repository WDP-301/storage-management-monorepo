import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { ContractRenewalView } from '@storage/types';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ContractRenewalsApi } from '../../../lib/contract-renewals-api';
import { formatIsoDate } from '../../../lib/format-vi';
import { addDaysIso, vietnamDayIso } from '../../../lib/settlement-format';
import { AlertSheet, Button, Dashed, InlineMessage, Text } from '../../components/ui';
import { StatusPill } from './contract-display';

const lastDayOf = (termEndAt: string): string | null => {
  const day = vietnamDayIso(termEndAt);
  return day ? formatIsoDate(addDaysIso(day, -1)) : null;
};

/** A pending renewal (with withdraw) or the latest rejection and its reason. */
export function RenewalStatusCard({
  renewal,
  onChanged,
}: {
  renewal: ContractRenewalView;
  onChanged: () => void;
}) {
  const confirmRef = useRef<BottomSheetModal>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = renewal.status === 'PENDING';
  const newLastDay = lastDayOf(renewal.new_term_end_at);

  const performCancel = () => {
    confirmRef.current?.dismiss();
    setIsCancelling(true);
    setError(null);
    ContractRenewalsApi.cancel(renewal.id)
      .then(onChanged)
      .catch((e: unknown) => {
        setIsCancelling(false);
        setError(e instanceof ApiError ? e.message : 'Vui lòng thử lại sau.');
      });
  };

  return (
    <View className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-lead font-bold text-text-primary">Yêu cầu gia hạn</Text>
        <StatusPill
          label={pending ? 'Chờ duyệt' : 'Bị từ chối'}
          tone={pending ? 'accent' : 'warning'}
        />
      </View>
      <Dashed />
      <Text className="text-body-sm text-text-secondary">
        Thêm {renewal.months} tháng{newLastDay ? `, đến hết ngày ${newLastDay}` : ''}
      </Text>
      {pending ? (
        <Text className="text-body-sm font-medium text-text-link">
          Chi nhánh sẽ xem xét yêu cầu và báo cho bạn.
        </Text>
      ) : renewal.decision_note ? (
        <Text className="text-body-sm text-text-primary">Lý do: {renewal.decision_note}</Text>
      ) : null}
      {error ? <InlineMessage message={error} type="error" /> : null}
      {pending ? (
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
        message="Yêu cầu gia hạn sẽ bị rút lại."
        onPrimary={performCancel}
        onSecondary={() => confirmRef.current?.dismiss()}
        primaryLabel="Huỷ yêu cầu"
        secondaryLabel="Giữ yêu cầu"
        title="Huỷ yêu cầu gia hạn?"
      />
    </View>
  );
}
