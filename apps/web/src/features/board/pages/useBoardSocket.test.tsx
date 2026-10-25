import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardKeys, type BoardCard, type BoardData } from './board.api.js';
import { useBoardSocket } from './useBoardSocket.js';

const socketState = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  reconnect: null as null | (() => void),
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('@/shared/lib/socket.js', () => ({
  getSocket: () => ({
    on: (event: string, handler: (payload: unknown) => void) => {
      socketState.handlers.set(event, handler);
      socketState.on(event, handler);
    },
    off: (event: string, handler: (payload: unknown) => void) => {
      if (socketState.handlers.get(event) === handler) socketState.handlers.delete(event);
      socketState.off(event, handler);
    },
  }),
  useOnReconnect: (listener: () => void) => { socketState.reconnect = listener; },
}));
vi.mock('@/shared/hooks/useWorkspaceSocket.js', () => ({ useWorkspaceSocket: vi.fn() }));

const card = (id: string, listId: string, position: number): BoardCard => ({
  id,
  listId,
  position,
  title: id,
  priority: 'LOW',
  assignees: [],
});
const board: BoardData = {
  board: { id: 'board-1', workspaceId: 'workspace-1', name: 'Board' },
  lists: [
    { id: 'list-1', boardId: 'board-1', name: 'To do', position: 1024, cards: [card('card-a', 'list-1', 1024)] },
    { id: 'list-2', boardId: 'board-1', name: 'Done', position: 2048, cards: [] },
  ],
};

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(boardKeys.detail('workspace-1'), board);
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useBoardSocket('workspace-1'), { wrapper });
  return { ...hook, queryClient };
}

describe('board socket updates', () => {
  afterEach(() => {
    cleanup();
    socketState.handlers.clear();
    socketState.reconnect = null;
    socketState.on.mockClear();
    socketState.off.mockClear();
  });

  it('TC-TASK-04: applies card create, update, move and delete events to the board cache', () => {
    const { queryClient, unmount } = setup();
    const key = boardKeys.detail('workspace-1');
    const created = card('card-b', 'list-1', 2048);

    act(() => socketState.handlers.get('board:card_created')?.(created));
    expect(queryClient.getQueryData<BoardData>(key)?.lists[0]!.cards.map(({ id }) => id)).toEqual(['card-a', 'card-b']);
    act(() => socketState.handlers.get('board:card_updated')?.({ ...created, title: 'Updated' }));
    expect(queryClient.getQueryData<BoardData>(key)?.lists[0]!.cards[1]!.title).toBe('Updated');
    act(() => socketState.handlers.get('board:card_moved')?.({ cardId: 'card-a', fromListId: 'list-1', toListId: 'list-2', position: 1024 }));
    expect(queryClient.getQueryData<BoardData>(key)?.lists[1]!.cards[0]!.id).toBe('card-a');
    act(() => socketState.handlers.get('board:card_deleted')?.({ cardId: 'card-a', listId: 'list-2' }));
    expect(queryClient.getQueryData<BoardData>(key)?.lists[1]!.cards).toEqual([]);

    unmount();
    expect(socketState.off).toHaveBeenCalledTimes(4);
  });

  it('TC-TASK-04: refetches the board on reconnect and when a move reports renumbered positions', () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => socketState.handlers.get('board:card_moved')?.({
      cardId: 'card-a', fromListId: 'list-1', toListId: 'list-2', position: 1024, renumbered: true,
    }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKeys.detail('workspace-1') });

    invalidate.mockClear();
    act(() => socketState.reconnect?.());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKeys.detail('workspace-1') });
  });
});
