import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import * as sessionModule from '@/shared/lib/session.js';

vi.mock('@/shared/lib/session.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/session.js')>();
  return {
    ...actual,
    useSession: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/shared/lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api.js')>();
  return {
    ...actual,
    api: vi.fn().mockResolvedValue({
      assignedCards: [],
      upcomingDeadlines: [],
      notifications: [],
      unreadCount: 0,
    }),
  };
});

vi.mock('@/shared/lib/socket.js', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
  useOnReconnect: vi.fn(),
}));

describe('application scaffold', () => {
  beforeEach(() => {
    vi.mocked(sessionModule.useSession).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        name: 'Rufta Gaiem',
        email: 'rufta@example.com',
        avatarUrl: null,
        bio: null,
        systemRole: 'USER',
      },
    });
  });

  it('TC-NFR-12: renders the app with one main landmark and the shell', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(document.querySelectorAll('main')).toHaveLength(1);
  });
});
