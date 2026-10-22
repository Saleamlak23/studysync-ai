import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { createApiRouter } from './routes.js';
import type { AIProviders } from './modules/ai/ai.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './lib/errors.js';

export function createApp(options: { aiProviders?: AIProviders } = {}) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === env.CLIENT_ORIGIN) {
          callback(null, true);
        } else {
          callback(new AppError(403, 'FORBIDDEN', 'Foreign origin blocked by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1', createApiRouter(options.aiProviders));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
