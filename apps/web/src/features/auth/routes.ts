import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage.js';
export const authRoutes: RouteObject[] = [{ path: '/login', element: createElement(AuthPage) }, { path: '/register', element: createElement(AuthPage) }];
