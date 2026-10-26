import { FileText, Kanban, LayoutDashboard, MessageSquare, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function WorkspaceTabs({ workspaceId, fileCount }: { workspaceId: string; fileCount?: number }) {
  const base = `/w/${workspaceId}`;

  return (
    <nav
      aria-label="Workspace tabs"
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 scrollbar-none"
    >
      <NavLink
        to={`${base}/board`}
        className={({ isActive }) =>
          `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
          }`
        }
      >
        <Kanban className="size-4 shrink-0" strokeWidth={1.75} />
        <span>Board</span>
      </NavLink>

      <NavLink
        to={`${base}/chat`}
        className={({ isActive }) =>
          `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
          }`
        }
      >
        <MessageSquare className="size-4 shrink-0" strokeWidth={1.75} />
        <span>Chat</span>
      </NavLink>

      <NavLink
        to={`${base}/files`}
        className={({ isActive }) =>
          `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
          }`
        }
      >
        <FileText className="size-4 shrink-0" strokeWidth={1.75} />
        <span>Files{fileCount === undefined ? '' : ` (${fileCount})`}</span>
      </NavLink>

      <NavLink
        to={base}
        end
        className={({ isActive }) =>
          `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
          }`
        }
      >
        <LayoutDashboard className="size-4 shrink-0" strokeWidth={1.75} />
        <span>Dashboard</span>
      </NavLink>

      <NavLink
        to={`${base}/settings`}
        className={({ isActive }) =>
          `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
          }`
        }
      >
        <Settings className="size-4 shrink-0" strokeWidth={1.75} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}
