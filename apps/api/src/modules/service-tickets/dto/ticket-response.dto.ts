import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@shared/models/api-response';
import { TicketPriority, TicketStatus } from '@storage/types';
import type {
  ServiceTicketDeleteResponse,
  ServiceTicketListResponse,
  ServiceTicketRecord,
  ServiceTicketResponse,
  TicketFacilityInfo,
  TicketHistoryEntry,
  TicketStorageUnitInfo,
  TicketTypeInfo,
  TicketUserInfo,
} from '../types/service-ticket';

export class TicketTypeInfoDto implements TicketTypeInfo {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'MAINTENANCE' })
  code: string;

  @ApiProperty({ example: 'Bảo trì' })
  name: string;
}

export class TicketFacilityInfoDto implements TicketFacilityInfo {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'TD-01' })
  code: string;

  @ApiProperty({ example: 'Thủ Đức 01' })
  name: string;
}

export class TicketStorageUnitInfoDto implements TicketStorageUnitInfo {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'A-108' })
  code: string;

  @ApiProperty({ example: 'Kho Thủ Đức 40m²' })
  name: string;
}

export class TicketUserInfoDto implements TicketUserInfo {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  full_name: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;
}

export class TicketHistoryEntryDto implements TicketHistoryEntry {
  @ApiProperty({ example: 'status_change' })
  action: string;

  @ApiProperty({ nullable: true, example: 'OPEN' })
  from: string | null;

  @ApiProperty({ example: 'ASSIGNED' })
  to: string;

  @ApiProperty({ format: 'date-time' })
  at: string;

  @ApiProperty({ format: 'uuid' })
  by: string;
}

export class ServiceTicketRecordDto implements ServiceTicketRecord {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'TK-2026-0001' })
  ticket_no: string;

  @ApiProperty({ format: 'uuid' })
  type_id: string;

  @ApiProperty({ format: 'uuid' })
  facility_id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  storage_unit_id: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  customer_id: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  assigned_to: string | null;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.NORMAL })
  priority: TicketPriority;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.OPEN })
  status: TicketStatus;

  @ApiProperty({ example: 'Kho bị hỏng cửa cuốn' })
  subject: string;

  @ApiProperty({ example: 'Cửa cuốn kho A-108 không lên được' })
  description: string;

  @ApiProperty({ nullable: true })
  resolution: string | null;

  @ApiProperty({ type: [TicketHistoryEntryDto] })
  history: TicketHistoryEntryDto[];

  @ApiProperty({ type: [Object] })
  attachments: unknown[];

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolved_at: string | Date | null;

  @ApiProperty({ type: TicketTypeInfoDto, nullable: true })
  type: TicketTypeInfoDto | null;

  @ApiProperty({ type: TicketFacilityInfoDto, nullable: true })
  facility: TicketFacilityInfoDto | null;

  @ApiProperty({ type: TicketStorageUnitInfoDto, nullable: true })
  storage_unit: TicketStorageUnitInfoDto | null;

  @ApiProperty({ type: TicketUserInfoDto, nullable: true })
  customer: TicketUserInfoDto | null;

  @ApiProperty({ type: TicketUserInfoDto, nullable: true })
  assignee: TicketUserInfoDto | null;
}

export class ServiceTicketResponseDto implements ServiceTicketResponse {
  @ApiProperty({ type: ServiceTicketRecordDto })
  ticket: ServiceTicketRecordDto;
}

export class ServiceTicketListResponseDto implements ServiceTicketListResponse {
  @ApiProperty({ type: [ServiceTicketRecordDto] })
  tickets: ServiceTicketRecordDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class ServiceTicketDeleteResponseDto implements ServiceTicketDeleteResponse {
  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({ format: 'uuid' })
  id: string;
}
