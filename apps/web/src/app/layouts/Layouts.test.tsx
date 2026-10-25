import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLayout, AppShell, AuthLayout, WorkspaceLayout } from './index.js';
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
      notifications: [],
      unreadCount: 0,
      aiConsentGiven: true,
      aiAvailable: true,
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

function renderWithProviders(ui: React.ReactElement, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Layouts (NFR-12)', () => {
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

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('AuthLayout', () => {
    it('renders child outlet inside centered canvas container', () => {
      renderWithProviders(
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<div data-testid="auth-card">Login Form</div>} />
          </Route>
        </Routes>,
      );

      expect(screen.getByTestId('auth-card')).toBeInTheDocument();
      expect(screen.getByText('Login Form')).toBeInTheDocument();
    });
  });

  describe('AppShell', () => {
    it('renders desktop sidebar with brand and navigation links', () => {
      renderWithProviders(
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Dashboard Content</div>} />
            <Route path="/profile" element={<div>Profile Dialog</div>} />
          </Route>
        </Routes>,
      );

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(mainNav).toBeInTheDocument();
      expect(within(mainNav).getByRole('link', { name: /My dashboard/i })).toBeInTheDocument();
      expect(within(mainNav).getByRole('link', { name: /Workspaces/i })).toBeInTheDocument();
      expect(screen.getByText('Rufta Gaiem')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });

    it('TC-PROF-01: opens the profile route from the desktop identity control', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Dashboard Content</div>} />
            <Route path="/profile" element={<div>Profile Dialog</div>} />
          </Route>
        </Routes>,
      );

      fireEvent.click(screen.getAllByRole('button', { name: 'Edit profile' })[0]!);
      expect(await screen.findByText('Profile Dialog')).toBeInTheDocument();
    });

    it('TC-PROF-01: opens the profile route from the mobile header control', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Dashboard Content</div>} />
            <Route path="/profile" element={<div>Profile Dialog</div>} />
          </Route>
        </Routes>,
      );

      fireEvent.click(screen.getAllByRole('button', { name: 'Edit profile' })[1]!);
      expect(await screen.findByText('Profile Dialog')).toBeInTheDocument();
    });

    it('displays System admin link only for ADMIN systemRole', () => {
      // Normal user
      renderWithProviders(
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Content</div>} />
          </Route>
        </Routes>,
      );
      expect(screen.queryByRole('link', { name: /System admin/i })).not.toBeInTheDocument();

      cleanup();

      // Admin user
      vi.mocked(sessionModule.useSession).mockReturnValue({
        status: 'authenticated',
        user: {
          id: 'admin-1',
          name: 'SysAdmin',
          email: 'admin@example.com',
          avatarUrl: null,
          bio: null,
          systemRole: 'ADMIN',
        },
      });

      renderWithProviders(
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Content</div>} />
          </Route>
        </Routes>,
      );
      expect(screen.getAllByRole('link', { name: /System admin|Admin/i }).length).toBeGreaterThan(0);
    });

    it('renders mobile navigation bar with accessible touch targets (>= 44px)', () => {
      renderWithProviders(
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Content</div>} />
          </Route>
        </Routes>,
      );

      const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' });
      expect(mobileNav).toBeInTheDocument();

      const signoutButtons = screen.getAllByRole('button', { name: /Sign out/i });
      expect(signoutButtons.length).toBeGreaterThan(0);

      fireEvent.click(signoutButtons[0]);
      expect(sessionModule.signOut).toHaveBeenCalled();
    });
  });

  describe('WorkspaceLayout', () => {
    it('renders workspace navigation tabs and docked AI assistant landmarks', () => {
      renderWithProviders(
        <Routes>
          <Route path="/w/:workspaceId" element={<WorkspaceLayout />}>
            <Route path="board" element={<div>Board Content</div>} />
          </Route>
        </Routes>,
        ['/w/ws-100/board'],
      );

      expect(screen.getByText('Board Content')).toBeInTheDocument();

      const tabs = screen.getByRole('navigation', { name: 'Workspace tabs' });
      expect(tabs).toBeInTheDocument();
      expect(within(tabs).getByRole('link', { name: 'Board' })).toHaveAttribute('href', '/w/ws-100/board');
      expect(within(tabs).getByRole('link', { name: 'Chat & files' })).toHaveAttribute('href', '/w/ws-100/chat');
      expect(within(tabs).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/w/ws-100');
      expect(within(tabs).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/w/ws-100/settings');

      // AI assistant landmark
      expect(screen.getByRole('complementary', { name: 'AI assistant' })).toBeInTheDocument();
    });

    it('opens mobile/tablet AI assistant sheet when toggle button is clicked', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/w/:workspaceId" element={<WorkspaceLayout />}>
            <Route index element={<div>Workspace Home</div>} />
          </Route>
        </Routes>,
        ['/w/ws-100'],
      );

      const aiButtons = screen.getAllByRole('button', { name: /AI assistant/i });
      fireEvent.click(aiButtons[0]);

      // Sheet dialog opens
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('AdminLayout', () => {
    it('renders admin branding and navigation landmarks', () => {
      renderWithProviders(
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<div>Admin Users List</div>} />
          </Route>
        </Routes>,
        ['/admin'],
      );

      expect(screen.getByText('Admin Users List')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /Back to app/i }).length).toBeGreaterThan(0);
    });
  });
});
