import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.js';
import { api } from '@/shared/lib/api.js';
import { acceptAuthResponse } from '@/shared/lib/session.js';

vi.mock('@/shared/lib/api.js', () => ({
  api: vi.fn(),
}));

vi.mock('@/shared/lib/session.js', () => ({
  acceptAuthResponse: vi.fn(),
}));

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('TC-AUTH-01: validates login fields before submission', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('TC-AUTH-02: submits credentials and redirects invite users back to the join link', async () => {
    vi.mocked(api).mockResolvedValue({
      user: {
        id: 'u-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        avatarUrl: null,
        bio: null,
        systemRole: 'USER',
      },
      accessToken: 'token-123',
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/join/ABC123' } } }]}> 
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/join/:code" element={<div>Join page: ABC123</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }));

    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: { email: 'ada@example.com', password: 'password123' },
      });
    });

    await waitFor(() => {
      expect(acceptAuthResponse).toHaveBeenCalledWith({
        user: expect.objectContaining({ email: 'ada@example.com' }),
        accessToken: 'token-123',
      });
    });

    expect(await screen.findByText('Join page: ABC123')).toBeInTheDocument();
  });
});
