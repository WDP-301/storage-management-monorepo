import type {
  AssignTourAppointmentInput,
  CancelTourAppointmentInput,
  CompleteTourAppointmentInput,
  ConfirmTourAppointmentInput,
  CreateContactTourInput,
  ListTourAppointmentsQuery,
  TourAppointmentListResponse,
  TourAppointmentResponse,
} from '@storage/types';
import { apiClient } from './api';

export const TourAppointmentsApi = {
  list: async (params?: ListTourAppointmentsQuery): Promise<TourAppointmentListResponse> => {
    const res = await apiClient.get<{ success: boolean; data: TourAppointmentListResponse }>(
      '/tour-appointments',
      { params },
    );
    return res.data.data;
  },

  get: async (id: string): Promise<TourAppointmentResponse> => {
    const res = await apiClient.get<{ success: boolean; data: TourAppointmentResponse }>(
      `/tour-appointments/${id}`,
    );
    return res.data.data;
  },

  createContact: async (dto: CreateContactTourInput): Promise<TourAppointmentResponse> => {
    const res = await apiClient.post<{ success: boolean; data: TourAppointmentResponse }>(
      '/tour-appointments/contact',
      dto,
    );
    return res.data.data;
  },

  confirm: async (
    id: string,
    dto: ConfirmTourAppointmentInput,
  ): Promise<TourAppointmentResponse> => {
    const res = await apiClient.patch<{ success: boolean; data: TourAppointmentResponse }>(
      `/tour-appointments/${id}/confirm`,
      dto,
    );
    return res.data.data;
  },

  assign: async (id: string, dto: AssignTourAppointmentInput): Promise<TourAppointmentResponse> => {
    const res = await apiClient.patch<{ success: boolean; data: TourAppointmentResponse }>(
      `/tour-appointments/${id}/assign`,
      dto,
    );
    return res.data.data;
  },

  complete: async (
    id: string,
    dto: CompleteTourAppointmentInput,
  ): Promise<TourAppointmentResponse> => {
    const res = await apiClient.patch<{ success: boolean; data: TourAppointmentResponse }>(
      `/tour-appointments/${id}/complete`,
      dto,
    );
    return res.data.data;
  },

  cancel: async (id: string, dto: CancelTourAppointmentInput): Promise<TourAppointmentResponse> => {
    const res = await apiClient.patch<{ success: boolean; data: TourAppointmentResponse }>(
      `/tour-appointments/${id}/cancel`,
      dto,
    );
    return res.data.data;
  },
};
