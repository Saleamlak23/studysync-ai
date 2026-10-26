import { describe, expect, it } from 'vitest';
import {
  afterCardId,
  applyCardMoved,
  moveCardLocally,
  type BoardCard,
  type BoardData,
} from './board.api.js';

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
    { id: 'list-1', boardId: 'board-1', name: 'To do', position: 1024, cards: [card('card-a', 'list-1', 1024), card('card-b', 'list-1', 2048)] },
    { id: 'list-2', boardId: 'board-1', name: 'Done', position: 2048, cards: [card('card-c', 'list-2', 1024)] },
  ],
};

describe('board move helpers', () => {
  it('TC-TASK-03: calculates afterCardId for the top, middle, bottom and empty list', () => {
    const cards = board.lists[0]!.cards;
    expect(afterCardId(cards, 'card-a')).toBeNull();
    expect(afterCardId(cards, 'card-b')).toBe('card-a');
    expect(afterCardId(cards, 'card-a', true)).toBe('card-a');
    expect(afterCardId(cards, null)).toBe('card-b');
    expect(afterCardId([], null)).toBeNull();
  });

  it('TC-TASK-03: moves a card optimistically across lists without changing server positions', () => {
    const next = moveCardLocally(board, { cardId: 'card-a', toListId: 'list-2', afterCardId: 'card-c' });
    expect(next.lists[0]!.cards.map(({ id }) => id)).toEqual(['card-b']);
    expect(next.lists[1]!.cards.map(({ id }) => id)).toEqual(['card-c', 'card-a']);
    expect(next.lists[1]!.cards[1]!.position).toBe(1024);
  });

  it('TC-TASK-03: applies a server move position and orders the destination list', () => {
    const moved = applyCardMoved(board, { cardId: 'card-a', toListId: 'list-2', position: 1536 });
    expect(moved.lists[0]!.cards.map(({ id }) => id)).toEqual(['card-b']);
    expect(moved.lists[1]!.cards.map(({ id }) => id)).toEqual(['card-c', 'card-a']);
    expect(moved.lists[1]!.cards[1]!.position).toBe(1536);
  });
});
