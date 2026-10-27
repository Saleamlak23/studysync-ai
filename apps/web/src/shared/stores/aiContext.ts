import { useSyncExternalStore } from 'react';

export type AiContextItem =
  | { type: 'card'; id: string; label: string }
  | { type: 'message_range'; channelId: string; fromId: string; toId: string; label: string }
  | { type: 'file'; id: string; label: string };

let items: readonly AiContextItem[] = [];
const listeners = new Set<() => void>();
const assistantOpenListeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): readonly AiContextItem[] {
  return items;
}

function select(next: AiContextItem[]): void {
  items = next.map((item) => ({ ...item }));
  emit();
}

function itemKey(item: AiContextItem): string {
  switch (item.type) {
    case 'card':
    case 'file':
      return `${item.type}:${item.id}`;
    case 'message_range':
      return `${item.type}:${item.channelId}:${item.fromId}:${item.toId}`;
  }
}

function add(item: AiContextItem): void {
  if (items.some((current) => itemKey(current) === itemKey(item))) return;
  items = [...items, { ...item }];
  emit();
}

function clear(): void {
  items = [];
  emit();
}

function requestAssistantOpen(): void {
  assistantOpenListeners.forEach((listener) => listener());
}

function subscribeToAssistantOpen(listener: () => void): () => void {
  assistantOpenListeners.add(listener);
  return () => assistantOpenListeners.delete(listener);
}

export const aiContext = { select, add, clear, requestAssistantOpen, subscribeToAssistantOpen };

export function useAiContext(): {
  items: readonly AiContextItem[];
  select: typeof select;
  add: typeof add;
  clear: typeof clear;
} {
  const selectedItems = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { items: selectedItems, select, add, clear };
}
