import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';
import { registerLeaveGuard } from '../leave-guard';

/**
 * Asks before leaving while `hasUnsavedWork` (edits, photos on their way): for the tab bar through
 * the shared guard and for the Android back button. Returns the guarded `leave` for on-screen back.
 */
export function useLeaveGuard(hasUnsavedWork: boolean, leave: () => void) {
  const unsaved = useRef(hasUnsavedWork);
  useEffect(() => {
    unsaved.current = hasUnsavedWork;
  }, [hasUnsavedWork]);

  const confirmLeave = useCallback(() => {
    if (!unsaved.current) {
      leave();
      return;
    }
    Alert.alert('Bỏ thay đổi?', 'Phiếu chưa lưu hoặc ảnh đang tải lên.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: leave },
    ]);
  }, [leave]);

  useFocusEffect(useCallback(() => registerLeaveGuard(() => unsaved.current), []));
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmLeave();
        return true;
      });
      return () => sub.remove();
    }, [confirmLeave]),
  );
  return confirmLeave;
}
