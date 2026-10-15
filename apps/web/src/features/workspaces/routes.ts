import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { WorkspacesPage } from './pages/WorkspacesPage.js';
export const workspacesRoutes: RouteObject[] = [{ path: '/workspaces', element: createElement(WorkspacesPage) }, { path: '/join/:code', element: createElement(WorkspacesPage) }, { path: '/w/:workspaceId/settings', element: createElement(WorkspacesPage) }];
