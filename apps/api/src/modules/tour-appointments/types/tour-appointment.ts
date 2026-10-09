import type { PaginationMeta, TourAppointmentStatus } from '@storage/types';

export interface TourAppointmentFacilityInfo {
  id: string;
  code: string;
  name: string;
  addressLine?: string | null;
}

export interface TourAppointmentStorageUnitInfo {
  id: string;
  code: string;
}

export interface TourAppointmentUserInfo {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}

export interface TourAppointmentRecord {
  id: string;
  facilityId: string;
  customerId?: string | null;
  fullName: string;
  phone: string;
  email: string;
  storageUnitId?: string | null;
  preferredDate: string;
  preferredTimeSlot?: string | null;
  customerNotes?: string | null;
  status: TourAppointmentStatus;
  assignedTo?: string | null;
  managerNotes?: string | null;
  staffResultNotes?: string | null;
  cancellationReason?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  facility?: TourAppointmentFacilityInfo | null;
  customer?: TourAppointmentUserInfo | null;
  storageUnit?: TourAppointmentStorageUnitInfo | null;
  assignee?: TourAppointmentUserInfo | null;
}

export interface TourAppointmentResponse {
  appointment: TourAppointmentRecord;
}

export interface TourAppointmentListResponse {
  appointments: TourAppointmentRecord[];
  meta: PaginationMeta;
}
