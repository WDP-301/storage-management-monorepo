import type {
  CreateContactTourDto,
  TourAppointmentListResponse,
  TourAppointmentQueryOptions,
  TourAppointmentRecord,
  TourAppointmentResponse,
} from '@storage/types';
import { request } from './api';

export const TourAppointmentsApi = {
  /**
   * Khách hàng đặt lịch xem kho (hoặc khách vãng lai để lại thông tin liên hệ).
   */
  create: async (dto: CreateContactTourDto): Promise<TourAppointmentRecord> => {
    const res = await request<TourAppointmentResponse>('/tour-appointments/contact', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return res.appointment;
  },

  /**
   * Danh sách lịch hẹn (Khách hàng gọi sẽ tự động lọc theo customerId của chính mình phía server,
   * nhân viên sẽ lọc theo chi nhánh phụ trách).
   */
  list: async (options?: TourAppointmentQueryOptions): Promise<TourAppointmentListResponse> => {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.facilityId) params.set('facilityId', options.facilityId);
    if (options?.assignedTo) params.set('assignedTo', options.assignedTo);
    if (options?.fromDate) params.set('fromDate', options.fromDate);
    if (options?.toDate) params.set('toDate', options.toDate);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));

    const qs = params.toString();
    const url = qs ? `/tour-appointments?${qs}` : '/tour-appointments';
    return request<TourAppointmentListResponse>(url, {
      method: 'GET',
    });
  },

  /**
   * Chi tiết một lịch hẹn xem kho.
   */
  get: async (id: string): Promise<TourAppointmentRecord> => {
    const res = await request<TourAppointmentResponse>(
      `/tour-appointments/${encodeURIComponent(id)}`,
      {
        method: 'GET',
      },
    );
    return res.appointment;
  },

  /**
   * Khách hàng hoặc Quản lý / Nhân viên hủy lịch hẹn với lý do cụ thể.
   */
  cancel: async (id: string, cancellationReason: string): Promise<TourAppointmentRecord> => {
    const res = await request<TourAppointmentResponse>(
      `/tour-appointments/${encodeURIComponent(id)}/cancel`,
      {
        method: 'PATCH',
        body: JSON.stringify({ cancellationReason }),
      },
    );
    return res.appointment;
  },

  /**
   * Nhân viên hoàn tất ca dẫn khách với ghi chú kết quả tư vấn.
   */
  complete: async (id: string, staffResultNotes: string): Promise<TourAppointmentRecord> => {
    const res = await request<TourAppointmentResponse>(
      `/tour-appointments/${encodeURIComponent(id)}/complete`,
      {
        method: 'PATCH',
        body: JSON.stringify({ staffResultNotes }),
      },
    );
    return res.appointment;
  },
};
