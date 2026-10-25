import { createBrowserRouter } from 'react-router-dom';
import { adminRoutes } from '@/features/admin';
import { aiRoutes } from '@/features/ai';
import { authRoutes } from '@/features/auth';
import { boardRoutes } from '@/features/board';
import { chatRoutes } from '@/features/chat';
import { dashboardRoutes } from '@/features/dashboard';
import { filesRoutes } from '@/features/files';
import { notificationsRoutes } from '@/features/notifications';
import { profileRoutes } from '@/features/profile';
import { searchRoutes } from '@/features/search';
import { workspaceRoutes, workspacesRoutes } from '@/features/workspaces';
import { RequireAuth, RequireSystemAdmin } from './guards/index.js';
import { AdminLayout, AppShell, AuthLayout, WorkspaceLayout } from './layouts/index.js';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: authRoutes,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
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
            element: <WorkspaceLayout />,
            children: [
              ...workspaceRoutes,
              ...boardRoutes,
              ...chatRoutes,
            ],
          },
        ],
      },
      {
        element: <RequireSystemAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: adminRoutes,
          },
        ],
      },
    ],
  },
]);
