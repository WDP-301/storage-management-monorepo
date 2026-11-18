import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { type RefObject, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRefreshBookingSettings, useUnitChangeSettings } from '../../../lib/client-settings';
import { colors, renderCoatBackdrop } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import { UnitChangeRequestForm } from './UnitChangeRequestForm';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  contract: ApiContract;
  onSubmitted: () => void;
};

/**
 * Sheet for asking to change storage unit. BottomSheetModal keeps its children mounted
 * between presentations, so the form is keyed by contract plus a round bumped on every
 * dismiss — each opening starts blank and nothing leaks in from another contract.
 */
export function UnitChangeRequestSheet({ sheetRef, contract, onSubmitted }: Props) {
  const insets = useSafeAreaInsets();
  // Modal content mounts under the root BottomSheetModalProvider, outside the customer
  // providers, so the settings are read here and handed down as props.
  const unitChange = useUnitChangeSettings();
  const refreshSettings = useRefreshBookingSettings();
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
        <UnitChangeRequestForm
          key={`${contract.id}:${round}`}
          contract={contract}
          onSettingsRefresh={refreshSettings}
          onDone={() => {
            sheetRef.current?.dismiss();
            onSubmitted();
          }}
          unitChange={unitChange}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
