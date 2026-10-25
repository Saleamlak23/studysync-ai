import { LayoutDashboard, LogOut, Shield, Sparkles, FolderKanban } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/features/notifications';
import { signOut, useSession } from '@/shared/lib/session.js';
import { Avatar } from '@/shared/ui/index.js';

export function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const user = session.status === 'authenticated' ? session.user : null;
  const isAdmin = user?.systemRole === 'ADMIN';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-fg">
      {/* Desktop Sidebar (md and up) */}
      <aside
        aria-label="Sidebar navigation"
        className="hidden md:flex flex-col w-(--size-sidebar) shrink-0 border-r border-line bg-surface h-full"
      >
        <div className="flex h-(--size-header) items-center px-5 border-b border-line">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight"
          >
            <Sparkles className="size-5 text-ai" strokeWidth={1.75} />
            <span>StudySync AI</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`
            }
          >
            <LayoutDashboard className="size-4 shrink-0" strokeWidth={1.75} />
            <span>My dashboard</span>
          </NavLink>

          <NavLink
            to="/workspaces"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`
            }
          >
            <FolderKanban className="size-4 shrink-0" strokeWidth={1.75} />
            <span>Workspaces</span>
          </NavLink>

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-line">
              <span className="px-3 text-xs font-semibold uppercase tracking-wider text-fg-faint">
                Administration
              </span>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 mt-1 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                  }`
                }
              >
                <Shield className="size-4 shrink-0" strokeWidth={1.75} />
                <span>System admin</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* User profile & sign-out at bottom of sidebar */}
        {user && (
          <div className="p-3 border-t border-line bg-surface-muted/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{user.name}</p>
                <p className="text-xs text-fg-muted truncate">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-(--size-header) shrink-0 border-b border-line bg-surface flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex md:hidden items-center gap-2 font-bold text-base text-primary tracking-tight"
            >
              <Sparkles className="size-4 text-ai" strokeWidth={1.75} />
              <span>StudySync AI</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Scrollable Page Outlet */}
        <main className="flex-1 min-w-0 overflow-y-auto pb-(--size-bottom-nav) md:pb-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation (< md) */}
        <nav
          aria-label="Mobile navigation"
          className="fixed bottom-0 left-0 right-0 h-(--size-bottom-nav) border-t border-line bg-surface flex md:hidden items-center justify-around z-30 px-2"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-fg-muted hover:text-fg'
              }`
            }
          >
            <LayoutDashboard className="size-5" strokeWidth={1.75} />
            <span className="mt-0.5">Dashboard</span>
          </NavLink>

          <NavLink
            to="/workspaces"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-fg-muted hover:text-fg'
              }`
            }
          >
            <FolderKanban className="size-5" strokeWidth={1.75} />
            <span className="mt-0.5">Workspaces</span>
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-fg-muted hover:text-fg'
                }`
              }
            >
              <Shield className="size-5" strokeWidth={1.75} />
              <span className="mt-0.5">Admin</span>
            </NavLink>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium text-fg-muted hover:text-fg transition-colors"
          >
            <LogOut className="size-5" strokeWidth={1.75} />
            <span className="mt-0.5">Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
