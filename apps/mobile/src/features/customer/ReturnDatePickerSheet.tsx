import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { type RefObject, useCallback } from 'react';
import { Text, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { addDaysIso } from '../../../lib/settlement-format';
import { MonthCalendar } from './MonthCalendar';

/** The API accepts a return day from today (Vietnam) to this many days ahead. */
export const RETURN_MAX_DAYS_AHEAD = 365;

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  todayIso: string;
  selectedIso: string | null;
  /** Last day of the contract term; returning after it is charged per day. */
  lastDayIso: string | null;
  onSelect: (iso: string) => void;
};

/** Calendar for the move-out day. Nothing is pre-selected: the customer has to pick a day. */
export function ReturnDatePickerSheet({
  sheetRef,
  todayIso,
  selectedIso,
  lastDayIso,
  onSelect,
}: Props) {
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
  const maxIso = addDaysIso(todayIso, RETURN_MAX_DAYS_AHEAD);

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
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      snapPoints={['66%']}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text className="font-display text-title-md text-foreground">Chọn ngày trả kho</Text>
        {lastDayIso ? (
          <Text className="font-body mt-1 text-body-sm text-muted">
            Hạn HĐ: đến hết {formatIsoDate(lastDayIso)}
          </Text>
        ) : null}
        <Text className="font-body mt-1 text-caption text-muted">
          Có thể chọn đến {formatIsoDate(maxIso)}
        </Text>
        <View className="mt-5">
          <MonthCalendar
            minIso={todayIso}
            maxIso={maxIso}
            selectedIso={selectedIso}
            markedIso={lastDayIso}
            onSelect={(iso) => {
              onSelect(iso);
              sheetRef.current?.dismiss();
            }}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
