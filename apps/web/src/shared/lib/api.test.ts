import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, getAccessToken, setAccessToken, subscribeToAuthFailure } from './api.js';
import { getErrorMessage } from './errorMessages.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  beforeEach(() => {
    setAccessToken('old-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('TC-AUTH-02: refreshes an expired access token and retries the request once', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TOKEN_EXPIRED', message: 'expired' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ value: 'ok' }));

    await expect(api<{ value: string }>('/me')).resolves.toEqual({ value: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer fresh-token');
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('TC-AUTH-02: shares a single refresh between concurrent expired requests', async () => {
    const fetchMock = vi.mocked(fetch);
    let releaseRefresh!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      releaseRefresh = resolve;
    });
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return refreshResponse;
      if (new Headers(init?.headers).get('Authorization') === 'Bearer fresh-token') {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ error: { code: 'TOKEN_EXPIRED' } }, 401);
    });

    const first = api('/first');
    const second = api('/second');
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1));
    releaseRefresh(jsonResponse({ accessToken: 'fresh-token' }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('TC-AUTH-02: does not retry or refresh when the refresh request fails', async () => {
    const onFailure = vi.fn();
    const unsubscribe = subscribeToAuthFailure(onFailure);
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TOKEN_EXPIRED' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401));

    await expect(api('/me')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBeNull();
    expect(onFailure).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('TC-AUTH-02: does not attempt a second refresh after the retry is rejected', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TOKEN_EXPIRED' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TOKEN_EXPIRED' } }, 401));

    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps unknown API error codes to a safe friendly message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'UNRECOGNIZED', message: 'internal database detail' } }, 400),
    );

    await expect(api('/me')).rejects.toMatchObject({
      code: 'UNRECOGNIZED',
      message: 'Something went wrong. Try again.',
    });
    expect(getErrorMessage('UNRECOGNIZED')).toBe('Something went wrong. Try again.');
    expect(getErrorMessage('AI_LIMIT_REACHED', { resetAt: '2026-10-22T12:00:00.000Z' })).toContain(
      'Daily AI limit reached. It resets at ',
    );
  });
});
