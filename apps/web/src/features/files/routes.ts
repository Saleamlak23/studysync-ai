import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { FilesPage } from './pages/FilesPage.js';
export const filesRoutes: RouteObject[] = [{ path: '/files', element: createElement(FilesPage) }];
