import { createBrowserRouter } from 'react-router-dom';
import { authRoutes } from '@/features/auth';
import { profileRoutes } from '@/features/profile';
import { workspacesRoutes } from '@/features/workspaces';
import { boardRoutes } from '@/features/board';
import { searchRoutes } from '@/features/search';
import { chatRoutes } from '@/features/chat';
import { filesRoutes } from '@/features/files';
import { notificationsRoutes } from '@/features/notifications';
import { aiRoutes } from '@/features/ai';
import { dashboardRoutes } from '@/features/dashboard';
import { adminRoutes } from '@/features/admin';
import { AdminLayout, AppShell, AuthLayout, WorkspaceLayout } from './layouts/index.js';
import { RequireAuth, RequireSystemAdmin } from './guards/index.js';
export const router = createBrowserRouter([
  { element: <AuthLayout />, children: authRoutes },
  { element: <RequireAuth />, children: [{ element: <AppShell />, children: [...profileRoutes, ...workspacesRoutes, ...dashboardRoutes, ...searchRoutes, ...notificationsRoutes, ...filesRoutes, ...aiRoutes, { element: <WorkspaceLayout />, children: [...boardRoutes, ...chatRoutes] }] }, { element: <RequireSystemAdmin />, children: [{ element: <AdminLayout />, children: adminRoutes }] }] },
]);
