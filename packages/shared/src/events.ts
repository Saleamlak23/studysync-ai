import type { Message } from './schemas/chat.js';
import type { Notification } from './schemas/notifications.js';

export const NOTIFICATION_NEW_EVENT = 'notification:new' as const;
export const SOCKET_EVENTS = ['workspace:join', 'channel:join', 'channel:leave', 'message:new', 'board:card_created', 'board:card_updated', 'board:card_moved', 'board:card_deleted', 'board:list_changed', NOTIFICATION_NEW_EVENT] as const;
export type SocketEvent = (typeof SOCKET_EVENTS)[number];
export type WorkspaceJoinPayload = { workspaceId: string };
export type ChannelRoomPayload = { channelId: string };
export type MessageNewPayload = Message;
export type NotificationNewPayload = Notification;
export type CardMovedPayload = { cardId: string; fromListId: string; toListId: string; position: number; renumbered?: boolean };
export type CardDeletedPayload = { cardId: string; listId: string };
export type ListChangedPayload = { lists: Array<{ id: string; name: string; position: number }> };
