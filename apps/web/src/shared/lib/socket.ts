import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  CardDeletedPayload,
  CardMovedPayload,
  ChannelRoomPayload,
  ListChangedPayload,
  MessageNewPayload,
  NotificationNewPayload,
  WorkspaceJoinPayload,
} from '@studysync/shared';
import { getAccessToken, subscribeToAccessTokenChange } from './api.js';

type Ack = (result: { ok: boolean }) => void;

type ClientToServerEvents = {
  'workspace:join': (payload: WorkspaceJoinPayload, ack?: Ack) => void;
  'channel:join': (payload: ChannelRoomPayload, ack?: Ack) => void;
  'channel:leave': (payload: ChannelRoomPayload, ack?: Ack) => void;
};

type ServerToClientEvents = {
  'message:new': (payload: MessageNewPayload) => void;
  'board:card_created': (payload: unknown) => void;
  'board:card_updated': (payload: unknown) => void;
  'board:card_moved': (payload: CardMovedPayload) => void;
  'board:card_deleted': (payload: CardDeletedPayload) => void;
  'board:list_changed': (payload: ListChangedPayload) => void;
  'notification:new': (payload: NotificationNewPayload) => void;
};

export type StudySyncSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: StudySyncSocket | null = null;
let unsubscribeFromTokenChanges: (() => void) | null = null;
const reconnectListeners = new Set<() => void>();

function getSocketOrigin(): string | undefined {
  if (import.meta.env.VITE_API_ORIGIN) return import.meta.env.VITE_API_ORIGIN;

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const origin = new URL(apiUrl, window.location.origin).origin;
    if (origin !== window.location.origin) return origin;
  }

  return undefined;
}

export function getSocket(): StudySyncSocket {
  if (socket) return socket;

  socket = io(getSocketOrigin(), {
    auth: (callback) => callback({ token: getAccessToken() }),
    reconnectionDelayMax: 5000,
  }) as StudySyncSocket;

  let hasConnected = false;
  socket.on('connect', () => {
    if (hasConnected) reconnectListeners.forEach((listener) => listener());
    hasConnected = true;
  });

  unsubscribeFromTokenChanges = subscribeToAccessTokenChange((token) => {
    if (!socket) return;
    if (!token) {
      socket.disconnect();
      return;
    }

    if (socket.connected) socket.disconnect();
    socket.connect();
  });

  return socket;
}

export function useOnReconnect(listener: () => void): void {
  useEffect(() => {
    reconnectListeners.add(listener);
    return () => {
      reconnectListeners.delete(listener);
    };
  }, [listener]);
}

export function disconnectSocket(): void {
  unsubscribeFromTokenChanges?.();
  unsubscribeFromTokenChanges = null;
  socket?.disconnect();
  socket = null;
}
