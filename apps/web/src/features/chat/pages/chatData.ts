import type { Channel, Message, MessagesPage, WorkspaceRole } from '@studysync/shared';
import { api } from '@/shared/lib/api.js';

export type ChatWorkspace = { myRole: WorkspaceRole };
export type ChatMember = { user: { id: string; name: string; avatarUrl: string | null } };

export const chatKeys = {
  channels: (workspaceId: string) => ['chat', 'channels', workspaceId] as const,
  members: (workspaceId: string) => ['chat', 'members', workspaceId] as const,
  workspace: (workspaceId: string) => ['chat', 'workspace', workspaceId] as const,
  messages: (channelId: string) => ['chat', 'messages', channelId] as const,
};

export function getChannels(workspaceId: string): Promise<Channel[]> {
  return api<Channel[]>(`/workspaces/${encodeURIComponent(workspaceId)}/channels`);
}

export function getWorkspaceRole(workspaceId: string): Promise<ChatWorkspace> {
  return api<ChatWorkspace>(`/workspaces/${encodeURIComponent(workspaceId)}`);
}

export function getMembers(workspaceId: string): Promise<ChatMember[]> {
  return api<ChatMember[]>(`/workspaces/${encodeURIComponent(workspaceId)}/members`);
}

export function getMessages(channelId: string, options: { before?: string; after?: string } = {}): Promise<MessagesPage> {
  const params = new URLSearchParams({ limit: '100' });
  if (options.before) params.set('before', options.before);
  if (options.after) params.set('after', options.after);
  return api<MessagesPage>(`/channels/${encodeURIComponent(channelId)}/messages?${params.toString()}`);
}

export function createChannel(workspaceId: string, name: string): Promise<Channel> {
  return api<Channel>(`/workspaces/${encodeURIComponent(workspaceId)}/channels`, { method: 'POST', body: { name } });
}

export function deleteChannel(channelId: string): Promise<void> {
  return api<void>(`/channels/${encodeURIComponent(channelId)}`, { method: 'DELETE' });
}

export function postMessage(channelId: string, content: string, mentionIds: string[], fileId?: string): Promise<Message> {
  return api<Message>(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    body: {
      content,
      ...(fileId ? { fileId } : {}),
      ...(mentionIds.length ? { mentionIds } : {}),
    },
  });
}
