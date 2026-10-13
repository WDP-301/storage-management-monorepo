import { Notification } from '@entities/notification.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta } from '@shared/models/api-response';
import { NotificationStatus } from '@storage/types';
import { type EntityManager, IsNull, type Repository } from 'typeorm';
import {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  type ListNotificationsQueryDto,
} from './dto/list-notifications-query.dto';
import {
  type NotificationListResponse,
  type NotificationMarkAllReadResponse,
  type NotificationPayload,
  type NotificationResponse,
  type NotificationUnreadCountResponse,
  toNotificationRecord,
} from './types/notification';

/**
 * In-app notifications. Every read/write below is filtered by `user_id = <session user>`:
 * a notification is visible only to the user it was created for — no role (not even ADMIN)
 * can see another user's notifications. Someone else's id answers 404, same as a missing one,
 * so its existence is not leaked.
 */
export interface CreateNotificationDto {
  userId: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  /**
   * Convenience helper to create a single notification using the repository manager.
   */
  async create(dto: CreateNotificationDto): Promise<void> {
    await this.createForUsers(this.notifications.manager, [dto.userId], {
      type: (dto.type ?? 'INVOICE_ISSUED') as any,
      title: dto.title,
      body: dto.body,
      data: dto.data,
    });
  }

  /**
   * Stores one notification per recipient through the caller's EntityManager, so the rows
   * commit or roll back together with the business change that caused them (a ticket that
   * fails to save leaves no notification behind, and vice versa). Duplicate ids are collapsed.
   * Returns how many rows were inserted.
   */
  async createForUsers(
    em: EntityManager,
    userIds: readonly string[],
    payload: NotificationPayload,
  ): Promise<number> {
    const recipients = [...new Set(userIds.filter(Boolean))];
    if (recipients.length === 0) return 0;

    const sentAt = new Date();
    await em.insert(
      Notification,
      recipients.map(
        (userId): Partial<Notification> => ({
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: { ...payload.data },
          // In-app: stored = delivered. Unread is tracked by `read_at IS NULL`.
          status: NotificationStatus.SENT,
          sentAt,
        }),
      ),
    );
    return recipients.length;
  }

  async list(userId: string, query: ListNotificationsQueryDto): Promise<NotificationListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_NOTIFICATION_PAGE_SIZE;

    const builder = this.notifications
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.unreadOnly) {
      builder.andWhere('notification.readAt IS NULL');
    }

    const [rows, total] = await builder.getManyAndCount();
    return {
      notifications: rows.map(toNotificationRecord),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getOne(id: string, userId: string): Promise<NotificationResponse> {
    return { notification: toNotificationRecord(await this.findOwnedOrFail(id, userId)) };
  }

  async unreadCount(userId: string): Promise<NotificationUnreadCountResponse> {
    const unread = await this.notifications.count({ where: { userId, readAt: IsNull() } });
    return { unread };
  }

  /** Marks one of the user's own notifications as read. Re-reading keeps the first read time. */
  async markRead(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.findOwnedOrFail(id, userId);
    if (!notification.readAt) {
      await this.notifications.update(
        { id: notification.id, userId, readAt: IsNull() },
        { status: NotificationStatus.READ, readAt: new Date() },
      );
    }
    return { notification: toNotificationRecord(await this.findOwnedOrFail(id, userId)) };
  }

  async markAllRead(userId: string): Promise<NotificationMarkAllReadResponse> {
    const result = await this.notifications.update(
      { userId, readAt: IsNull() },
      { status: NotificationStatus.READ, readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  private async findOwnedOrFail(id: string, userId: string): Promise<Notification> {
    const notification = await this.notifications.findOne({ where: { id, userId } });
    if (!notification) notFound('Notification');
    return notification;
  }
}
