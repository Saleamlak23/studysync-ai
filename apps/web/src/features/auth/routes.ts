import { createElement, lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoading } from '@/shared/ui/index.js';

const AuthPage = lazy(() => import('./pages/AuthPage.js').then(({ AuthPage: page }) => ({ default: page })));
const authPage = createElement(Suspense, { fallback: createElement(PageLoading) }, createElement(AuthPage));

export const authRoutes: RouteObject[] = [
  { path: '/login', element: authPage },
  { path: '/register', element: authPage },
];
