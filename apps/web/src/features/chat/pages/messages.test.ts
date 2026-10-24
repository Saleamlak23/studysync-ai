import type { Message, MessagesPage } from '@studysync/shared';
import { describe, expect, it, vi } from 'vitest';
import { catchUpMessages, latestMessageId, mergeMessages } from './messages.js';

function message(id: string, createdAt: string): Message {
  return {
    id,
    channelId: 'channel-1',
    author: { id: 'user-1', name: 'Yared', avatarUrl: null },
    content: id,
    file: null,
    createdAt,
  };
}

function page(messages: Message[], nextCursor: string | null): MessagesPage {
  return { messages, nextCursor };
}

describe('chat message recovery', () => {
  it('TC-CHAT-05: catches up in cursor order and removes socket duplicates', async () => {
    const initial = [message('m1', '2026-10-24T08:00:00.000Z'), message('m2', '2026-10-24T08:01:00.000Z')];
    const fetchAfter = vi.fn<(id: string) => Promise<MessagesPage>>()
      .mockResolvedValueOnce(page([
        message('m2', '2026-10-24T08:01:00.000Z'),
        message('m3', '2026-10-24T08:02:00.000Z'),
      ], 'm3'))
      .mockResolvedValueOnce(page([
        message('m3', '2026-10-24T08:02:00.000Z'),
        message('m4', '2026-10-24T08:03:00.000Z'),
      ], null));

    const recovered = await catchUpMessages(initial, fetchAfter);

    expect(fetchAfter).toHaveBeenNthCalledWith(1, 'm2');
    expect(fetchAfter).toHaveBeenNthCalledWith(2, 'm3');
    expect(recovered.map(({ id }) => id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('TC-CHAT-05: merges out-of-order live and recovered messages by id and timestamp', () => {
    const merged = mergeMessages(
      [message('m2', '2026-10-24T08:02:00.000Z'), message('m1', '2026-10-24T08:01:00.000Z')],
      [message('m2', '2026-10-24T08:02:00.000Z'), message('m3', '2026-10-24T08:03:00.000Z')],
    );

    expect(merged.map(({ id }) => id)).toEqual(['m1', 'm2', 'm3']);
    expect(latestMessageId(merged)).toBe('m3');
  });

  it('TC-CHAT-05: does not request catch-up without a latest message cursor', async () => {
    const fetchAfter = vi.fn<(id: string) => Promise<MessagesPage>>();

    await expect(catchUpMessages([], fetchAfter)).resolves.toEqual([]);
    expect(fetchAfter).not.toHaveBeenCalled();
  });
});
