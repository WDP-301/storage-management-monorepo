import type { ServiceTicket } from '@entities/service-ticket.entity';
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
  from: string | null;
  to: string;
  at: string;
  by: string;
}

/** The `service_tickets` row exposed with its raw column names plus joined display info. */
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
  type: TicketTypeInfo | null;
  facility: TicketFacilityInfo | null;
  storage_unit: TicketStorageUnitInfo | null;
  customer: TicketUserInfo | null;
  assignee: TicketUserInfo | null;
}

/** Maps a `service_tickets` row (with loaded relations) to its API representation. */
export function toServiceTicketRecord(ticket: ServiceTicket): ServiceTicketRecord {
  return {
    id: ticket.id,
    ticket_no: ticket.ticketNo,
    type_id: ticket.typeId,
    facility_id: ticket.facilityId,
    storage_unit_id: ticket.storageUnitId ?? null,
    customer_id: ticket.customerId ?? null,
    assigned_to: ticket.assignedTo ?? null,
    priority: ticket.priority,
    status: ticket.status,
    subject: ticket.subject,
    description: ticket.description,
    resolution: ticket.resolution ?? null,
    history: ticket.history ?? [],
    attachments: ticket.attachments ?? [],
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    resolved_at: ticket.resolvedAt ?? null,
    type: ticket.type
      ? { id: ticket.type.id, code: ticket.type.code, name: ticket.type.name }
      : null,
    facility: ticket.facility
      ? { id: ticket.facility.id, code: ticket.facility.code, name: ticket.facility.name }
      : null,
    storage_unit: ticket.storageUnit
      ? { id: ticket.storageUnit.id, code: ticket.storageUnit.code }
      : null,
    customer: ticket.customer
      ? {
          id: ticket.customer.id,
          full_name: ticket.customer.fullName,
          email: ticket.customer.email,
        }
      : null,
    assignee: ticket.assignee
      ? {
          id: ticket.assignee.id,
          full_name: ticket.assignee.fullName,
          email: ticket.assignee.email,
        }
      : null,
  };
}

export interface ServiceTicketResponse {
  ticket: ServiceTicketRecord;
}

export interface ServiceTicketDeleteResponse {
  deleted: boolean;
  id: string;
}

export interface ServiceTicketListResponse {
  tickets: ServiceTicketRecord[];
  meta: PaginationMeta;
}
