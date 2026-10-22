import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import {
  api,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  subscribeToAuthFailure,
} from './api.js';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  systemRole: 'USER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED';
};

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'unauthenticated'; user: null };

type MeResponse = { user: SessionUser };
type AuthResponse = { user: SessionUser; accessToken: string };

let state: SessionState = { status: 'loading', user: null };
const listeners = new Set<() => void>();
let restoreInFlight: Promise<void> | null = null;
let authFailureUnsubscribe: (() => void) | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function update(next: SessionState): void {
  state = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SessionState {
  return state;
}

export function setSession(user: SessionUser, token: string): void {
  setAccessToken(token);
  update({ status: 'authenticated', user });
}

export function clearSession(): void {
  setAccessToken(null);
  update({ status: 'unauthenticated', user: null });
}

export async function restoreSession(): Promise<void> {
  if (restoreInFlight) return restoreInFlight;
  if (state.status === 'authenticated' && getAccessToken()) return;

  restoreInFlight = (async () => {
    const token = getAccessToken() ?? (await refreshAccessToken());
    if (!token) {
      clearSession();
      return;
    }

    try {
      const response = await api<MeResponse>('/me');
      update({ status: 'authenticated', user: response.user });
    } catch {
      clearSession();
    }
  })().finally(() => {
    restoreInFlight = null;
  });

  return restoreInFlight;
}

export function acceptAuthResponse(response: AuthResponse): void {
  setSession(response.user, response.accessToken);
}

export async function signOut(): Promise<void> {
  try {
    if (getAccessToken()) await api('/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}

/** Mount in the app provider tree to restore the cookie-backed session on page load. */
export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    authFailureUnsubscribe ??= subscribeToAuthFailure(clearSession);
    void restoreSession();
    return () => {
      authFailureUnsubscribe?.();
      authFailureUnsubscribe = null;
    };
  }, []);

  return children;
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
