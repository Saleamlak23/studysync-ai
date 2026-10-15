import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AiPage } from './pages/AiPage.js';
export const aiRoutes: RouteObject[] = [{ path: '/ai', element: createElement(AiPage) }];
