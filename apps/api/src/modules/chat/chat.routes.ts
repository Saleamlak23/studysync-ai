import { Router } from 'express';
import {
  channelIdParams,
  createChannelBody,
  createMessageBody,
  listMessagesQuery,
  workspaceIdParams,
} from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership, withWorkspace } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { createChannel, deleteChannel, getChannelWorkspaceId, listChannels } from './channels.service.js';
import { createMessage, listMessages } from './messages.service.js';

export const chatRouter = Router();
chatRouter.use(authenticate);

chatRouter.get('/workspaces/:id/channels', validate({ params: workspaceIdParams }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await listChannels(req.params.id));
}));

chatRouter.post('/workspaces/:id/channels', validate({ params: workspaceIdParams, body: createChannelBody }), loadMembership(), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.status(201).json(await createChannel(req.params.id, req.body));
}));

chatRouter.delete('/channels/:id', validate({ params: channelIdParams }), withWorkspace((req) => getChannelWorkspaceId(req.params.id)), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await deleteChannel(req.params.id);
  res.status(204).end();
}));

chatRouter.get('/channels/:id/messages', validate({ params: channelIdParams, query: listMessagesQuery }), withWorkspace((req) => getChannelWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await listMessages(req.params.id, req.query));
}));

chatRouter.post('/channels/:id/messages', validate({ params: channelIdParams, body: createMessageBody }), withWorkspace((req) => getChannelWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.status(201).json(await createMessage(req.params.id, req.user!.id, req.body));
}));
