import { useSyncExternalStore } from 'react';

export type AiChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  kind?: 'answer' | 'summary';
};

type Thread = {
  contextKey: string;
  messages: readonly AiChatMessage[];
};

const emptyMessages: readonly AiChatMessage[] = [];
const threads = new Map<string, Thread>();
const listeners = new Set<() => void>();
let nextMessageId = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getMessages(workspaceId: string) {
  return threads.get(workspaceId)?.messages ?? emptyMessages;
}

export function useAiConversation(workspaceId: string) {
  return useSyncExternalStore(subscribe, () => getMessages(workspaceId), () => emptyMessages);
}

export function syncAiConversationContext(workspaceId: string, contextKey: string) {
  if (!workspaceId) return;
  const current = threads.get(workspaceId);
  if (current?.contextKey === contextKey) return;
  threads.set(workspaceId, { contextKey, messages: emptyMessages });
  emit();
}

export function appendAiChatMessage(
  workspaceId: string,
  message: Omit<AiChatMessage, 'id'>,
) {
  const current = threads.get(workspaceId);
  if (!current) return;
  threads.set(workspaceId, {
    ...current,
    messages: [...current.messages, { ...message, id: nextMessageId++ }],
  });
  emit();
}

export function clearAiConversation(workspaceId: string) {
  const current = threads.get(workspaceId);
  if (!current) return;
  threads.set(workspaceId, { ...current, messages: emptyMessages });
  emit();
}
