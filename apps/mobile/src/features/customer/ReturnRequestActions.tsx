import { Button } from 'heroui-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { ContractsApi } from '../../../lib/contracts-api';
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
  const [isCancelling, setCancelling] = useState(false);
  const canCancel =
    inspection.evidence.length === 0 &&
    inspection.damages.length === 0 &&
    !inspection.conditionNotes;

  const cancel = async () => {
    setCancelling(true);
    try {
      await ContractsApi.cancelReturn(contractId);
    } catch (error) {
      Alert.alert(
        'Không huỷ được yêu cầu',
        returnErrorMessage(error, 'Không huỷ được yêu cầu trả kho. Vui lòng thử lại.'),
      );
    } finally {
      setCancelling(false);
      onChanged();
    }
  };

  const confirmCancel = () =>
    Alert.alert(
      'Huỷ yêu cầu trả kho?',
      'Hợp đồng tiếp tục như cũ. Khi muốn dọn đi, bạn có thể yêu cầu trả kho lại.',
      [
        { text: 'Không', style: 'cancel' },
        { text: 'Huỷ yêu cầu', style: 'destructive', onPress: () => void cancel() },
      ],
    );

  return (
    <View className="flex-row gap-2">
      <Button
        className="flex-1"
        variant="secondary"
        isDisabled={isCancelling}
        onPress={onReschedule}
      >
        <Button.Label className="font-ui">Đổi lịch</Button.Label>
      </Button>
      {canCancel ? (
        <Button
          className="flex-1"
          variant="danger-soft"
          isDisabled={isCancelling}
          onPress={confirmCancel}
        >
          <Button.Label className="font-ui">
            {isCancelling ? 'Đang huỷ…' : 'Huỷ yêu cầu'}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
