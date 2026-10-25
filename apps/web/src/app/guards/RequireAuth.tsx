import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/shared/lib/session.js';
import { Spinner } from '@/shared/ui/index.js';

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="Checking authentication" />
      </div>
    );
  }

  if (session.status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
