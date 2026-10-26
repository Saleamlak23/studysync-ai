import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { setAccessToken } from './api.js';
import { disconnectSocket, getSocket, useOnReconnect, type StudySyncSocket } from './socket.js';
import { useWorkspaceSocket } from '../hooks/useWorkspaceSocket.js';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

type Handler = (...args: unknown[]) => void;

function createSocketStub() {
  const handlers = new Map<string, Set<Handler>>();
  const socket = {
    connected: true,
    io: { on: vi.fn() },
    on: vi.fn((event: string, handler: Handler) => {
      const eventHandlers = handlers.get(event) ?? new Set<Handler>();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
      return socket;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return socket;
    }),
    emit: vi.fn(() => socket),
    disconnect: vi.fn(() => {
      socket.connected = false;
      return socket;
    }),
    connect: vi.fn(() => {
      socket.connected = true;
      handlers.get('connect')?.forEach((handler) => handler());
      return socket;
    }),
    trigger: (event: string) => handlers.get(event)?.forEach((handler) => handler()),
  };

  return socket;
}

describe('socket client', () => {
  let socketStub: ReturnType<typeof createSocketStub>;

  beforeEach(() => {
    socketStub = createSocketStub();
    vi.mocked(io).mockReturnValue(socketStub as unknown as StudySyncSocket);
    setAccessToken('socket-token-one');
  });

  afterEach(() => {
    cleanup();
    disconnectSocket();
    setAccessToken(null);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('TC-TASK-04: uses the latest access token on every authenticated connection', () => {
    const socket = getSocket();
    const options = vi.mocked(io).mock.calls[0]?.[1] as {
      auth: (callback: (credentials: { token: string | null }) => void) => void;
    };
    const credentials: Array<{ token: string | null }> = [];

    options.auth((value) => credentials.push(value));
    setAccessToken('socket-token-two');
    options.auth((value) => credentials.push(value));

    expect(getSocket()).toBe(socket);
    expect(credentials).toEqual([
      { token: 'socket-token-one' },
      { token: 'socket-token-two' },
    ]);
    expect(socketStub.disconnect).toHaveBeenCalledOnce();
    expect(socketStub.connect).toHaveBeenCalledOnce();
  });

  it('TC-CHAT-05: derives the socket origin from an absolute API URL when unset', () => {
    vi.stubEnv('VITE_API_ORIGIN', '');
    vi.stubEnv('VITE_API_URL', 'http://localhost:4000/api/v1');

    getSocket();

    expect(io).toHaveBeenCalledWith('http://localhost:4000', expect.any(Object));
  });

  it('TC-CHAT-05: notifies listeners after reconnect and removes them on unmount', () => {
    const onReconnect = vi.fn();
    renderHook(() => useOnReconnect(onReconnect));
    const socket = getSocket() as unknown as ReturnType<typeof createSocketStub>;

    act(() => socket.trigger('connect'));
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => socket.trigger('connect'));
    expect(onReconnect).toHaveBeenCalledOnce();

    cleanup();
    act(() => socket.trigger('connect'));
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it('TC-TASK-04: joins the workspace when connected and rejoins after reconnect', () => {
    const socket = getSocket() as unknown as ReturnType<typeof createSocketStub>;
    const { unmount } = renderHook(() => useWorkspaceSocket('workspace-1'));

    expect(socket.emit).toHaveBeenCalledWith('workspace:join', { workspaceId: 'workspace-1' });
    expect(socket.emit).toHaveBeenCalledTimes(1);

    act(() => socket.trigger('connect'));
    expect(socket.emit).toHaveBeenCalledTimes(2);

    unmount();
    act(() => socket.trigger('connect'));
    expect(socket.emit).toHaveBeenCalledTimes(2);
  });
});
