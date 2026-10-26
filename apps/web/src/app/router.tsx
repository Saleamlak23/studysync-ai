import { createElement, lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { adminRoutes } from '@/features/admin';
import { aiRoutes } from '@/features/ai';
import { authRoutes } from '@/features/auth';
import { boardRoutes } from '@/features/board';
import { chatRoutes } from '@/features/chat';
import { dashboardRoutes, WorkspaceDashboard } from '@/features/dashboard';
import { filesRoutes, workspaceFilesRoutes } from '@/features/files';
import { notificationsRoutes } from '@/features/notifications';
import { profileRoutes } from '@/features/profile';
import { searchRoutes } from '@/features/search';
import { workspaceRoutes, workspacesRoutes } from '@/features/workspaces';
import { PageLoading } from '@/shared/ui/index.js';
import { RequireAuth, RequireSystemAdmin } from './guards/index.js';
import { RouteErrorPage } from './RouteErrorPage.js';

const AuthLayout = lazy(() => import('./layouts/AuthLayout.js').then(({ AuthLayout: layout }) => ({ default: layout })));
const AppShell = lazy(() => import('./layouts/AppShell.js').then(({ AppShell: layout }) => ({ default: layout })));
const WorkspaceLayout = lazy(() => import('./layouts/WorkspaceLayout.js').then(({ WorkspaceLayout: layout }) => ({ default: layout })));
const AdminLayout = lazy(() => import('./layouts/AdminLayout.js').then(({ AdminLayout: layout }) => ({ default: layout })));
const loading = createElement(PageLoading);
const lazyLayout = (Layout: LazyExoticComponent<ComponentType>) =>
  createElement(Suspense, { fallback: loading }, createElement(Layout));

export const router = createBrowserRouter([
  {
    element: lazyLayout(AuthLayout),
    errorElement: <RouteErrorPage />,
    children: authRoutes,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: lazyLayout(AppShell),
        children: [
          ...dashboardRoutes,
          ...workspacesRoutes,
          ...profileRoutes,
          ...searchRoutes,
          ...notificationsRoutes,
          ...filesRoutes,
          ...aiRoutes,
          {
            path: '/w/:workspaceId',
            element: lazyLayout(WorkspaceLayout),
            children: [
              { index: true, element: createElement(WorkspaceDashboard) },
              ...workspaceRoutes,
              ...boardRoutes,
              ...chatRoutes,
              ...workspaceFilesRoutes,
            ],
          },
        ],
      },
      {
        element: <RequireSystemAdmin />,
        children: [
          {
            element: lazyLayout(AdminLayout),
            children: adminRoutes,
          },
        ],
      },
    ],
  },
]);
