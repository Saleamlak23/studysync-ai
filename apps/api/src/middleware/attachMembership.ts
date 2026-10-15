import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { Errors } from '../lib/errors.js';
export async function attachMembership(req: Request, workspaceId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: req.user!.id, workspaceId } }, include: { workspace: { select: { archivedAt: true, aiEnabled: true } } } });
  if (!membership || membership.workspace.archivedAt) throw Errors.notFound('Workspace');
  req.membership = { workspaceId, role: membership.role, aiEnabled: membership.workspace.aiEnabled };
}
import { prisma } from '../db/prisma.js';
export const loadMembership = (param = 'id'): RequestHandler => asyncHandler(async (req, _res, next) => { await attachMembership(req, req.params[param]); next(); });
export const withWorkspace = (resolve: (req: Request) => Promise<string>): RequestHandler => asyncHandler(async (req, _res, next) => { await attachMembership(req, await resolve(req)); next(); });
