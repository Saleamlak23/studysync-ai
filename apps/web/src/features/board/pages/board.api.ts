import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Priority } from '@studysync/shared';
import {
  createCardBody,
  createCommentBody,
  createListBody,
  moveCardBody,
  moveListBody,
  patchCardBody,
  patchListBody,
} from '@studysync/shared';
import { api } from '@/shared/lib/api.js';

export type BoardCard = {
  id: string;
  listId: string;
  position: number;
  title: string;
  priority: Priority;
  assignees: Array<{ userId: string; user: { id: string; name: string; email: string; avatarUrl: string | null } }>;
};

export type BoardListSummary = { id: string; boardId: string; name: string; position: number };
export type BoardList = BoardListSummary & { cards: BoardCard[] };
export type BoardData = {
  board: { id: string; workspaceId: string; name: string };
  lists: BoardList[];
};

export type BoardLabel = { id: string; workspaceId: string; name: string; color: string };
export type BoardCardDetails = BoardCard & {
  description: string | null;
  dueDate: string | null;
  createdById: string | null;
  labels: Array<{ cardId: string; labelId: string; label: BoardLabel }>;
};
export type BoardMember = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
};
export type CardComment = {
  id: string;
  cardId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
};

export const cardKeys = {
  detail: (cardId: string) => ['board-card', cardId] as const,
  comments: (cardId: string) => ['board-card', cardId, 'comments'] as const,
  members: (workspaceId: string) => ['board-card-options', workspaceId, 'members'] as const,
  labels: (workspaceId: string) => ['board-card-options', workspaceId, 'labels'] as const,
};

export type MoveCardInput = { cardId: string; toListId: string; afterCardId: string | null };

export const boardKeys = {
  detail: (workspaceId: string) => ['board', workspaceId] as const,
};

export function useBoard(workspaceId: string) {
  return useQuery({
    queryKey: boardKeys.detail(workspaceId),
    queryFn: () => api<BoardData>(`/workspaces/${workspaceId}/board`),
    enabled: Boolean(workspaceId),
  });
}

export function useBoardCard(cardId: string | null) {
  return useQuery({
    queryKey: cardKeys.detail(cardId ?? ''),
    queryFn: () => api<BoardCardDetails>(`/cards/${cardId}`),
    enabled: Boolean(cardId),
  });
}

export function useBoardCardMembers(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: cardKeys.members(workspaceId),
    queryFn: () => api<BoardMember[]>(`/workspaces/${workspaceId}/members`),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useBoardCardLabels(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: cardKeys.labels(workspaceId),
    queryFn: () => api<BoardLabel[]>(`/workspaces/${workspaceId}/labels`),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useBoardCardComments(cardId: string | null) {
  return useQuery({
    queryKey: cardKeys.comments(cardId ?? ''),
    queryFn: () => api<CardComment[]>(`/cards/${cardId}/comments`),
    enabled: Boolean(cardId),
  });
}

export function useCreateBoardCard(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: unknown }) => {
      const body = createCardBody.parse(input);
      return api<BoardCardDetails>(`/lists/${listId}/cards`, { method: 'POST', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) }),
  });
}

export function useUpdateBoardCard(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: unknown }) => {
      const body = patchCardBody.parse(input);
      return api<BoardCardDetails>(`/cards/${cardId}`, { method: 'PATCH', body });
    },
    onSuccess: (card) => {
      queryClient.setQueryData(cardKeys.detail(card.id), card);
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) });
    },
  });
}

export function useDeleteBoardCard(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => api<void>(`/cards/${cardId}`, { method: 'DELETE' }),
    onSuccess: (_result, cardId) => {
      queryClient.removeQueries({ queryKey: cardKeys.detail(cardId) });
      queryClient.removeQueries({ queryKey: cardKeys.comments(cardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) });
    },
  });
}

export function useCreateBoardCardComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, mentionIds }: { body: string; mentionIds: string[] }) => {
      const input = createCommentBody.parse({ body, ...(mentionIds.length ? { mentionIds } : {}) });
      return api<CardComment>(`/cards/${cardId}/comments`, { method: 'POST', body: input });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.comments(cardId) }),
  });
}

