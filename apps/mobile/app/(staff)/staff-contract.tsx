import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { AlertSheet } from '../../src/components/ui';
import { registerLeaveGuard } from '../../src/features/staff/leave-guard';
import { StaffContractScreen } from '../../src/features/staff/StaffContractScreen';
import { useInspectionDetail } from '../../src/features/staff/use-inspection-detail';
import { useStaffContract } from '../../src/features/staff/use-staff-contract';

export default function StaffContractRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contract, error, isLoading, reload } = useStaffContract(id);
  // Only the records the server lets this user edit are loaded into an editable form.
  const handover = useInspectionDetail(
    contract?.permissions.handover ? contract.handover?.id : undefined,
  );
  const returnDetail = useInspectionDetail(
    contract?.permissions.return ? contract.return?.id : undefined,
  );
  const [savingDocuments, setSavingDocuments] = useState(false);
  const leaveSheetRef = useRef<BottomSheetModal>(null);
  const hasUnsavedWork =
    [handover, returnDetail].some((d) => d.isDirty || d.isUploading) || savingDocuments;

  // Tabs go back to the first route, so return to the list explicitly.
  const leave = useCallback(() => router.navigate('/(staff)/today'), [router]);
  const confirmLeave = useCallback(() => {
    if (!hasUnsavedWork) {
      leave();
      return;
    }
    leaveSheetRef.current?.present();
  }, [hasUnsavedWork, leave]);

  // The tab bar lives outside this route, so it asks through the shared guard.
  const unsavedRef = useRef(hasUnsavedWork);
  useEffect(() => {
    unsavedRef.current = hasUnsavedWork;
  }, [hasUnsavedWork]);
  useFocusEffect(useCallback(() => registerLeaveGuard(() => unsavedRef.current), []));

  // Android back button goes through the same unsaved-changes guard.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmLeave();
        return true;
      });
      return () => sub.remove();
    }, [confirmLeave]),
  );

  return (
    <>
      <StaffContractScreen
        contract={contract}
        error={error}
        handover={handover}
        isLoading={isLoading}
        onBack={confirmLeave}
        onDocumentsBusyChange={setSavingDocuments}
        onReload={() => void reload()}
        returnDetail={returnDetail}
        savingDocuments={savingDocuments}
      />
      <AlertSheet
        actionsLayout="row"
        destructive
        message="Có thay đổi chưa lưu hoặc tệp đang tải lên."
        onPrimary={leave}
        primaryLabel="Bỏ thay đổi"
        ref={leaveSheetRef}
        secondaryLabel="Ở lại"
        title="Bỏ thay đổi?"
      />
    </>
  );
}
