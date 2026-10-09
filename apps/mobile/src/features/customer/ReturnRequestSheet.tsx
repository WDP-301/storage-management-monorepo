import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Button, useThemeColor } from 'heroui-native';
import { type RefObject, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../lib/api';
import { ContractsApi } from '../../../lib/contracts-api';
import { buildDateOptions } from '../../../lib/rental-schedule';
import { RentalDateStrip } from './RentalDateStrip';

/** How far ahead a move-out can be booked — enough for staff to plan the visit. */
const RETURN_WINDOW_DAYS = 30;

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  contractId: string;
  warehouseName: string;
  onSubmitted: () => void;
};

export function ReturnRequestSheet({ sheetRef, contractId, warehouseName, onSubmitted }: Props) {
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
  const options = useMemo(() => buildDateOptions(RETURN_WINDOW_DAYS), []);
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const submit = async () => {
    if (!dayIso || isSubmitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await ContractsApi.requestReturn(contractId, dayIso, note.trim());
      sheetRef.current?.dismiss();
      setDayIso(null);
      setNote('');
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <View className="mb-4 px-4">
          <Text className="text-title-md font-strong tracking-tight text-foreground">
            Yêu cầu trả kho {warehouseName}
          </Text>
          <Text className="font-body mt-1 text-caption leading-5 text-muted">
            Chọn ngày bạn qua dọn đồ. Nhân viên sẽ kiểm tra kho cùng bạn và lập biên trả.
          </Text>
        </View>

        <Text className="mb-2 px-4 text-body-sm font-strong text-foreground">Ngày trả kho</Text>
        <RentalDateStrip options={options} selectedIso={dayIso ?? ''} onSelect={setDayIso} />

        <View className="mt-4 gap-2 px-4">
          <Text className="text-body-sm font-strong text-foreground">Ghi chú (không bắt buộc)</Text>
          <BottomSheetTextInput
            className="font-body min-h-20 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground"
            placeholder="VD: mình qua buổi sáng, cần xe đẩy…"
            placeholderTextColor={mutedColor}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
            textAlignVertical="top"
          />
          {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
          <Button className="mt-2" isDisabled={!dayIso || isSubmitting} onPress={submit}>
            <Button.Label>{isSubmitting ? 'Đang gửi…' : 'Gửi yêu cầu'}</Button.Label>
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
