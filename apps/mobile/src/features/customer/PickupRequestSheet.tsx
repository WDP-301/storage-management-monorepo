import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import type { ShelfItemView } from '@storage/types';
import { useThemeColor } from 'heroui-native';
import { type RefObject, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PickupRequestForm } from './PickupRequestForm';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  contractId: string;
  items: ShelfItemView[];
  onSubmitted: () => void;
};

/** Sheet for asking staff to prepare goods ahead of a visit. The form mounts with each opening. */
export function PickupRequestSheet({ sheetRef, contractId, items, onSubmitted }: Props) {
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);

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
      keyboardBlurBehavior="restore"
      snapPoints={['92%']}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <PickupRequestForm
          contractId={contractId}
          items={items}
          onDone={() => {
            sheetRef.current?.dismiss();
            onSubmitted();
          }}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
