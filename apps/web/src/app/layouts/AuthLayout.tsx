import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4 sm:p-6">
      <div className="w-full max-w-sm sm:max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
