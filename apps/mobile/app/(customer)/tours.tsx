import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../../lib/api';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import { MyToursScreen } from '../../src/features/customer/MyToursScreen';

export default function ToursRoute() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<TourAppointmentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<TourAppointmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async (status: TourAppointmentStatus | null) => {
    setIsLoading(true);
    try {
      const res = await TourAppointmentsApi.list({
        status: status ?? undefined,
        limit: 50,
      });
      setAppointments(res.appointments);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không tải được danh sách lịch hẹn.';
      Alert.alert('Lỗi tải dữ liệu', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData(statusFilter);
    }, [loadData, statusFilter]),
  );

  const handleCancelAppointment = (apt: TourAppointmentRecord) => {
    Alert.prompt
      ? Alert.prompt(
          'Hủy lịch hẹn xem kho',
          'Vui lòng cho chúng tôi biết lý do bạn muốn hủy:',
          [
            { text: 'Quay lại', style: 'cancel' },
            {
              text: 'Xác nhận hủy',
              style: 'destructive',
              onPress: async (reason?: string) => {
                const finalReason = reason?.trim() || 'Khách hàng yêu cầu hủy lịch';
                try {
                  await TourAppointmentsApi.cancel(apt.id, finalReason);
                  Alert.alert('Đã hủy', 'Lịch hẹn của bạn đã được hủy.');
                  void loadData(statusFilter);
                } catch (err) {
                  const msg = err instanceof ApiError ? err.message : 'Không thể hủy lịch.';
                  Alert.alert('Lỗi', msg);
                }
              },
            },
          ],
          'plain-text',
          'Bận việc đột xuất',
        )
      : Alert.alert(
          'Hủy lịch hẹn xem kho',
          `Bạn có chắc chắn muốn hủy lịch hẹn xem kho ngày ${apt.preferredDate}?`,
          [
            { text: 'Quay lại', style: 'cancel' },
            {
              text: 'Xác nhận hủy',
              style: 'destructive',
              onPress: async () => {
                try {
                  await TourAppointmentsApi.cancel(apt.id, 'Khách hàng yêu cầu hủy');
                  Alert.alert('Đã hủy', 'Lịch hẹn của bạn đã được hủy.');
                  void loadData(statusFilter);
                } catch (err) {
                  const msg = err instanceof ApiError ? err.message : 'Không thể hủy lịch.';
                  Alert.alert('Lỗi', msg);
                }
              },
            },
          ],
        );
  };

  return (
    <MyToursScreen
      appointments={appointments}
      isLoading={isLoading}
      statusFilter={statusFilter}
      onFilterStatus={setStatusFilter}
      onRefresh={() => void loadData(statusFilter)}
      onCancelAppointment={handleCancelAppointment}
      onBrowse={() => router.navigate('/(customer)/browse')}
      onBack={() => router.back()}
    />
  );
}
