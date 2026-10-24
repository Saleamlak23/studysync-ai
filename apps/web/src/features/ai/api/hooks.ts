import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api.js';
import {
  askAi,
  confirmBreakdown,
  getWorkspaceBoardLists,
  previewBreakdown,
  summarizeAi,
  type AskAiInput,
  type BreakdownItem,
  type SummarizeAiInput,
} from './ai.api.js';

type WorkspaceAiState = { id: string; aiEnabled: boolean };

export function useWorkspaceAiState(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-ai-consent', workspaceId],
    queryFn: () => api<WorkspaceAiState>(`/workspaces/${encodeURIComponent(workspaceId)}`),
    enabled: Boolean(workspaceId),
  });
}

export function useAskAi(workspaceId: string) {
  return useMutation({
    mutationFn: (input: AskAiInput) => askAi(workspaceId, input),
  });
}

export function useSummarizeAi(workspaceId: string) {
  return useMutation({
    mutationFn: (input: SummarizeAiInput) => summarizeAi(workspaceId, input),
  });
}

export function useWorkspaceBoardLists(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-breakdown-lists', workspaceId],
    queryFn: () => getWorkspaceBoardLists(workspaceId),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function usePreviewBreakdown(workspaceId: string) {
  return useMutation({
    mutationFn: (input: { description: string; listId: string }) => previewBreakdown(workspaceId, input),
  });
}

export function useConfirmBreakdown(workspaceId: string) {
  return useMutation({
    mutationFn: (input: { listId: string; items: BreakdownItem[] }) => confirmBreakdown(workspaceId, input),
  });
}
