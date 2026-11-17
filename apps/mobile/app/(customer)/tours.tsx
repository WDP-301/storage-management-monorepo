import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ApiError } from '../../lib/api';
import { TourAppointmentsApi } from '../../lib/tour-appointments-api';
import { MyToursScreen } from '../../src/features/customer/MyToursScreen';

export default function ToursRoute() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<TourAppointmentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<TourAppointmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (status: TourAppointmentStatus | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await TourAppointmentsApi.list({
        status: status ?? undefined,
        limit: 50,
      });
      setAppointments(res.appointments);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách lịch hẹn.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData(statusFilter);
    }, [loadData, statusFilter]),
  );

  const handleCancelAppointment = async (apt: TourAppointmentRecord) => {
    setError(null);
    try {
      await TourAppointmentsApi.cancel(apt.id, 'Khách hàng yêu cầu hủy');
      void loadData(statusFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể hủy lịch hẹn.');
    }
  };

  return (
    <MyToursScreen
      appointments={appointments}
      error={error}
      isLoading={isLoading}
      statusFilter={statusFilter}
      onFilterStatus={setStatusFilter}
      onRefresh={() => void loadData(statusFilter)}
      onCancelAppointment={(apt) => void handleCancelAppointment(apt)}
      onBrowse={() => router.navigate('/(customer)/browse')}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.navigate('/(customer)/settings');
      }}
    />
  );
}
