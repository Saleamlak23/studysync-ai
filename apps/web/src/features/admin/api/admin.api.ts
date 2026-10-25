import type {
  AdminAiUsageQuery,
  AdminUsersQuery,
  AiLimitsResponse,
  AiUsageResponse,
  PatchUserStatusBody,
  UpdateAiLimitsBody,
} from '@studysync/shared';
import { api } from '@/shared/lib/api.js';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  systemRole: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
};

export function getAdminUsers(query: AdminUsersQuery): Promise<AdminUser[]> {
  return api<AdminUser[]>('/admin/users', { query });
}

export function updateAdminUserStatus(
  userId: string,
  body: PatchUserStatusBody,
): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${userId}`, { method: 'PATCH', body });
}

export function getAdminAiUsage(query: AdminAiUsageQuery): Promise<AiUsageResponse> {
  return api<AiUsageResponse>('/admin/ai-usage', { query });
}

export function getAdminAiLimits(): Promise<AiLimitsResponse> {
  return api<AiLimitsResponse>('/admin/ai-limits');
}

export function updateAdminAiLimits(body: UpdateAiLimitsBody): Promise<AiLimitsResponse> {
  return api<AiLimitsResponse>('/admin/ai-limits', { method: 'PUT', body });
}
