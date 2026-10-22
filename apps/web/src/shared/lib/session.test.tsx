import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, SessionProvider, useSession } from './session.js';
import { getAccessToken } from './api.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function SessionProbe() {
  const session = useSession();
  return createElement('output', null, session.status === 'authenticated' ? session.user.email : session.status);
}

describe('session provider', () => {
  beforeEach(() => {
    clearSession();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('TC-AUTH-02: restores the current user from the refresh cookie on app load', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'restored-token' }))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'user-1', name: 'Yared', email: 'yared@example.test', avatarUrl: null, bio: null, systemRole: 'USER' }, workspaces: [] }));

    render(createElement(SessionProvider, null, createElement(SessionProbe)));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('yared@example.test'));
    expect(getAccessToken()).toBe('restored-token');
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/auth/refresh', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });

  it('TC-AUTH-02: enters the signed-out state when no refresh session exists', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401));

    render(createElement(SessionProvider, null, createElement(SessionProbe)));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('unauthenticated'));
    expect(getAccessToken()).toBeNull();
  });
});
