import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';
export const dashboardRoutes: RouteObject[] = [{ path: '/', element: createElement(DashboardPage) }, { path: '/w/:workspaceId', element: createElement(DashboardPage) }];
