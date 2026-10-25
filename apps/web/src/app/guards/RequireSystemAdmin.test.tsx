import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireSystemAdmin } from './RequireSystemAdmin.js';
import { useSession } from '@/shared/lib/session.js';

vi.mock('@/shared/lib/session.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/session.js')>();
  return {
    ...actual,
    useSession: vi.fn(),
  };
});

describe('RequireSystemAdmin guard', () => {
  it('TC-AUTH-05: shows an accessible loading state while checking permissions', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'loading', user: null });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin" element={<div>Admin Area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Checking system permissions' })).toBeInTheDocument();
    expect(screen.queryByText('Admin Area')).not.toBeInTheDocument();
  });

  it('TC-AUTH-05: redirects unauthenticated users to /login', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'unauthenticated', user: null });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin" element={<div>Admin Area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Area')).not.toBeInTheDocument();
  });

  it('TC-AUTH-05: redirects non-admin users with systemRole USER to home', () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-2',
        name: 'Member User',
        email: 'user@example.com',
        avatarUrl: null,
        bio: null,
        systemRole: 'USER',
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/" element={<div>Home Dashboard</div>} />
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin" element={<div>Admin Area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Home Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Area')).not.toBeInTheDocument();
  });

  it('TC-AUTH-05: renders child outlet when authenticated with systemRole ADMIN', () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin-1',
        name: 'System Administrator',
        email: 'admin@example.com',
        avatarUrl: null,
        bio: null,
        systemRole: 'ADMIN',
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin" element={<div>Admin Area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin Area')).toBeInTheDocument();
  });
});
