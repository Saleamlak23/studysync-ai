import { Router } from 'express';
import {
  cardIdParams,
  commentIdParams,
  createCommentBody,
  createCardBody,
  createLabelBody,
  createListBody,
  listIdParams,
  moveListBody,
  moveCardBody,
  patchCardBody,
  patchListBody,
  workspaceIdParams,
} from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership, withWorkspace } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { getBoard } from './board.service.js';
import { createCard, deleteCard, getCard, getCardWorkspaceId, moveCard, updateCard } from './cards.service.js';
import { createComment, deleteComment, getCommentWorkspaceId, listCardComments } from './comments.service.js';
import { createLabel, listWorkspaceLabels } from './labels.service.js';
import { createList, deleteList, getListWorkspaceId, moveList, renameList } from './lists.service.js';

export const boardRouter = Router();
boardRouter.use(authenticate);

boardRouter.get('/workspaces/:id/board', validate({ params: workspaceIdParams }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await getBoard(req.params.id));
}));

boardRouter.post('/workspaces/:id/lists', validate({ params: workspaceIdParams, body: createListBody }), loadMembership(), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.status(201).json(await createList(req.params.id, req.body));
}));

boardRouter.patch('/lists/:id', validate({ params: listIdParams, body: patchListBody }), withWorkspace((req) => getListWorkspaceId(req.params.id)), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.json(await renameList(req.params.id, req.body));
}));

boardRouter.post('/lists/:id/move', validate({ params: listIdParams, body: moveListBody }), withWorkspace((req) => getListWorkspaceId(req.params.id)), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  res.json(await moveList(req.params.id, req.body));
}));

boardRouter.delete('/lists/:id', validate({ params: listIdParams }), withWorkspace((req) => getListWorkspaceId(req.params.id)), requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await deleteList(req.params.id);
  res.status(204).end();
}));

boardRouter.post('/lists/:id/cards', validate({ params: listIdParams, body: createCardBody }), withWorkspace((req) => getListWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.status(201).json(await createCard(req.params.id, req.user!.id, req.body));
}));

boardRouter.get('/cards/:id', validate({ params: cardIdParams }), withWorkspace((req) => getCardWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await getCard(req.params.id));
}));

boardRouter.patch('/cards/:id', validate({ params: cardIdParams, body: patchCardBody }), withWorkspace((req) => getCardWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await updateCard(req.params.id, req.body));
}));

boardRouter.post('/cards/:id/move', validate({ params: cardIdParams, body: moveCardBody }), withWorkspace((req) => getCardWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await moveCard(req.params.id, req.body));
}));

boardRouter.delete('/cards/:id', validate({ params: cardIdParams }), withWorkspace((req) => getCardWorkspaceId(req.params.id)), asyncHandler(async (req, res) => {
  await deleteCard(req.params.id, req.user!.id, req.membership!.role);
  res.status(204).end();
}));

boardRouter.get('/cards/:id/comments', validate({ params: cardIdParams }), withWorkspace((req) => getCardWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await listCardComments(req.params.id));
}));

boardRouter.post('/cards/:id/comments', validate({ params: cardIdParams, body: createCommentBody }), withWorkspace((req) => getCardWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.status(201).json(await createComment(req.params.id, req.user!.id, req.membership!.workspaceId, req.body));
}));

boardRouter.delete('/comments/:id', validate({ params: commentIdParams }), withWorkspace((req) => getCommentWorkspaceId(req.params.id)), asyncHandler(async (req, res) => {
  await deleteComment(req.params.id, req.user!.id, req.membership!.role);
  res.status(204).end();
}));

boardRouter.get('/workspaces/:id/labels', validate({ params: workspaceIdParams }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await listWorkspaceLabels(req.params.id));
}));

boardRouter.post('/workspaces/:id/labels', validate({ params: workspaceIdParams, body: createLabelBody }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.status(201).json(await createLabel(req.params.id, req.body));
}));
