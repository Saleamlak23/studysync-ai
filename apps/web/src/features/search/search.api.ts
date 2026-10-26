import { useQuery } from '@tanstack/react-query';
import type { SearchResult } from '@studysync/shared';
import { api } from '@/shared/lib/api.js';

export const searchKeys = {
  workspace: (workspaceId: string, query: string) => ['workspace-search', workspaceId, query] as const,
};

export function useWorkspaceSearch(workspaceId: string, query: string, enabled = true) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: searchKeys.workspace(workspaceId, normalizedQuery),
    queryFn: () => api<SearchResult>(`/workspaces/${workspaceId}/search`, { query: { q: normalizedQuery } }),
    enabled: Boolean(workspaceId) && normalizedQuery.length >= 2 && enabled,
  });
}
