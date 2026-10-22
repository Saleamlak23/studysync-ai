import express from 'express';
import { env } from './config/env.js';
import { createApiRouter } from './routes.js';
import type { AIProviders } from './modules/ai/ai.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
export function createApp(options: { aiProviders?: AIProviders } = {}) {
  const app = express();
  app.use((req, res, next) => { res.header('Access-Control-Allow-Origin', env.CLIENT_ORIGIN); res.header('Access-Control-Allow-Credentials', 'true'); res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS'); if (req.method === 'OPTIONS') { res.sendStatus(204); return; } next(); });
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1', createApiRouter(options.aiProviders));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
