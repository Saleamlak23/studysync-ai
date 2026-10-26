import { createElement, lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoading } from '@/shared/ui/index.js';

const BoardPage = lazy(() => import('./pages/BoardPage.js').then(({ BoardPage: page }) => ({ default: page })));

export const boardRoutes: RouteObject[] = [
  {
    path: '/w/:workspaceId/board',
    element: createElement(Suspense, { fallback: createElement(PageLoading) }, createElement(BoardPage)),
  },
];
