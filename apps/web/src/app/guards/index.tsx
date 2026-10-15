import { Outlet } from 'react-router-dom';
export function RequireAuth() { return <Outlet />; }
export function RequireSystemAdmin() { return <Outlet />; }
