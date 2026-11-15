import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ContractsApi } from '../../../lib/contracts-api';
import { AlertSheet, Button, InlineMessage } from '../../components/ui';
import type { ApiInspection } from '../../types/contract-api';
import { returnErrorMessage } from './return-errors';

type Props = {
  contractId: string;
  inspection: ApiInspection;
  onReschedule: () => void;
  /** After a withdrawal — or a refusal, which means the screen is out of date. */
  onChanged: () => void;
};

/**
 * "Đổi lịch" and "Huỷ yêu cầu" for the open return. Withdrawing is offered only while staff have
 * recorded nothing on it; the server still decides and explains a refusal.
 */
export function ReturnRequestActions({ contractId, inspection, onReschedule, onChanged }: Props) {
  const confirmRef = useRef<BottomSheetModal>(null);
  const [isCancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCancel =
    inspection.evidence.length === 0 &&
    inspection.damages.length === 0 &&
    !inspection.conditionNotes;

  const cancel = async () => {
    confirmRef.current?.dismiss();
    setCancelling(true);
    setError(null);
    try {
      await ContractsApi.cancelReturn(contractId);
      onChanged();
    } catch (cause) {
      setError(returnErrorMessage(cause, 'Không huỷ được yêu cầu trả kho. Vui lòng thử lại.'));
      onChanged();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View className="gap-2">
      {error ? <InlineMessage message={error} type="error" /> : null}
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={isCancelling}
          label="Đổi lịch"
          onPress={onReschedule}
          size="sm"
          variant="secondary"
        />
        {canCancel ? (
          <Button
            className="flex-1"
            disabled={isCancelling}
            label={isCancelling ? 'Đang huỷ…' : 'Huỷ yêu cầu'}
            loading={isCancelling}
            onPress={() => confirmRef.current?.present()}
            size="sm"
            variant="destructive"
          />
        ) : null}
      </View>

      <AlertSheet
        ref={confirmRef}
        destructive
        message="Hợp đồng tiếp tục như cũ. Khi muốn dọn đi, bạn có thể yêu cầu trả kho lại."
        onPrimary={() => void cancel()}
        onSecondary={() => confirmRef.current?.dismiss()}
        primaryLabel="Huỷ yêu cầu"
        secondaryLabel="Không"
        title="Huỷ yêu cầu trả kho?"
      />
    </View>
  );
}
