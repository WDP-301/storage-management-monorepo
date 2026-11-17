import type { TourAppointmentRecord } from '@storage/types';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { ApiError } from '../../lib/api';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import { StaffTourDetailScreen } from '../../src/features/staff/StaffTourDetailScreen';

export default function StaffTourRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [appointment, setAppointment] = useState<TourAppointmentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => router.navigate('/(staff)/today'), [router]);

  useEffect(() => {
    setAppointment(null);
    setError(null);
  }, [id]);

  const loadData = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await TourAppointmentsApi.get(id);
      setAppointment(loaded);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không tải được thông tin ca dẫn khách.';
      setError(msg);
      setAppointment(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  if (!id) return <Redirect href="/(staff)/today" />;

  const handleComplete = async (notes: string) => {
    setIsSaving(true);
    try {
      await TourAppointmentsApi.complete(id, notes);
      Alert.alert('Thành công', 'Đã lưu kết quả ca tư vấn dẫn khách.', [
        { text: 'Đóng', onPress: leave },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể hoàn tất ca.';
      Alert.alert('Lỗi', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (reason: string) => {
    setIsSaving(true);
    try {
      await TourAppointmentsApi.cancel(id, reason);
      Alert.alert('Đã cập nhật', 'Đã báo vắng / hủy ca dẫn khách.', [
        { text: 'Đóng', onPress: leave },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể cập nhật ca.';
      Alert.alert('Lỗi', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StaffTourDetailScreen
      appointment={appointment}
      error={error}
      isLoading={isLoading}
      isSaving={isSaving}
      onComplete={handleComplete}
      onCancel={handleCancel}
      onRetry={() => void loadData()}
      onBack={leave}
    />
  );
}
