import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Priority } from '@studysync/shared';
import { createListBody, moveListBody, patchListBody } from '@studysync/shared';
import { api } from '@/shared/lib/api.js';

export type BoardCard = {
  id: string;
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
