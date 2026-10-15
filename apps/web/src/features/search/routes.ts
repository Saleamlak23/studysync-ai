import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage.js';
export const searchRoutes: RouteObject[] = [{ path: '/search', element: createElement(SearchPage) }];
