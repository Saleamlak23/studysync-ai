import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createInviteBody,
  setWorkspaceAiConsentBody,
  updateMemberRoleBody,
} from '@studysync/shared';
import type { WorkspaceRole } from '@studysync/shared';
import { api } from '@/shared/lib/api.js';

export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string | null;
  myRole: WorkspaceRole;
};

export type WorkspaceCreated = Pick<WorkspaceSummary, 'id' | 'name' | 'description'>;
export type WorkspaceSettings = WorkspaceSummary & { aiEnabled: boolean };
export type WorkspaceMember = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  role: WorkspaceRole;
  joinedAt: string;
};
export type WorkspaceInvite = {
  id: string;
  code: string;
  expiresAt: string | null;
  createdAt: string;
};
export type CreatedWorkspaceInvite = Pick<WorkspaceInvite, 'id' | 'code' | 'expiresAt'>;

export const workspaceKeys = {
  list: ['workspaces'] as const,
  detail: (workspaceId: string) => ['workspaces', workspaceId] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  invites: (workspaceId: string) => ['workspaces', workspaceId, 'invites'] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list,
    queryFn: () => api<WorkspaceSummary[]>('/workspaces'),
  });
}

export function useWorkspaceSettings(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => api<WorkspaceSettings>(`/workspaces/${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
}

export function useWorkspace(workspaceId: string) {
  return useWorkspaceSettings(workspaceId);
}

export function useMyRole(workspaceId: string) {
  const workspaceQuery = useWorkspaceSettings(workspaceId);
  return workspaceQuery.data?.myRole;
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => api<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
    enabled: Boolean(workspaceId),
  });
}

export function useWorkspaceInvites(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.invites(workspaceId),
    queryFn: () => api<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useUpdateWorkspaceMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'ADMIN' | 'MEMBER' }) => {
      const body = updateMemberRoleBody.parse({ role });
      return api<WorkspaceMember>(`/workspaces/${workspaceId}/members/${userId}`, { method: 'PATCH', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}

export function useCreateWorkspaceInvite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const body = createInviteBody.parse({});
      return api<CreatedWorkspaceInvite>(`/workspaces/${workspaceId}/invites`, { method: 'POST', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.invites(workspaceId) }),
  });
}

export function useRevokeWorkspaceInvite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api<void>(`/workspaces/${workspaceId}/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.invites(workspaceId) }),
  });
}

export function useSetWorkspaceAiConsent(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => {
      const body = setWorkspaceAiConsentBody.parse({ enabled });
      return api<{ aiEnabled: boolean; aiConsentAt: string | null }>(`/workspaces/${workspaceId}/ai-consent`, { method: 'PUT', body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  });
}

export function useArchiveWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<WorkspaceSettings>(`/workspaces/${workspaceId}/archive`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.list }),
  });
}
