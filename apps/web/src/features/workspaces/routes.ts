import { createElement, lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoading } from '@/shared/ui/index.js';

const JoinWorkspacePage = lazy(() => import('./pages/JoinWorkspacePage.js').then(({ JoinWorkspacePage: page }) => ({ default: page })));
const WorkspaceSettingsPage = lazy(() => import('./pages/WorkspaceSettingsPage.js').then(({ WorkspaceSettingsPage: page }) => ({ default: page })));
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage.js').then(({ WorkspacesPage: page }) => ({ default: page })));
const pageElement = (Page: LazyExoticComponent<ComponentType>) =>
  createElement(Suspense, { fallback: createElement(PageLoading) }, createElement(Page));

export const workspaceRoutes: RouteObject[] = [
  {
    path: '/w/:workspaceId/settings',
    element: pageElement(WorkspaceSettingsPage),
  },
];

export const workspacesRoutes: RouteObject[] = [
  {
    path: '/workspaces',
    element: pageElement(WorkspacesPage),
  },
  {
    path: '/join/:code',
    element: pageElement(JoinWorkspacePage),
  },
];
