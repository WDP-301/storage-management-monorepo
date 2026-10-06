import type { PaginationMeta, TicketPriority, TicketStatus } from '@storage/types';

export interface TicketTypeInfo {
  id: string;
  code: string;
  name: string;
}

export interface TicketFacilityInfo {
  id: string;
  code: string;
  name: string;
}

export interface TicketStorageUnitInfo {
  id: string;
  code: string;
}

export interface TicketUserInfo {
  id: string;
  full_name: string;
  email: string;
}

export interface TicketHistoryEntry {
  action: string;
  from?: string | null;
  to?: string | null;
  at: string;
  by: string;
}

export interface ServiceTicketRecord {
  id: string;
  ticket_no: string;
  type_id: string;
  facility_id: string;
  storage_unit_id: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  resolution: string | null;
  history: TicketHistoryEntry[];
  attachments: unknown[];
  created_at: string | Date;
  updated_at: string | Date;
  resolved_at: string | Date | null;
  type?: TicketTypeInfo | null;
  facility?: TicketFacilityInfo | null;
  storage_unit?: TicketStorageUnitInfo | null;
  customer?: TicketUserInfo | null;
  assignee?: TicketUserInfo | null;
}

export interface AssignTicketDto {
  assignedTo: string;
}

export interface ListTicketsQuery {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  typeId?: string;
}

export interface ServiceTicketResponse {
  ticket: ServiceTicketRecord;
}

export interface ServiceTicketListResponse {
  tickets: ServiceTicketRecord[];
  meta: PaginationMeta;
}

export interface ServiceTicketDeleteResponse {
  deleted: boolean;
  id: string;
}
