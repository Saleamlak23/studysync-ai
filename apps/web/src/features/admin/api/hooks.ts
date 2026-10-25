import type { AdminAiUsageQuery, AdminUsersQuery, UpdateAiLimitsBody } from '@studysync/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminAiLimits,
  getAdminAiUsage,
  getAdminUsers,
  updateAdminAiLimits,
  updateAdminUserStatus,
} from './admin.api.js';

export const adminKeys = {
  users: () => ['admin', 'users'] as const,
  userList: (query: AdminUsersQuery) => [...adminKeys.users(), query] as const,
  aiUsage: () => ['admin', 'ai-usage'] as const,
  aiUsageList: (query: AdminAiUsageQuery) => [...adminKeys.aiUsage(), query] as const,
  aiLimits: () => ['admin', 'ai-limits'] as const,
};

export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: adminKeys.userList(query),
    queryFn: () => getAdminUsers(query),
  });
}

export function useUpdateAdminUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      updateAdminUserStatus(userId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useAdminAiUsage(query: AdminAiUsageQuery) {
  return useQuery({
    queryKey: adminKeys.aiUsageList(query),
    queryFn: () => getAdminAiUsage(query),
  });
}

export function useAdminAiLimits() {
  return useQuery({
    queryKey: adminKeys.aiLimits(),
    queryFn: getAdminAiLimits,
  });
}

export function useUpdateAdminAiLimits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAiLimitsBody) => updateAdminAiLimits(body),
    onSuccess: (limits) => queryClient.setQueryData(adminKeys.aiLimits(), limits),
  });
}
