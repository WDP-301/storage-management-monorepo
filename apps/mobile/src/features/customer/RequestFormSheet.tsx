import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { type ReactNode, type RefObject, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Called with `done`, which closes the sheet; the form mounts with each opening. */
  children: (done: () => void) => ReactNode;
  onSubmitted: () => void;
};

/** Tall bottom sheet hosting one customer request form (pick-up or drop-off). */
export function RequestFormSheet({ sheetRef, children, onSubmitted }: Props) {
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
        {children(() => {
          sheetRef.current?.dismiss();
          onSubmitted();
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
