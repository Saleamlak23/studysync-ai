import type { WorkspaceDashboard as WorkspaceDashboardData } from '@studysync/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api.js';

export const workspaceDashboardKeys = {
  detail: (workspaceId: string) => ['workspace-dashboard', workspaceId] as const,
};

export function useWorkspaceDashboard(workspaceId: string) {
  return useQuery({
    queryKey: workspaceDashboardKeys.detail(workspaceId),
    queryFn: () => api<WorkspaceDashboardData>(`/workspaces/${encodeURIComponent(workspaceId)}/dashboard`),
    enabled: Boolean(workspaceId),
  });
}
