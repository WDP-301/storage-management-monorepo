import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@shared/models/api-response';
import { NotificationStatus, NotificationType } from '@storage/types';
import type {
  NotificationListResponse,
  NotificationMarkAllReadResponse,
  NotificationRecord,
  NotificationResponse,
  NotificationUnreadCountResponse,
} from '../types/notification';

export class NotificationRecordDto implements NotificationRecord {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'The only user who can see this notification' })
  user_id: string;

  @ApiProperty({ enum: NotificationType, example: NotificationType.TICKET_CREATED })
  type: NotificationType;

  @ApiProperty({ example: 'New ticket #ST-20261013-1A2B3C4D' })
  title: string;

  @ApiProperty({ example: 'A customer submitted ticket "Broken lock" (priority: NORMAL).' })
  body: string;

  @ApiProperty({ type: 'object', additionalProperties: true, example: { ticketId: '…' } })
  data: Record<string, unknown>;

  @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.SENT })
  status: NotificationStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  sent_at: string | Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  read_at: string | Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: string | Date;
}

export class NotificationResponseDto implements NotificationResponse {
  @ApiProperty({ type: NotificationRecordDto })
  notification: NotificationRecordDto;
}

export class NotificationListResponseDto implements NotificationListResponse {
  @ApiProperty({ type: [NotificationRecordDto] })
  notifications: NotificationRecordDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class NotificationUnreadCountResponseDto implements NotificationUnreadCountResponse {
  @ApiProperty({ example: 3 })
  unread: number;
}

export class NotificationMarkAllReadResponseDto implements NotificationMarkAllReadResponse {
  @ApiProperty({ example: 3, description: 'How many notifications were marked as read' })
  updated: number;
}
