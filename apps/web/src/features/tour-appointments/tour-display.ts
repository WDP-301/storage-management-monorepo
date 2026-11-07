import { TourAppointmentStatus } from '@storage/types';

export const TOUR_STATUS_LABELS: Record<TourAppointmentStatus, string> = {
  [TourAppointmentStatus.PENDING]: 'Chờ liên hệ',
  [TourAppointmentStatus.CONFIRMED]: 'Đã xác nhận',
  [TourAppointmentStatus.ASSIGNED]: 'Đã gán nhân viên',
  [TourAppointmentStatus.COMPLETED]: 'Đã hoàn tất',
  [TourAppointmentStatus.CANCELLED]: 'Đã hủy',
};

export const TOUR_STATUS_VARIANTS: Record<
  TourAppointmentStatus,
  'warning' | 'info' | 'purple' | 'success' | 'neutral'
> = {
  [TourAppointmentStatus.PENDING]: 'warning',
  [TourAppointmentStatus.CONFIRMED]: 'info',
  [TourAppointmentStatus.ASSIGNED]: 'purple',
  [TourAppointmentStatus.COMPLETED]: 'success',
  [TourAppointmentStatus.CANCELLED]: 'neutral',
};

export function formatTourDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatTourDateTime(val?: string | Date | null): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins} ${day}/${month}/${year}`;
}
