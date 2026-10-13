import { ROLES_KEY } from '@modules/auth/decorators/roles.decorator';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole, UserStatus } from '@storage/types';
import { NotificationsController } from './notifications.controller';

const user = (id: string, roles: UserRole[]): AuthUser =>
  ({
    id,
    email: `${id}@example.com`,
    phone: null,
    fullName: id,
    status: UserStatus.ACTIVE,
    roles,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as AuthUser;

const HANDLERS = ['list', 'unreadCount', 'markAllRead', 'getOne', 'markRead'] as const;

describe('NotificationsController', () => {
  let service: Record<(typeof HANDLERS)[number], jest.Mock>;
  let controller: NotificationsController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue({ notifications: [], meta: {} }),
      unreadCount: jest.fn().mockResolvedValue({ unread: 0 }),
      markAllRead: jest.fn().mockResolvedValue({ updated: 0 }),
      getOne: jest.fn().mockResolvedValue({ notification: {} }),
      markRead: jest.fn().mockResolvedValue({ notification: {} }),
    };
    controller = new NotificationsController(service as never);
  });

  it('requires a session on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, NotificationsController)).toEqual([SessionGuard]);
  });

  it('has no role rule anywhere — no role gets a wider view', () => {
    expect(Reflect.getMetadata(ROLES_KEY, NotificationsController)).toBeUndefined();
    for (const name of HANDLERS) {
      const handler = NotificationsController.prototype[name];
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
    }
  });

  it.each([
    ['customer', user('customer-1', [UserRole.CUSTOMER])],
    ['staff', user('staff-1', [UserRole.FACILITY_STAFF])],
    ['manager', user('manager-1', [UserRole.FACILITY_MANAGER])],
    ['admin', user('admin-1', [UserRole.ADMIN])],
  ])('passes only the session user id to the service (%s)', async (_label, actor) => {
    await controller.list({ page: 1, limit: 20 }, actor);
    await controller.unreadCount(actor);
    await controller.markAllRead(actor);
    await controller.getOne({ id: 'notif-1' }, actor);
    await controller.markRead({ id: 'notif-1' }, actor);

    expect(service.list).toHaveBeenCalledWith(actor.id, { page: 1, limit: 20 });
    expect(service.unreadCount).toHaveBeenCalledWith(actor.id);
    expect(service.markAllRead).toHaveBeenCalledWith(actor.id);
    expect(service.getOne).toHaveBeenCalledWith('notif-1', actor.id);
    expect(service.markRead).toHaveBeenCalledWith('notif-1', actor.id);
  });
});
