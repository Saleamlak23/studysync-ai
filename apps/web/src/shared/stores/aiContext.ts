import { useSyncExternalStore } from 'react';

export type AiContextItem =
  | { type: 'card'; id: string; label: string }
  | { type: 'message_range'; channelId: string; fromId: string; toId: string; label: string }
  | { type: 'file'; id: string; label: string };

let items: readonly AiContextItem[] = [];
const listeners = new Set<() => void>();

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

function clear(): void {
  items = [];
  emit();
}

export const aiContext = { select, clear };

export function useAiContext(): {
  items: readonly AiContextItem[];
  select: typeof select;
  clear: typeof clear;
} {
  const selectedItems = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { items: selectedItems, select, clear };
}
