import { Router } from 'express';
import { searchQuery, workspaceIdParams } from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { searchWorkspace } from './search.service.js';

export const searchRouter = Router();
searchRouter.use(authenticate);

searchRouter.get('/:id/search', validate({ params: workspaceIdParams, query: searchQuery }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await searchWorkspace(req.params.id, req.query));
}));
