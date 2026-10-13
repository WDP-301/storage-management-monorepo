import { Notification } from '@entities/notification.entity';
import { NotificationStatus, NotificationType } from '@storage/types';
import { IsNull } from 'typeorm';
import { NotificationsService } from './notifications.service';

const buildRow = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'notif-1',
    userId: 'owner-1',
    type: NotificationType.TICKET_CREATED,
    title: 'New ticket #ST-1',
    body: 'A customer submitted a ticket',
    data: { ticketId: 'ticket-1' },
    status: NotificationStatus.SENT,
    sentAt: new Date('2026-01-01T00:00:00Z'),
    readAt: undefined,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as Notification;

const buildQueryBuilder = (rows: Notification[], total: number) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
});

describe('NotificationsService', () => {
  let rows: Notification[];
  let repo: {
    findOne: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let em: { insert: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    rows = [buildRow()];
    repo = {
      // Behaves like TypeORM: every key of `where` must match the row.
      findOne: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          rows.find((row) =>
            Object.entries(where).every(([key, value]) => row[key as keyof Notification] === value),
          ) ?? null,
        ),
      ),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => buildQueryBuilder([], 0)),
    };
    em = { insert: jest.fn().mockResolvedValue({ identifiers: [] }) };
    service = new NotificationsService(repo as never);
  });

  describe('createForUsers', () => {
    const payload = {
      type: NotificationType.TICKET_CREATED,
      title: 'New ticket',
      body: 'Body',
      data: { ticketId: 'ticket-1' },
    };

    it('inserts one SENT row per recipient through the caller EntityManager', async () => {
      const count = await service.createForUsers(em as never, ['u1', 'u2'], payload);

      expect(count).toBe(2);
      expect(em.insert).toHaveBeenCalledTimes(1);
      const [entity, inserted] = em.insert.mock.calls[0];
      expect(entity).toBe(Notification);
      expect(inserted).toEqual([
        expect.objectContaining({
          userId: 'u1',
          type: NotificationType.TICKET_CREATED,
          title: 'New ticket',
          body: 'Body',
          data: { ticketId: 'ticket-1' },
          status: NotificationStatus.SENT,
          sentAt: expect.any(Date),
        }),
        expect.objectContaining({ userId: 'u2' }),
      ]);
    });

    it('collapses duplicate and empty recipient ids', async () => {
      const count = await service.createForUsers(em as never, ['u1', '', 'u1'], payload);

      expect(count).toBe(1);
      expect(em.insert.mock.calls[0][1].map((row: Notification) => row.userId)).toEqual(['u1']);
    });

    it('does nothing without recipients', async () => {
      expect(await service.createForUsers(em as never, [], payload)).toBe(0);
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('defaults data to an empty object', async () => {
      await service.createForUsers(em as never, ['u1'], { ...payload, data: undefined });

      expect(em.insert.mock.calls[0][1][0].data).toEqual({});
    });

    it('propagates insert errors so the caller transaction rolls back', async () => {
      em.insert.mockRejectedValue(new Error('insert failed'));

      await expect(service.createForUsers(em as never, ['u1'], payload)).rejects.toThrow(
        'insert failed',
      );
    });
  });

  describe('list', () => {
    it('scopes the query to the requesting user, newest first', async () => {
      const builder = buildQueryBuilder([buildRow()], 1);
      repo.createQueryBuilder.mockReturnValue(builder);

      const result = await service.list('owner-1', { page: 1, limit: 20 });

      expect(builder.where).toHaveBeenCalledWith('notification.userId = :userId', {
        userId: 'owner-1',
      });
      expect(builder.orderBy).toHaveBeenCalledWith('notification.createdAt', 'DESC');
      expect(builder.andWhere).not.toHaveBeenCalled();
      expect(result.notifications[0]).toMatchObject({ id: 'notif-1', user_id: 'owner-1' });
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('adds the unread filter on top of the owner scope', async () => {
      const builder = buildQueryBuilder([], 0);
      repo.createQueryBuilder.mockReturnValue(builder);

      await service.list('owner-1', { page: 2, limit: 5, unreadOnly: true });

      expect(builder.where).toHaveBeenCalledWith('notification.userId = :userId', {
        userId: 'owner-1',
      });
      expect(builder.andWhere).toHaveBeenCalledWith('notification.readAt IS NULL');
      expect(builder.skip).toHaveBeenCalledWith(5);
      expect(builder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('getOne', () => {
    it('returns the notification to its owner', async () => {
      const result = await service.getOne('notif-1', 'owner-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'notif-1', userId: 'owner-1' } });
      expect(result.notification).toMatchObject({ id: 'notif-1', user_id: 'owner-1' });
    });

    it.each(['another-customer', 'admin-1', 'manager-1', 'staff-1'])(
      'answers 404 to anyone else (%s)',
      async (userId) => {
        await expect(service.getOne('notif-1', userId)).rejects.toMatchObject({
          status: 404,
          response: { code: 'RESOURCE_NOT_FOUND' },
        });
      },
    );

    it('answers 404 for an unknown id', async () => {
      await expect(service.getOne('missing', 'owner-1')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('markRead', () => {
    it('marks the owner notification as read, scoped to the owner', async () => {
      repo.update.mockImplementation(() => {
        rows[0] = buildRow({ status: NotificationStatus.READ, readAt: new Date() });
        return Promise.resolve({ affected: 1 });
      });

      const result = await service.markRead('notif-1', 'owner-1');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'notif-1', userId: 'owner-1', readAt: IsNull() },
        { status: NotificationStatus.READ, readAt: expect.any(Date) },
      );
      expect(result.notification.status).toBe(NotificationStatus.READ);
      expect(result.notification.read_at).toEqual(expect.any(Date));
    });

    it('keeps the first read time when read again', async () => {
      rows[0] = buildRow({ status: NotificationStatus.READ, readAt: new Date('2026-02-01') });

      await service.markRead('notif-1', 'owner-1');

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('answers 404 and changes nothing for anyone else', async () => {
      await expect(service.markRead('notif-1', 'admin-1')).rejects.toMatchObject({ status: 404 });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('only touches unread notifications of the requesting user', async () => {
      repo.update.mockResolvedValue({ affected: 3 });

      const result = await service.markAllRead('owner-1');

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'owner-1', readAt: IsNull() },
        { status: NotificationStatus.READ, readAt: expect.any(Date) },
      );
      expect(result).toEqual({ updated: 3 });
    });
  });

  describe('unreadCount', () => {
    it('counts only unread notifications of the requesting user', async () => {
      repo.count.mockResolvedValue(4);

      const result = await service.unreadCount('owner-1');

      expect(repo.count).toHaveBeenCalledWith({ where: { userId: 'owner-1', readAt: IsNull() } });
      expect(result).toEqual({ unread: 4 });
    });
  });
});
