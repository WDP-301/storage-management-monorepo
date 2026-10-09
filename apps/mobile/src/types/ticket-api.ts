import type { PaginationMeta, TicketPriority, TicketStatus } from '@storage/types';

export type TicketTypeInfo = {
  id: string;
  code: string;
  name: string;
};

export type TicketFacilityInfo = {
  id: string;
  code: string;
  name: string;
};

export type TicketStorageUnitInfo = {
  id: string;
  code: string;
  name: string;
};

export type TicketUserInfo = {
  id: string;
  full_name: string;
  email: string;
};

export type TicketHistoryEntry = {
  action: string;
  from: string | null;
  to: string;
  at: string;
  /** User id of the actor — display resolves it against the session user, never shows the raw id. */
  by: string;
};

/** Client-chosen attachment shape stored in the ticket's jsonb `attachments` column. */
export type TicketAttachment = {
  fileKey: string;
  name: string;
  mimeType: string;
  size: number;
};

/** Mirrors the API's ServiceTicketRecord — snake_case field names are the wire contract. */
export type ServiceTicketRecord = {
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
  attachments: TicketAttachment[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  type: TicketTypeInfo | null;
  facility: TicketFacilityInfo | null;
  storage_unit: TicketStorageUnitInfo | null;
  customer: TicketUserInfo | null;
  assignee: TicketUserInfo | null;
};

export type ServiceTicketListResponse = {
  tickets: ServiceTicketRecord[];
  meta: PaginationMeta;
};

/**
 * A facility the customer may file against; `units` holds only actively-rented units and
 * `typeIds` the ticket types allowed there (deposit-only customers cannot file maintenance).
 */
export type TicketFacilityOption = TicketFacilityInfo & {
  units: TicketStorageUnitInfo[];
  typeIds: string[];
};

export type TicketFormOptions = {
  types: TicketTypeInfo[];
  facilities: TicketFacilityOption[];
};

export type CreateTicketInput = {
  typeId: string;
  facilityId: string;
  storageUnitId?: string;
  priority?: TicketPriority;
  subject: string;
  description: string;
  attachments?: TicketAttachment[];
};

export type ListTicketsParams = {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  typeId?: string;
};
