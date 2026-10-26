import { createElement, lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoading } from '@/shared/ui/index.js';

const ProfilePage = lazy(() => import('./pages/ProfilePage.js').then(({ ProfilePage: page }) => ({ default: page })));

export const profileRoutes: RouteObject[] = [
  {
    path: '/profile',
    element: createElement(Suspense, { fallback: createElement(PageLoading) }, createElement(ProfilePage)),
  },
];
