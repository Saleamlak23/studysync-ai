import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { authenticateSocket } from './auth.js';
import { boardRoom, channelRoom, userRoom, workspaceRoom } from './rooms.js';
import { prisma } from '../db/prisma.js';
let io: Server | undefined;
export function initIo(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: env.CLIENT_ORIGIN, credentials: true } });
  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.userId as string));
    socket.on('workspace:join', async (payload: { workspaceId: string }, ack?: (result: { ok: boolean }) => void) => {
      try {
        const membership = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: socket.data.userId as string, workspaceId: payload.workspaceId } }, include: { workspace: { select: { archivedAt: true } } } });
        if (!membership || membership.workspace.archivedAt) { ack?.({ ok: false }); return; }
        await socket.join([workspaceRoom(payload.workspaceId), boardRoom(payload.workspaceId)]);
        ack?.({ ok: true });
      } catch { ack?.({ ok: false }); }
    });
    socket.on('channel:join', async (payload: { channelId: string }) => {
      const channel = await prisma.channel.findUnique({ where: { id: payload.channelId }, select: { workspaceId: true, workspace: { select: { archivedAt: true } } } });
      if (!channel || channel.workspace.archivedAt) return;
      const membership = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: socket.data.userId as string, workspaceId: channel.workspaceId } } });
      if (membership) await socket.join(channelRoom(payload.channelId));
    });
    socket.on('channel:leave', async (payload: { channelId: string }) => { await socket.leave(channelRoom(payload.channelId)); });
  });
  return io;
}
export function getIo(): Server { if (!io) throw new Error('Socket.io has not been initialized'); return io; }
