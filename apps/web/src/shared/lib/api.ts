import { getErrorMessage } from './errorMessages.js';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const authFailureListeners = new Set<() => void>();
const accessTokenListeners = new Set<(token: string | null, previousToken: string | null) => void>();

export const setAccessToken = (token: string | null): void => {
  const previousToken = accessToken;
  if (previousToken === token) return;
  accessToken = token;
  accessTokenListeners.forEach((listener) => listener(token, previousToken));
};

export const getAccessToken = (): string | null => accessToken;

export const subscribeToAccessTokenChange = (
  listener: (token: string | null, previousToken: string | null) => void,
): (() => void) => {
  accessTokenListeners.add(listener);
  return () => accessTokenListeners.delete(listener);
};

export const subscribeToAuthFailure = (listener: () => void): (() => void) => {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
};

function notifyAuthFailure(): void {
  setAccessToken(null);
  authFailureListeners.forEach((listener) => listener());
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

type ErrorPayload = {
  error?: { code?: unknown; message?: unknown; details?: unknown };
};

async function readError(response: Response): Promise<ApiError> {
  const data = (await response.json().catch(() => null)) as ErrorPayload | null;
  const code = typeof data?.error?.code === 'string' ? data.error.code : 'INTERNAL';
  return new ApiError(
    response.status,
    code,
    getErrorMessage(code, data?.error?.details),
    data?.error?.details,
  );
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { accessToken?: unknown };
        return typeof data.accessToken === 'string' ? data.accessToken : null;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  const token = await refreshInFlight;
  setAccessToken(token);
  return token;
}

function requestUrl(path: string, query?: ApiInit['query']): string {
  const queryString = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
          .map(([key, value]) => [key, String(value)]),
      ).toString()
    : '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
}

async function send<T>(path: string, init: ApiInit, token: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(requestUrl(path, init.query), {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    body:
      init.body === undefined
        ? undefined
        : isFormData || typeof init.body === 'string'
          ? (init.body as BodyInit)
          : JSON.stringify(init.body),
  });

  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await readError(response);
  return (await response.json()) as T;
}

export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const tokenUsed = accessToken;
  try {
    return await send<T>(path, init, tokenUsed);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === 'UNAUTHENTICATED') notifyAuthFailure();
    if (
      error.status !== 401 ||
      error.code !== 'TOKEN_EXPIRED' ||
      path.startsWith('/auth/')
    ) {
      throw error;
    }

    // A concurrent request may already have refreshed the token while this response was in flight.
    const token = accessToken !== tokenUsed ? accessToken : await refreshAccessToken();
    if (!token) {
      notifyAuthFailure();
      throw error;
    }

    try {
      return await send<T>(path, init, token);
    } catch (retryError) {
      if (
        retryError instanceof ApiError &&
        (retryError.code === 'UNAUTHENTICATED' || retryError.code === 'TOKEN_EXPIRED')
      ) {
        notifyAuthFailure();
      }
      throw retryError;
    }
  }
}
