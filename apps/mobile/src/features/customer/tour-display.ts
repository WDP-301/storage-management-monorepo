import { TourAppointmentStatus } from '@storage/types';

export const TOUR_STATUS_LABEL: Record<TourAppointmentStatus, string> = {
  [TourAppointmentStatus.PENDING]: 'Chờ liên hệ',
  [TourAppointmentStatus.CONFIRMED]: 'Đã xác nhận',
  [TourAppointmentStatus.ASSIGNED]: 'Đã gán nhân viên',
  [TourAppointmentStatus.COMPLETED]: 'Đã hoàn tất',
  [TourAppointmentStatus.CANCELLED]: 'Đã hủy',
};

export const TOUR_STATUS_TONE: Record<
  TourAppointmentStatus,
  'warning' | 'accent' | 'success' | 'neutral'
> = {
  [TourAppointmentStatus.PENDING]: 'warning',
  [TourAppointmentStatus.CONFIRMED]: 'accent',
  [TourAppointmentStatus.ASSIGNED]: 'accent',
  [TourAppointmentStatus.COMPLETED]: 'success',
  [TourAppointmentStatus.CANCELLED]: 'neutral',
};

export function formatTourDate(iso: string): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}