export function useDeleteBoardCardComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api<void>(`/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.comments(cardId) }),
  });
}

export function useCreateBoardList(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      const body = createListBody.parse({ name });
      return api<BoardListSummary>(`/workspaces/${workspaceId}/lists`, { method: 'POST', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) }),
  });
}

export function useRenameBoardList(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) => {
      const body = patchListBody.parse({ name });
      return api<BoardListSummary>(`/lists/${listId}`, { method: 'PATCH', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) }),
  });
}

export function useDeleteBoardList(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => api<void>(`/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) }),
  });
}

export function useMoveBoardList(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, afterListId }: { listId: string; afterListId?: string }) => {
      const body = moveListBody.parse({ afterListId });
      return api<BoardListSummary>(`/lists/${listId}/move`, { method: 'POST', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.detail(workspaceId) }),
  });
}

export function useMoveBoardCard(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = boardKeys.detail(workspaceId);

  return useMutation({
    mutationFn: ({ cardId, toListId, afterCardId }: MoveCardInput) => {
      const body = moveCardBody.parse({ toListId, ...(afterCardId ? { afterCardId } : {}) });
      return api<BoardCard>(`/cards/${cardId}/move`, { method: 'POST', body });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardData>(queryKey);
      queryClient.setQueryData<BoardData>(queryKey, (current) => current && moveCardLocally(current, input));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (card) => {
      queryClient.setQueryData<BoardData>(queryKey, (current) => current && applyCardUpserted(current, card));
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function afterCardId(
  cards: BoardCard[],
  overCardId: string | null,
  insertAfter = false,
): string | null {
  if (overCardId === null) return cards.at(-1)?.id ?? null;
  const targetIndex = cards.findIndex((card) => card.id === overCardId);
  if (targetIndex < 0) return cards.at(-1)?.id ?? null;
  if (insertAfter) return overCardId;
  return cards[targetIndex - 1]?.id ?? null;
}

export function moveCardLocally(board: BoardData, input: MoveCardInput): BoardData {
  const sourceList = board.lists.find((list) => list.cards.some((card) => card.id === input.cardId));
  const targetList = board.lists.find((list) => list.id === input.toListId);
  if (!sourceList || !targetList) return board;

  const card = sourceList.cards.find((item) => item.id === input.cardId);
  if (!card) return board;
  const listsWithoutCard = board.lists.map((list) => ({
    ...list,
    cards: list.cards.filter((item) => item.id !== input.cardId),
  }));
  const nextTarget = listsWithoutCard.find((list) => list.id === input.toListId);
  if (!nextTarget) return board;

  const insertIndex = input.afterCardId === null
    ? 0
    : nextTarget.cards.findIndex((item) => item.id === input.afterCardId) + 1;
  if (input.afterCardId !== null && insertIndex === 0) return board;

  const nextLists = listsWithoutCard.map((list) => list.id === input.toListId
    ? { ...list, cards: [...list.cards.slice(0, insertIndex), { ...card, listId: input.toListId }, ...list.cards.slice(insertIndex)] }
    : list);
  return { ...board, lists: nextLists };
}

export function applyCardMoved(board: BoardData, event: { cardId: string; toListId: string; position: number }): BoardData {
  const source = board.lists.find((list) => list.cards.some((card) => card.id === event.cardId));
  const destination = board.lists.find((list) => list.id === event.toListId);
  if (!source || !destination) return board;
  const card = source.cards.find((item) => item.id === event.cardId);
  if (!card) return board;

  const nextLists = board.lists.map((list) => {
    const remaining = list.cards.filter((item) => item.id !== event.cardId);
    if (list.id !== event.toListId) return { ...list, cards: remaining };
    return {
      ...list,
      cards: [...remaining, { ...card, listId: event.toListId, position: event.position }]
        .sort((left, right) => left.position - right.position),
    };
  });
  return { ...board, lists: nextLists };
}

export function applyCardUpserted(board: BoardData, card: BoardCard): BoardData {
  if (!board.lists.some((list) => list.id === card.listId)) return board;
  return {
    ...board,
    lists: board.lists.map((list) => {
      const remaining = list.cards.filter((item) => item.id !== card.id);
      return list.id === card.listId
        ? { ...list, cards: [...remaining, card].sort((left, right) => left.position - right.position) }
        : { ...list, cards: remaining };
    }),
  };
}

export function applyCardDeleted(board: BoardData, cardId: string): BoardData {
  return {
    ...board,
    lists: board.lists.map((list) => ({ ...list, cards: list.cards.filter((card) => card.id !== cardId) })),
  };
}
