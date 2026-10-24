import type { Message, MessagesPage } from '@studysync/shared';

export function mergeMessages(...groups: Message[][]): Message[] {
  const unique = new Map<string, Message>();
  for (const message of groups.flat()) {
    if (!unique.has(message.id)) unique.set(message.id, message);
  }
  return [...unique.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function latestMessageId(messages: Message[]): string | null {
  return messages.at(-1)?.id ?? null;
}

export async function catchUpMessages(
  currentMessages: Message[],
  fetchAfter: (messageId: string) => Promise<MessagesPage>,
): Promise<Message[]> {
  let messages = mergeMessages(currentMessages);
  let cursor = latestMessageId(messages);
  if (!cursor) return messages;

  while (cursor) {
    const page = await fetchAfter(cursor);
    messages = mergeMessages(messages, page.messages);
    if (!page.nextCursor || page.nextCursor === cursor) break;
    cursor = page.nextCursor;
  }

  return messages;
}
