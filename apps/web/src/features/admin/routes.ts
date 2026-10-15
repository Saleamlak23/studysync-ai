import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage.js';
export const adminRoutes: RouteObject[] = [{ path: '/admin', element: createElement(AdminPage) }];
