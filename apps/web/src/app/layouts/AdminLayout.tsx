import { ArrowLeft, Cpu, Shield, Users } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-fg">
      {/* Desktop Admin Sidebar */}
      <aside
        aria-label="Admin sidebar"
        className="hidden md:flex flex-col w-(--size-sidebar) shrink-0 border-r border-line bg-surface h-full"
      >
        <div className="flex h-(--size-header) items-center px-5 border-b border-line">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <Shield className="size-5 text-primary" strokeWidth={1.75} />
            <span>System admin</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Admin navigation">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`
            }
          >
            <Users className="size-4 shrink-0" strokeWidth={1.75} />
            <span>Users</span>
          </NavLink>

          <NavLink
            to="/admin/ai-usage"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`
            }
          >
            <Cpu className="size-4 shrink-0" strokeWidth={1.75} />
            <span>AI usage & limits</span>
          </NavLink>
        </nav>

        <div className="p-3 border-t border-line">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors min-h-11"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            <span>Back to app</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-(--size-header) shrink-0 border-b border-line bg-surface flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Shield className="size-5 text-primary" strokeWidth={1.75} />
            <h1 className="font-bold text-base text-fg">System admin</h1>
          </div>

          <div className="ml-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-line bg-surface hover:bg-surface-muted text-fg min-h-11 transition-colors"
            >
              <ArrowLeft className="size-4" strokeWidth={1.75} />
              <span>Back to app</span>
            </Link>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 pb-(--size-bottom-nav) md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav for admin */}
        <nav
          aria-label="Mobile admin navigation"
          className="fixed bottom-0 left-0 right-0 h-(--size-bottom-nav) border-t border-line bg-surface flex md:hidden items-center justify-around z-30 px-2"
        >
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-fg-muted hover:text-fg'
              }`
            }
          >
            <Users className="size-5" strokeWidth={1.75} />
            <span className="mt-0.5">Users</span>
          </NavLink>

          <NavLink
            to="/admin/ai-usage"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-fg-muted hover:text-fg'
              }`
            }
          >
            <Cpu className="size-5" strokeWidth={1.75} />
            <span className="mt-0.5">AI usage</span>
          </NavLink>

          <Link
            to="/"
            className="flex flex-col items-center justify-center min-h-11 min-w-11 px-3 py-1 text-xs font-medium text-fg-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
            <span className="mt-0.5">App</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
