import type { TourAppointmentRecord } from '@storage/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../../lib/api';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import { StaffTourDetailScreen } from '../../src/features/staff/StaffTourDetailScreen';

export default function StaffTourRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [appointment, setAppointment] = useState<TourAppointmentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await TourAppointmentsApi.list({ limit: 100 });
      const found = res.appointments.find((a) => a.id === id) ?? null;
      setAppointment(found);
      if (!found) {
        Alert.alert(
          'Không tìm thấy',
          'Ca dẫn khách này không tồn tại hoặc bạn không có quyền truy cập.',
        );
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không tải được thông tin ca dẫn khách.';
      Alert.alert('Lỗi', msg);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleComplete = async (notes: string) => {
    if (!id) return;
    setIsSaving(true);
    try {
      await TourAppointmentsApi.complete(id, notes);
      Alert.alert('Thành công', 'Đã lưu kết quả ca tư vấn dẫn khách.', [
        { text: 'Đóng', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể hoàn tất ca.';
      Alert.alert('Lỗi', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!id) return;
    setIsSaving(true);
    try {
      await TourAppointmentsApi.cancel(id, reason);
      Alert.alert('Đã cập nhật', 'Đã báo vắng / hủy ca dẫn khách.', [
        { text: 'Đóng', onPress: () => router.back() },
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
      isLoading={isLoading}
      isSaving={isSaving}
      onComplete={handleComplete}
      onCancel={handleCancel}
      onBack={() => router.back()}
    />
  );
}
