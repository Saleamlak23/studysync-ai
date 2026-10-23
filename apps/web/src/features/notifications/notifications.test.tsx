import type { Notification } from '@studysync/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '@/features/notifications';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/shared/lib/api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/api.js')>()),
  api: apiMock,
}));

const notifications: Notification[] = [
  { id: 'a6e9277f-d874-4e38-88da-d905d9cd5cb9', type: 'ASSIGNED', workspaceId: 'aa397e8f-cf06-45ce-842e-3960d51b318e', payload: {}, readAt: null, createdAt: '2026-10-22T10:00:00.000Z' },
  { id: 'e9e43e67-4dc3-4963-9bd8-78ce51e5d7af', type: 'MENTION', workspaceId: 'aa397e8f-cf06-45ce-842e-3960d51b318e', payload: {}, readAt: null, createdAt: '2026-10-22T09:00:00.000Z' },
];

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><NotificationBell /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  apiMock.mockReset();
});

describe('NotificationBell (TC-NOT-02)', () => {
  it('shows a loading state while notifications are fetched', () => {
    apiMock.mockReturnValue(new Promise(() => undefined));
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeInTheDocument();
  });

  it('shows an empty state and zero unread count', async () => {
    apiMock.mockResolvedValue({ notifications: [], nextCursor: null, unreadCount: 0 });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You’re all caught up.')).toBeInTheDocument();
    expect(screen.getByText('0 unread')).toBeInTheDocument();
  });

  it('shows a friendly error and retry action when loading fails', async () => {
    apiMock.mockRejectedValue(new Error('private server detail'));
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load notifications. Try again.');
    expect(screen.queryByText('private server detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('marks one and then all notifications read and updates unreadCount', async () => {
    const state = notifications.map((notification) => ({ ...notification }));
    apiMock.mockImplementation((path: string) => {
      if (path === '/notifications') {
        return Promise.resolve({ notifications: state.map((item) => ({ ...item })), nextCursor: null, unreadCount: state.filter((item) => item.readAt === null).length });
      }
      if (path === `/notifications/${notifications[0].id}/read`) {
        state[0] = { ...state[0], readAt: '2026-10-23T10:00:00.000Z' };
        return Promise.resolve(state[0]);
      }
      if (path === '/notifications/read-all') {
        state.forEach((item, index) => { state[index] = { ...item, readAt: item.readAt ?? '2026-10-23T10:01:00.000Z' }; });
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected request ${path}`);
    });

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('2 unread')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark as read' })[0]);
    await waitFor(() => expect(screen.getByText('1 unread')).toBeInTheDocument());
    expect(screen.getByText('Read')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.getByText('0 unread')).toBeInTheDocument());
    expect(screen.getAllByText('Read')).toHaveLength(2);
    expect(apiMock).toHaveBeenCalledWith(`/notifications/${notifications[0].id}/read`, { method: 'POST' });
    expect(apiMock).toHaveBeenCalledWith('/notifications/read-all', { method: 'POST' });
  });
});
