import type { RequestHandler } from 'express';
export const notFound: RequestHandler = (_req, _res, next) => next(Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' }));
