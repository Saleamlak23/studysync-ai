import { useCallback, useEffect } from 'react';
import type { CardDeletedPayload, CardMovedPayload } from '@studysync/shared';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, useOnReconnect } from '@/shared/lib/socket.js';
import { useWorkspaceSocket } from '@/shared/hooks/useWorkspaceSocket.js';
import {
  applyCardDeleted,
  applyCardMoved,
  applyCardUpserted,
  boardKeys,
  type BoardCard,
  type BoardData,
} from './board.api.js';

export function useBoardSocket(workspaceId: string): void {
  const queryClient = useQueryClient();
  const queryKey = boardKeys.detail(workspaceId);
  useWorkspaceSocket(workspaceId);

  const refetchBoard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  useOnReconnect(refetchBoard);

  useEffect(() => {
    const socket = getSocket();
    const onMoved = (event: CardMovedPayload) => {
      if (event.renumbered) {
        refetchBoard();
        return;
      }
      queryClient.setQueryData<BoardData>(queryKey, (board) => board && applyCardMoved(board, event));
    };
    const onCreatedOrUpdated = (value: unknown) => {
      queryClient.setQueryData<BoardData>(queryKey, (board) => board && applyCardUpserted(board, value as BoardCard));
    };
    const onDeleted = (event: CardDeletedPayload) => {
      queryClient.setQueryData<BoardData>(queryKey, (board) => board && applyCardDeleted(board, event.cardId));
    };

    socket.on('board:card_moved', onMoved);
    socket.on('board:card_created', onCreatedOrUpdated);
    socket.on('board:card_updated', onCreatedOrUpdated);
    socket.on('board:card_deleted', onDeleted);
    return () => {
      socket.off('board:card_moved', onMoved);
      socket.off('board:card_created', onCreatedOrUpdated);
      socket.off('board:card_updated', onCreatedOrUpdated);
      socket.off('board:card_deleted', onDeleted);
    };
  }, [queryClient, queryKey, refetchBoard]);
}
