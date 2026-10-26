import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardKeys, useMoveBoardCard, type BoardCard, type BoardData } from './board.api.js';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/shared/lib/api.js', () => ({ api: apiMock }));

const card = (id: string, listId: string, position: number): BoardCard => ({
  id,
  listId,
  position,
  title: id,
  priority: 'LOW',
  assignees: [],
});
const initialBoard: BoardData = {
  board: { id: 'board-1', workspaceId: '00000000-0000-4000-8000-000000000001', name: 'Board' },
  lists: [
    { id: '00000000-0000-4000-8000-000000000002', boardId: 'board-1', name: 'To do', position: 1024, cards: [card('card-a', '00000000-0000-4000-8000-000000000002', 1024)] },
    { id: '00000000-0000-4000-8000-000000000003', boardId: 'board-1', name: 'Done', position: 2048, cards: [] },
  ],
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(boardKeys.detail('00000000-0000-4000-8000-000000000001'), initialBoard);
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useMoveBoardCard('00000000-0000-4000-8000-000000000001'), { wrapper });
  return { ...hook, queryClient };
}

describe('board card move mutation', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('TC-TASK-03: sends the documented neighbor body and rolls back an optimistic move on API error', async () => {
    let rejectMove!: (error: Error) => void;
    apiMock.mockReturnValue(new Promise((_resolve, reject) => { rejectMove = reject; }));
    const { result, queryClient } = setup();
    let mutation!: Promise<unknown>;

    act(() => {
      mutation = result.current.mutateAsync({ cardId: 'card-a', toListId: '00000000-0000-4000-8000-000000000003', afterCardId: null });
    });
    await waitFor(() => {
      const current = queryClient.getQueryData<BoardData>(boardKeys.detail('00000000-0000-4000-8000-000000000001'))!;
      expect(current.lists[0]!.cards).toHaveLength(0);
      expect(current.lists[1]!.cards[0]!.id).toBe('card-a');
    });
    expect(apiMock).toHaveBeenCalledWith('/cards/card-a/move', {
      method: 'POST',
      body: { toListId: '00000000-0000-4000-8000-000000000003' },
    });

    await act(async () => {
      rejectMove(new Error('move rejected'));
      await expect(mutation).rejects.toThrow('move rejected');
    });
    expect(queryClient.getQueryData(boardKeys.detail('00000000-0000-4000-8000-000000000001'))).toEqual(initialBoard);
  });
});
