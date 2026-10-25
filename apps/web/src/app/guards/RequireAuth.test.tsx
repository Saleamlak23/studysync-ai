import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth.js';
import { useSession } from '@/shared/lib/session.js';

vi.mock('@/shared/lib/session.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/session.js')>();
  return {
    ...actual,
    useSession: vi.fn(),
  };
});

function LoginLocationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  return <div>Login Page: from {from ?? 'none'}</div>;
}

describe('RequireAuth guard', () => {
  it('TC-AUTH-02: shows an accessible loading state while authentication is being verified', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'loading', user: null });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Checking authentication' })).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('TC-AUTH-02: redirects unauthenticated users to /login preserving target location', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'unauthenticated', user: null });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<LoginLocationProbe />} />
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page: from /protected')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('TC-AUTH-02: renders child outlet when authenticated', () => {
    vi.mocked(useSession).mockReturnValue({
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

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
