import { createElement, lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoading } from '@/shared/ui/index.js';

const SearchPage = lazy(() => import('./pages/SearchPage.js').then(({ SearchPage: page }) => ({ default: page })));

export const searchRoutes: RouteObject[] = [
  {
    path: '/search',
    element: createElement(Suspense, { fallback: createElement(PageLoading) }, createElement(SearchPage)),
  },
];
