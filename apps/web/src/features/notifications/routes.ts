import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { NotificationsPage } from './pages/NotificationsPage.js';
export const notificationsRoutes: RouteObject[] = [{ path: '/notifications', element: createElement(NotificationsPage) }];
