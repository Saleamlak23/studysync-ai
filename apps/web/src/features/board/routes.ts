import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { BoardPage } from './pages/BoardPage.js';
export const boardRoutes: RouteObject[] = [{ path: '/w/:workspaceId/board', element: createElement(BoardPage) }];
