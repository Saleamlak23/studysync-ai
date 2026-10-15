import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { hashPassword, comparePassword } from '../../lib/password.js';
import { hashRefreshToken, newRefreshToken, newTokenFamilyId, signAccessToken } from '../../lib/tokens.js';
import { env } from '../../config/env.js';
import { parseDuration } from './auth.cookies.js';
const publicUser = (user: { id: string; name: string; email: string; avatarUrl: string | null; bio: string | null; systemRole: string; status: string; createdAt: Date; updatedAt: Date }) => ({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, bio: user.bio, systemRole: user.systemRole, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt });
async function persistRefreshToken(userId: string, token: string, familyId: string) {
  await prisma.refreshToken.create({ data: { userId, tokenHash: hashRefreshToken(token), familyId, expiresAt: new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_TTL)) } });
}
export async function register(input: { name: string; email: string; password: string }) {
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw Errors.conflict('Email already exists');
  const user = await prisma.user.create({ data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) } });
  const refreshToken = newRefreshToken();
  await persistRefreshToken(user.id, refreshToken, newTokenFamilyId());
  return { user: publicUser(user), accessToken: signAccessToken(user.id), refreshToken };
}
export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await comparePassword(input.password, user.passwordHash))) throw Errors.unauthenticated();
  if (user.status === 'SUSPENDED') throw Errors.suspended();
  const refreshToken = newRefreshToken();
  await persistRefreshToken(user.id, refreshToken, newTokenFamilyId());
  return { user: publicUser(user), accessToken: signAccessToken(user.id), refreshToken };
}
export async function rotateRefreshToken(token: string) {
  const tokenHash = hashRefreshToken(token);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!record) return null;
    if (record.revokedAt) {
      await tx.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      return null;
    }
    if (record.expiresAt <= new Date()) return null;
    const user = await tx.user.findUnique({ where: { id: record.userId } });
    if (!user || user.status === 'SUSPENDED') return null;
    const nextToken = newRefreshToken();
    await tx.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    await tx.refreshToken.create({ data: { userId: user.id, familyId: record.familyId, tokenHash: hashRefreshToken(nextToken), expiresAt: new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_TTL)) } });
    return { accessToken: signAccessToken(user.id), refreshToken: nextToken };
  });
  if (!result) throw Errors.unauthenticated();
  return result;
}
export async function logout(token?: string): Promise<void> { if (token) await prisma.refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
export { publicUser };
