import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';
import { InspectionDetailScreen } from '../../src/features/staff/InspectionDetailScreen';
import { registerLeaveGuard } from '../../src/features/staff/leave-guard';
import { useInspectionDetail } from '../../src/features/staff/use-inspection-detail';

export default function InspectionDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useInspectionDetail(id);
  const hasUnsavedWork = detail.isDirty || detail.isUploading;

  // Tabs go back to the first route, so return to the list explicitly.
  const leave = useCallback(() => router.navigate('/(staff)/today'), [router]);
  const confirmLeave = useCallback(() => {
    if (!hasUnsavedWork) {
      leave();
      return;
    }
    Alert.alert('Bỏ thay đổi?', 'Biên bản có thay đổi chưa lưu.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: leave },
    ]);
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

  return <InspectionDetailScreen detail={detail} onBack={confirmLeave} onFinalized={leave} />;
}
