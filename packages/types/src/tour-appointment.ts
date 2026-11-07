import type { TourAppointmentStatus } from './domain.enums';
import type { PaginationMeta } from './index';

export const VIETNAMESE_PHONE_PATTERN = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;

export interface TourAppointmentFacilityInfo {
  id: string;
  code: string;
  name: string;
}

export interface TourAppointmentStorageUnitInfo {
  id: string;
  code: string;
  name: string;
  addressLine: string;
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

export interface CreateContactTourInput {
  facilityId: string;
  fullName: string;
  phone: string;
  email: string;
  preferredDate: string;
  preferredTimeSlot?: string;
  customerNotes?: string;
  storageUnitId?: string;
}

export interface ConfirmTourAppointmentInput {
  preferredDate?: string;
  preferredTimeSlot?: string;
  managerNotes?: string;
}

export interface AssignTourAppointmentInput {
  assignedTo: string;
}

export interface CompleteTourAppointmentInput {
  staffResultNotes: string;
}

export interface CancelTourAppointmentInput {
  cancellationReason: string;
}

export interface ListTourAppointmentsQuery {
  page?: number;
  limit?: number;
  status?: TourAppointmentStatus;
  facilityId?: string;
  assignedTo?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export type CreateContactTourDto = CreateContactTourInput;
export type TourAppointmentQueryOptions = ListTourAppointmentsQuery;
