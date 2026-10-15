import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ChatPage } from './pages/ChatPage.js';
export const chatRoutes: RouteObject[] = [{ path: '/w/:workspaceId/chat/:channelId?', element: createElement(ChatPage) }];
