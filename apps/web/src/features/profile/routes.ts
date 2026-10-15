import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ProfilePage } from './pages/ProfilePage.js';
export const profileRoutes: RouteObject[] = [{ path: '/profile', element: createElement(ProfilePage) }];
