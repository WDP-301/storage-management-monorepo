import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationIdParamDto } from './dto/notification-params.dto';
import {
  NotificationListResponseDto,
  NotificationMarkAllReadResponseDto,
  NotificationResponseDto,
  NotificationUnreadCountResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';
import type {
  NotificationListResponse,
  NotificationMarkAllReadResponse,
  NotificationResponse,
  NotificationUnreadCountResponse,
} from './types/notification';

/**
 * The session user's own inbox. Deliberately no @Roles: every role uses the same routes and
 * every route is scoped to `user.id` — nobody, ADMIN included, can read another user's rows.
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(SessionGuard)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications, newest first' })
  @ApiResponse({ status: 200, type: NotificationListResponseDto })
  list(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationListResponse> {
    return this.notifications.list(user.id, query);
  }

  // Static routes declared before ':id' so they never land in the param handler.
  @Get('unread-count')
  @ApiOperation({ summary: 'How many of my notifications are unread' })
  @ApiResponse({ status: 200, type: NotificationUnreadCountResponseDto })
  unreadCount(@CurrentUser() user: AuthUser): Promise<NotificationUnreadCountResponse> {
    return this.notifications.unreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({ status: 200, type: NotificationMarkAllReadResponseDto })
  markAllRead(@CurrentUser() user: AuthUser): Promise<NotificationMarkAllReadResponse> {
    return this.notifications.markAllRead(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my notifications' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No such notification, or it belongs to someone else',
    type: ApiErrorResponseDto,
  })
  getOne(
    @Param() params: NotificationIdParamDto,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationResponse> {
    return this.notifications.getOne(params.id, user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No such notification, or it belongs to someone else',
    type: ApiErrorResponseDto,
  })
  markRead(
    @Param() params: NotificationIdParamDto,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationResponse> {
    return this.notifications.markRead(params.id, user.id);
  }
}
