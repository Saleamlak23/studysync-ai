import { Router } from 'express';
import { aiAskBody, aiSummarizeBody, breakdownBody, breakdownConfirmBody, workspaceIdParams } from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import type { AIProvider } from './providers/types.js';
import { askAI, confirmBreakdown, previewBreakdown, summarizeAI } from './features.service.js';

export type AIProviders = { primary?: AIProvider; fallback?: AIProvider };

export function createAiRouter(providers?: AIProviders) {
  const router = Router();
  router.use(authenticate);

  router.post('/:id/ai/ask', validate({ params: workspaceIdParams, body: aiAskBody }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
    res.json(await askAI(req.user!.id, req.params.id, req.body, providers));
  }));

  router.post('/:id/ai/summarize', validate({ params: workspaceIdParams, body: aiSummarizeBody }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
    res.json(await summarizeAI(req.user!.id, req.params.id, req.body.target, providers));
  }));

  router.post('/:id/ai/breakdown', validate({ params: workspaceIdParams, body: breakdownBody }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
    res.json(await previewBreakdown(req.user!.id, req.params.id, req.body, providers));
  }));

  router.post('/:id/ai/breakdown/confirm', validate({ params: workspaceIdParams, body: breakdownConfirmBody }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
    res.status(201).json(await confirmBreakdown(req.params.id, req.user!.id, req.body));
  }));

  return router;
}

export const aiRouter = createAiRouter();
