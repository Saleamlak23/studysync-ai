import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.js';
import { ApiError, api } from '@/shared/lib/api.js';
import { acceptAuthResponse } from '@/shared/lib/session.js';

vi.mock('@/shared/lib/api.js', () => {
  class MockApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }

  return { api: vi.fn(), ApiError: MockApiError };
});

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
    expect(api).not.toHaveBeenCalled();
  });

  it('TC-AUTH-01: validates and submits registration with normalized data', async () => {
    vi.mocked(api).mockResolvedValue({
      user: {
        id: 'u-2',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        avatarUrl: null,
        bio: null,
        systemRole: 'USER',
      },
      accessToken: 'token-456',
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<AuthPage />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Create account$/i }));
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: ' Ada Lovelace ' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'ADA@EXAMPLE.COM ' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create account$/i }));
    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create account$/i }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: { name: 'Ada Lovelace', email: 'ada@example.com', password: 'password123' },
      });
    });
    expect(acceptAuthResponse).toHaveBeenCalledWith({
      user: expect.objectContaining({ email: 'ada@example.com' }),
      accessToken: 'token-456',
    });
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('TC-AUTH-01: displays a mapped registration conflict error', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(409, 'CONFLICT', 'That already exists.'));

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create account$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That already exists.');
    expect(acceptAuthResponse).not.toHaveBeenCalled();
  });

  it('TC-AUTH-02: preserves an invite destination when switching to registration', async () => {
    vi.mocked(api).mockResolvedValue({
      user: {
        id: 'u-3',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        avatarUrl: null,
        bio: null,
        systemRole: 'USER',
      },
      accessToken: 'token-789',
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/join/XYZ789' } } }]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/join/:code" element={<div>Join page: XYZ789</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create account$/i }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/auth/register', expect.any(Object));
    });
    expect(await screen.findByText('Join page: XYZ789')).toBeInTheDocument();
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
