import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api.js';
import { askAi, summarizeAi, type AskAiInput, type SummarizeAiInput } from './ai.api.js';

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
