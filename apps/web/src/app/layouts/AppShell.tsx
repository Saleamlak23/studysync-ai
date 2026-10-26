import { LayoutDashboard, LogOut, Sparkles, FolderKanban, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useWorkspaceFileSummary } from '@/features/files';
import { NotificationBell } from '@/features/notifications';
import { WorkspaceActions, useWorkspaces } from '@/features/workspaces';
import { signOut, useSession } from '@/shared/lib/session.js';
import { Avatar } from '@/shared/ui/index.js';
import { WorkspaceTabs } from './WorkspaceTabs.js';

export function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceId = useMatch('/w/:workspaceId/*')?.params.workspaceId ?? '';
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const user = session.status === 'authenticated' ? session.user : null;
  const isAdmin = user?.systemRole === 'ADMIN';
  const isWorkspaceRoute = location.pathname.startsWith('/w/');
  const workspacesQuery = useWorkspaces();
  const fileSummary = useWorkspaceFileSummary(workspaceId);

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
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

          <section aria-label="Workspace shortcuts" className="mt-4 border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-faint">Your workspaces</h2>
              <Link to="/workspaces" className="text-xs font-medium text-primary hover:underline">All</Link>
            </div>
            {workspacesQuery.isPending && <p role="status" className="px-3 py-2 text-xs text-fg-muted">Loading workspaces…</p>}
            {workspacesQuery.isError && <div className="px-3 py-2 text-xs text-danger">
              <p>Workspace shortcuts could not load.</p>
              <button type="button" onClick={() => void workspacesQuery.refetch()} disabled={workspacesQuery.isFetching} className="mt-1 min-h-11 font-semibold underline disabled:opacity-50">Try again</button>
            </div>}
            {workspacesQuery.data && <ul className="space-y-1">
              {workspacesQuery.data.slice(0, 5).map((workspace) => (
                <li key={workspace.id}>
                  <NavLink to={`/w/${workspace.id}`} className={({ isActive }) =>
                    `block truncate rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive ? 'bg-primary-soft font-medium text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                    }`
                  }>
                    {workspace.name}
                  </NavLink>
                </li>
              ))}
              {workspacesQuery.data.length === 0 && <li className="px-3 py-1 text-xs text-fg-muted">No workspaces yet.</li>}
            </ul>}
            <div className="mt-2 px-1">
              <WorkspaceActions compact />
            </div>
          </section>

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
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Edit profile"
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{user.name}</p>
                <p className="text-xs text-fg-muted truncate">{user.email}</p>
              </div>
            </button>
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
        <header className="h-(--size-header) shrink-0 border-b border-line bg-surface flex min-w-0 items-center justify-between gap-2 px-4 sm:px-6 z-10">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              to="/"
              className="flex md:hidden items-center gap-2 font-bold text-base text-primary tracking-tight"
            >
              <Sparkles className="size-4 text-ai" strokeWidth={1.75} />
              <span>StudySync AI</span>
            </Link>
            {workspaceId && (
              <div className="hidden min-w-0 flex-1 md:flex">
                <WorkspaceTabs workspaceId={workspaceId} fileCount={fileSummary.data?.fileCount} />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user && <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={accountMenuOpen}
                aria-controls="mobile-account-menu"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                {user.avatarUrl ? <Avatar name={user.name} src={user.avatarUrl} size="sm" /> : <UserRound className="size-5" strokeWidth={1.75} />}
              </button>
              {accountMenuOpen && <div id="mobile-account-menu" className="absolute right-0 top-full z-40 mt-2 w-48 rounded-lg border border-line bg-surface p-2 shadow-lg">
                <p className="truncate px-3 py-2 text-sm font-medium text-fg">{user.name}</p>
                <button type="button" onClick={() => { setAccountMenuOpen(false); navigate('/profile'); }} className="min-h-11 w-full rounded-md px-3 text-left text-sm text-fg hover:bg-surface-muted">Edit profile</button>
                <button type="button" onClick={() => void handleSignOut()} className="min-h-11 w-full rounded-md px-3 text-left text-sm text-fg hover:bg-surface-muted">Sign out</button>
              </div>}
            </div>}
            <NotificationBell />
          </div>
        </header>

        {/* Scrollable Page Outlet */}
        <div className={`flex-1 min-w-0 overflow-y-auto ${isWorkspaceRoute ? 'pb-0' : 'pb-(--size-bottom-nav)'} md:pb-0`}>
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation (< md) */}
        <nav
          aria-label="Mobile navigation"
          className={`${isWorkspaceRoute ? 'hidden' : 'fixed flex'} bottom-0 left-0 right-0 h-(--size-bottom-nav) border-t border-line bg-surface md:hidden items-center justify-around z-30 px-2`}
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
