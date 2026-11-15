import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { ReactNode, RefObject } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, renderCoatBackdrop } from '../../components/ui';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Called with `done`, which closes the sheet; the form mounts with each opening. */
  children: (done: () => void) => ReactNode;
  onSubmitted: () => void;
};

/** Tall bottom sheet hosting one customer request form (pick-up or drop-off). */
export function RequestFormSheet({ sheetRef, children, onSubmitted }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{ backgroundColor: colors.semantic.bgCard }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: colors.neutral[300] }}
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
