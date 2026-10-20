import { Router } from 'express';
import {
  createWorkspaceBody,
  workspaceMemberParams,
  patchWorkspaceBody,
  setWorkspaceAiConsentBody,
  updateMemberRoleBody,
  workspaceIdParams,
} from '@studysync/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  archiveWorkspace,
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  restoreWorkspace,
  setWorkspaceAiConsent,
  updateWorkspace,
} from './workspaces.service.js';
import { listWorkspaceMembers, removeWorkspaceMember, updateMemberRole } from './members.service.js';

export const workspacesRouter = Router();
workspacesRouter.use(authenticate);

workspacesRouter.post('/', validate({ body: createWorkspaceBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await createWorkspace(req.user!.id, req.body));
}));

workspacesRouter.get('/', asyncHandler(async (req, res) => {
  res.json(await listWorkspaces(req.user!.id));
}));

workspacesRouter.get('/:id', validate({ params: workspaceIdParams }), loadMembership(), asyncHandler(async (req, res) => {
  res.json(await getWorkspace(req.user!.id, req.params.id));
}));

workspacesRouter.patch('/:id', validate({ params: workspaceIdParams, body: patchWorkspaceBody }), loadMembership(), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.json(await updateWorkspace(req.params.id, req.body));
}));

workspacesRouter.post('/:id/archive', validate({ params: workspaceIdParams }), loadMembership(), requireRole('OWNER'), asyncHandler(async (req, res) => {
  res.json(await archiveWorkspace(req.params.id));
}));

workspacesRouter.post('/:id/restore', validate({ params: workspaceIdParams }), asyncHandler(async (req, res) => {
  res.json(await restoreWorkspace(req.user!.id, req.params.id));
}));

workspacesRouter.put('/:id/ai-consent', validate({ params: workspaceIdParams, body: setWorkspaceAiConsentBody }), loadMembership(), requireRole('OWNER'), asyncHandler(async (req, res) => {
  res.json(await setWorkspaceAiConsent(req.user!.id, req.params.id, req.body));
}));

workspacesRouter.get('/:id/members', validate({ params: workspaceIdParams }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await listWorkspaceMembers(req.params.id));
}));

workspacesRouter.patch('/:id/members/:userId', validate({ params: workspaceMemberParams, body: updateMemberRoleBody }), loadMembership(), requireRole('OWNER'), asyncHandler(async (req, res) => {
  res.json(await updateMemberRole(req.params.id, req.params.userId, req.body));
}));

workspacesRouter.delete('/:id/members/:userId', validate({ params: workspaceMemberParams }), loadMembership(), asyncHandler(async (req, res) => {
  await removeWorkspaceMember(req.params.id, req.user!.id, req.membership!.role, req.params.userId);
  res.status(204).end();
}));
