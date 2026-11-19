import { Button, Popover, Text } from '@cloudflare/kumo';
import { Bell } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { type NotificationRecord, NotificationsApi } from '../../lib/notifications-api';
import { formatNotificationTime, notificationTarget } from './notification-target';

const POLL_MS = 60_000;

/**
 * The web inbox: managers and the back office are told about refunds, settlements, renewals and
 * overdue debts here. The unread count is polled; the list loads when the panel opens.
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await NotificationsApi.unreadCount());
    } catch {
      // A failed poll keeps the last count; the next tick retries.
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = setInterval(() => void refreshCount(), POLL_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await NotificationsApi.list());
    } catch {
      setError('Không tải được thông báo.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void loadList();
      void refreshCount();
    }
  };

  const openItem = async (item: NotificationRecord) => {
    if (!item.read_at) {
      setItems((list) =>
        list.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnread((count) => Math.max(0, count - 1));
      void NotificationsApi.markRead(item.id).catch(() => void refreshCount());
    }
    const target = notificationTarget(item.type, item.data ?? {});
    if (target) {
      setOpen(false);
      navigate(target);
    }
  };

  const markAll = async () => {
    try {
      await NotificationsApi.markAllRead();
      const now = new Date().toISOString();
      setItems((list) => list.map((n) => ({ ...n, read_at: n.read_at ?? now })));
      setUnread(0);
    } catch {
      setError('Không đánh dấu được — thử lại.');
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            shape="square"
            size="base"
            aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
            className="relative"
          />
        }
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-kumo-danger text-white text-[10px] leading-4 font-semibold text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Content align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-kumo-line px-3 py-2">
          <Text bold>Thông báo</Text>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={markAll}>
            Đánh dấu đã đọc
          </Button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {error && <p className="px-3 py-2 text-sm text-kumo-danger">{error}</p>}
          {loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-kumo-subtle">Đang tải…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-kumo-subtle">Chưa có thông báo.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-kumo-line last:border-b-0 hover:bg-kumo-tint',
                      !item.read_at && 'bg-kumo-brand/5',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          item.read_at ? 'bg-transparent' : 'bg-kumo-brand',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-kumo-default">{item.title}</p>
                        <p className="text-sm text-kumo-subtle line-clamp-3">{item.body}</p>
                        <p className="mt-0.5 text-xs text-kumo-subtle">
                          {formatNotificationTime(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
};
