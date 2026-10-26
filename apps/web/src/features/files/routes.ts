import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { FilesPage, WorkspaceFilesPage } from './pages/FilesPage.js';
export const filesRoutes: RouteObject[] = [{ path: '/files', element: createElement(FilesPage) }];
export const workspaceFilesRoutes: RouteObject[] = [{ path: '/w/:workspaceId/files', element: createElement(WorkspaceFilesPage) }];
