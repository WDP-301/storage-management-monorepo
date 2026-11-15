import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, renderCoatBackdrop } from '../../components/ui';
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
