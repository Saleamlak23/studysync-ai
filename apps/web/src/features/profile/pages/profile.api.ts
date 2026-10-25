import { patchProfileBody } from '@studysync/shared';
import type { SessionUser } from '@/shared/lib/session.js';
import { api } from '@/shared/lib/api.js';

export async function updateProfile(input: unknown): Promise<SessionUser> {
  const body = patchProfileBody.parse(input);
  return api<SessionUser>('/me', { method: 'PATCH', body });
}
