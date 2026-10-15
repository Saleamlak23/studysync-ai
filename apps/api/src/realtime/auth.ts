import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
export async function authenticateSocket(socket: Socket, next: (error?: Error) => void): Promise<void> {
  try { const token = socket.handshake.auth.token; const { sub } = jwt.verify(token, env.JWT_SECRET) as { sub: string }; const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, status: true } }); if (!user || user.status !== 'ACTIVE') throw new Error('Unauthorized'); socket.data.userId = user.id; next(); }
  catch { next(new Error('Unauthorized')); }
}
