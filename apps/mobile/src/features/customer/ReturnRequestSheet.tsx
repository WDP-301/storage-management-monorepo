import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { type RefObject, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiContract } from '../../types/contract-api';
import { ReturnRequestForm } from './ReturnRequestForm';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  contract: ApiContract;
  onSubmitted: () => void;
};

/**
 * Sheet for asking to move out, or moving the open request. The form mounts with each
 * presentation, so every opening starts from the contract as it is now.
 */
export function ReturnRequestSheet({ sheetRef, contract, onSubmitted }: Props) {
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
        <ReturnRequestForm
          contract={contract}
          onDone={() => {
            sheetRef.current?.dismiss();
            onSubmitted();
          }}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
