import { Router } from 'express';
import {
  createInviteBody,
  inviteCodeParams,
  inviteIdParams,
  workspaceIdParams,
} from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createWorkspaceInvite,
  joinWorkspaceByInvite,
  listWorkspaceInvites,
  revokeWorkspaceInvite,
} from './invites.service.js';

export const invitesRouter = Router();

invitesRouter.post('/workspaces/:id/invites', authenticate, validate({ params: workspaceIdParams, body: createInviteBody }), loadMembership(), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.status(201).json(await createWorkspaceInvite(req.params.id, req.user!.id, req.body));
}));

invitesRouter.get('/workspaces/:id/invites', authenticate, validate({ params: workspaceIdParams }), loadMembership(), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.json(await listWorkspaceInvites(req.params.id));
}));

invitesRouter.delete('/workspaces/:id/invites/:inviteId', authenticate, validate({ params: inviteIdParams }), loadMembership(), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await revokeWorkspaceInvite(req.params.id, req.params.inviteId);
  res.status(204).end();
}));

invitesRouter.post('/invites/:code/join', authenticate, validate({ params: inviteCodeParams }), asyncHandler(async (req, res) => {
  res.json(await joinWorkspaceByInvite(req.user!.id, req.params.code));
}));
