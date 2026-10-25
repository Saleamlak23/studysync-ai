import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api.js';

export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string | null;
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type WorkspaceCreated = Pick<WorkspaceSummary, 'id' | 'name' | 'description'>;

export const workspaceKeys = {
  list: ['workspaces'] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list,
    queryFn: () => api<WorkspaceSummary[]>('/workspaces'),
  });
}
