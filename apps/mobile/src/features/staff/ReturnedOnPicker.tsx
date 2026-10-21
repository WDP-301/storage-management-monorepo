import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Button, useThemeColor } from 'heroui-native';
import { type RefObject, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StaffDamage, StaffInspection } from '../../types/inspection-api';
import { RentalDateStrip } from '../customer/RentalDateStrip';
import { finalizeConsequence } from './inspection-display';
import { returnedOnOptions, returnedOnWarning, vietnamDayIso } from './return-dates';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  inspection: StaffInspection;
  damages: readonly StaffDamage[];
  isBusy: boolean;
  /** Called with the Vietnam day the unit actually came back. */
  onConfirm: (returnedOn: string) => void;
};

/** Confirmation for finalizing a return: asks which day the unit actually came back. */
export function ReturnedOnPicker({ sheetRef, inspection, damages, isBusy, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
  const [today, setToday] = useState(() => vietnamDayIso(new Date()));
  const [returnedOn, setReturnedOn] = useState(today);
  const options = useMemo(
    () => returnedOnOptions(inspection.createdAt, today),
    [inspection.createdAt, today],
  );
  const warning = returnedOnWarning(inspection, returnedOn);

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

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      // A sheet left open overnight must not offer a stale "today".
      onChange={(index) => {
        if (index < 0) return;
        const now = vietnamDayIso(new Date());
        setToday(now);
        setReturnedOn(now);
      }}
    >
      <BottomSheetView style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <View className="mb-4 gap-2 px-4">
          <Text className="text-title-md font-strong tracking-tight text-foreground">
            Chốt biên trả kho?
          </Text>
          <Text className="font-body text-body-sm leading-5 text-muted">
            {finalizeConsequence(inspection, damages)}
          </Text>
        </View>

        <Text className="mb-2 px-4 text-body-sm font-strong text-foreground">Ngày trả thực tế</Text>
        <RentalDateStrip options={options} selectedIso={returnedOn} onSelect={setReturnedOn} />

        <View className="mt-4 gap-3 px-4">
          {warning ? <Text className="font-body text-body-sm text-danger">{warning}</Text> : null}
          <Button isDisabled={isBusy} onPress={() => onConfirm(returnedOn)}>
            <Button.Label>{isBusy ? 'Đang chốt…' : 'Chốt biên trả'}</Button.Label>
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
