import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage.js';
import { AdminAiUsagePage } from './pages/AdminAiUsagePage.js';

export const adminRoutes: RouteObject[] = [
  { path: '/admin', element: createElement(AdminPage) },
  { path: '/admin/ai-usage', element: createElement(AdminAiUsagePage) },
];
