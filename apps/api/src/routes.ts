import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { workspacesRouter } from './modules/workspaces/workspaces.routes.js';
import { invitesRouter } from './modules/workspaces/invites.routes.js';
import { boardRouter } from './modules/board/board.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { aiRouter, createAiRouter, type AIProviders } from './modules/ai/ai.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
export function createApiRouter(aiProviders?: AIProviders) {
  const router = Router();
  router.use('/auth', authRouter);
  router.use(profileRouter);
  router.use('/workspaces', workspacesRouter);
  router.use(invitesRouter);
  router.use(boardRouter);
  router.use(chatRouter);
  router.use(filesRouter);
  router.use('/notifications', notificationsRouter);
  router.use('/workspaces', aiProviders ? createAiRouter(aiProviders) : aiRouter);
  router.use('/workspaces', searchRouter);
  router.use('/workspaces', dashboardRouter);
  router.use('/admin', adminRouter);
  return router;
}

export const apiRouter = createApiRouter();
