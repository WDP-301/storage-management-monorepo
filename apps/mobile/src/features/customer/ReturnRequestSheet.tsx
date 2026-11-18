import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { type RefObject, useState } from 'react';
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
 * Sheet for asking to move out, or moving the open request. BottomSheetModal keeps its
 * children mounted between presentations, so the form is keyed by contract plus a round
 * bumped on every dismiss — each opening starts from the contract as it is now.
 */
export function ReturnRequestSheet({ sheetRef, contract, onSubmitted }: Props) {
  const insets = useSafeAreaInsets();
  const [round, setRound] = useState(0);

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
      onDismiss={() => setRound((current) => current + 1)}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <ReturnRequestForm
          key={`${contract.id}:${round}`}
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
