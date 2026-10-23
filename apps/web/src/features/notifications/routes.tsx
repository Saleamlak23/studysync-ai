import type { Notification } from '@studysync/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ApiError, api } from '@/shared/lib/api.js';

type NotificationsResponse = {
  notifications: Notification[];
  nextCursor: string | null;
  unreadCount: number;
};

const notificationsKey = ['notifications'] as const;

function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => api<NotificationsResponse>('/notifications'),
  });
}

function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Notification>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
    onSuccess: (updatedNotification) => {
      queryClient.setQueryData<NotificationsResponse>(notificationsKey, (current) => {
        if (!current) return current;
        const existing = current.notifications.find((notification) => notification.id === updatedNotification.id);
        const shouldDecrement = existing?.readAt === null && updatedNotification.readAt !== null;
        return {
          ...current,
          notifications: current.notifications.map((notification) => notification.id === updatedNotification.id ? updatedNotification : notification),
          unreadCount: shouldDecrement ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
        };
      });
    },
  });
}

function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}

function notificationDescription(type: Notification['type']): string {
  switch (type) {
    case 'ASSIGNED': return 'A card was assigned to you.';
    case 'MENTION': return 'You were mentioned.';
    case 'DEADLINE': return 'A card deadline is approaching.';
  }
}

function notificationTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function NotificationsContent({ compact = false }: { compact?: boolean }) {
  const query = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const mutationError = markOne.error ?? markAll.error;

  if (query.isPending) {
    return <div role="status" aria-label="Loading notifications" className="space-y-3 p-4">
      {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-md border border-line bg-surface-muted" />)}
    </div>;
  }

  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : 'We could not load notifications. Try again.';
    return <div role="alert" className="m-4 flex flex-col items-start gap-3 rounded-md border border-danger bg-danger-bg p-4 text-fg">
      <p className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />{message}</p>
      <button type="button" className="min-h-11 rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-muted" onClick={() => void query.refetch()} disabled={query.isFetching}>Try again</button>
    </div>;
  }

  const { notifications, unreadCount } = query.data;
  const mutationMessage = mutationError instanceof ApiError ? mutationError.message : mutationError ? 'Your change could not be saved. Try again.' : null;
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0"><h2 className="font-semibold text-fg">Notifications</h2><p className="text-sm text-fg-muted">{unreadCount} unread</p></div>
        <button type="button" className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50" onClick={() => markAll.mutate()} disabled={unreadCount === 0 || markAll.isPending}>
          {markAll.isPending ? 'Marking…' : 'Mark all as read'}
        </button>
      </div>
      {mutationMessage && <p role="alert" className="mx-4 mt-3 rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg">{mutationMessage}</p>}
      {notifications.length === 0 ? (
        <p className="p-6 text-center text-sm text-fg-muted">You’re all caught up.</p>
      ) : (
        <ul aria-label="Notification list" className={`min-h-0 divide-y divide-line overflow-y-auto ${compact ? 'max-h-[min(65vh,32rem)]' : 'max-h-[calc(100dvh-15rem)]'}`}>
          {notifications.map((notification) => {
            const unread = notification.readAt === null;
            const markingThis = markOne.isPending && markOne.variables === notification.id;
            return (
              <li key={notification.id} className={`flex items-start gap-3 p-4 ${unread ? 'bg-primary-soft/60' : 'bg-surface'}`}>
                <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? 'bg-primary' : 'bg-transparent'}`} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-fg">{notificationDescription(notification.type)}</p>
                  <time className="mt-1 block text-xs text-fg-muted" dateTime={notification.createdAt}>{notificationTime(notification.createdAt)}</time>
                  {unread && <button type="button" className="mt-2 min-h-11 rounded-md px-2 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50" onClick={() => markOne.mutate(notification.id)} disabled={markOne.isPending || markAll.isPending}>{markingThis ? 'Marking…' : 'Mark as read'}</button>}
                  {!unread && <p className="mt-2 text-xs text-fg-faint">Read</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useNotifications();
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button type="button" className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line bg-surface text-fg hover:bg-surface-muted" aria-label="Notifications" aria-expanded={isOpen} aria-controls="notifications-panel" onClick={() => setIsOpen((open) => !open)}>
        <Bell aria-hidden="true" className="size-5" />
        <span className="sr-only">{unreadCount} unread notifications</span>
        <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-xs leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
      </button>
      {isOpen && <section id="notifications-panel" aria-label="Notifications panel" className="absolute right-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
        <NotificationsContent compact />
        <div className="border-t border-line p-3 text-right"><a className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft" href="/notifications">View all notifications</a></div>
      </section>}
    </div>
  );
}

export function NotificationsPage() {
  return <main className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6"><h1 className="text-xl font-semibold text-fg">Notifications</h1><section aria-label="Notifications"><NotificationsContent /></section></main>;
}

export const notificationsRoutes: RouteObject[] = [{ path: '/notifications', element: createElement(NotificationsPage) }];
