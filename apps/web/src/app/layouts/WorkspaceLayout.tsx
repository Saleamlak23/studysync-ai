import { FileText, Kanban, MessageSquare, Settings, Sparkles, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { AiPanel } from '@/features/ai';
import { useWorkspaceFileSummary } from '@/features/files';
import { SearchBox } from '@/features/search';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery.js';
import { Sheet } from '@/shared/ui/index.js';

export function WorkspaceLayout() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const fileSummary = useWorkspaceFileSummary(workspaceId);
  const fileCount = fileSummary.data?.fileCount;

  const base = `/w/${workspaceId}`;

  return (
    <div className="relative flex h-full w-full overflow-hidden pb-(--size-bottom-nav) md:pb-0">
      {/* Workspace central area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Workspace sub-navigation & search bar */}
        <div className="shrink-0 border-b border-line bg-surface px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Workspace tabs"
            className="hidden md:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none"
          >
            <NavLink
              to={`${base}/board`}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-11 ${
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                }`
              }
            >
              <Kanban className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Board</span>
            </NavLink>

            <NavLink
              to={`${base}/chat`}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-11 ${
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                }`
              }
            >
              <MessageSquare className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Chat</span>
            </NavLink>

            <NavLink
              to={`${base}/files`}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-11 ${
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
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
                `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-11 ${
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                }`
              }
            >
              <LayoutDashboard className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to={`${base}/settings`}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-11 ${
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                }`
              }
            >
              <Settings className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Settings</span>
            </NavLink>
          </nav>

          <div className="flex items-center gap-2.5 ml-auto">
            <SearchBox workspaceId={workspaceId} />

            {/* AI button on tablet/mobile */}
            <button
              type="button"
              onClick={() => setIsAiOpen(true)}
              aria-label="Open AI assistant"
              className="hidden md:inline-flex xl:hidden items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-ai-soft-line bg-ai-soft text-ai hover:bg-ai-soft/80 min-h-11 transition-colors"
            >
              <Sparkles className="size-4" strokeWidth={1.75} />
              <span>AI assistant</span>
            </button>
          </div>
        </div>

        {/* Workspace route content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </div>
      </div>

      {/* Docked AI panel on >= xl */}
      <aside
        aria-label="AI assistant"
        className="hidden xl:flex flex-col w-(--size-ai-panel) shrink-0 border-l border-line bg-surface overflow-y-auto"
      >
        <AiPanel workspaceId={workspaceId} />
      </aside>

      <nav
        aria-label="Workspace mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-(--size-bottom-nav) items-center justify-around border-t border-line bg-surface px-2 md:hidden"
      >
        <NavLink to={`${base}/board`} className={({ isActive }) => `flex min-h-11 min-w-11 flex-col items-center justify-center px-3 py-1 text-xs font-medium ${isActive ? 'text-primary' : 'text-fg-muted'}`}>
          <Kanban aria-hidden="true" className="size-5" strokeWidth={1.75} /><span className="mt-0.5">Board</span>
        </NavLink>
        <NavLink to={`${base}/chat`} className={({ isActive }) => `flex min-h-11 min-w-11 flex-col items-center justify-center px-3 py-1 text-xs font-medium ${isActive ? 'text-primary' : 'text-fg-muted'}`}>
          <MessageSquare aria-hidden="true" className="size-5" strokeWidth={1.75} /><span className="mt-0.5">Chat</span>
        </NavLink>
        <NavLink to={`${base}/files`} className={({ isActive }) => `flex min-h-11 min-w-11 flex-col items-center justify-center px-3 py-1 text-xs font-medium ${isActive ? 'text-primary' : 'text-fg-muted'}`}>
          <FileText aria-hidden="true" className="size-5" strokeWidth={1.75} /><span className="mt-0.5">{fileCount === undefined ? 'Files' : `Files (${fileCount})`}</span>
        </NavLink>
        <NavLink to={`${base}/settings`} className={({ isActive }) => `flex min-h-11 min-w-11 flex-col items-center justify-center px-3 py-1 text-xs font-medium ${isActive ? 'text-primary' : 'text-fg-muted'}`}>
          <Settings aria-hidden="true" className="size-5" strokeWidth={1.75} /><span className="mt-0.5">Settings</span>
        </NavLink>
      </nav>

      {/* Floating Lagoon Assistant button on mobile (< md) */}
      <button
        type="button"
        onClick={() => setIsAiOpen(true)}
        aria-label="Open AI assistant floating button"
        className="fixed bottom-16 right-4 z-20 md:hidden flex items-center justify-center size-12 rounded-full bg-ai hover:bg-ai-hover text-white shadow-lg transition-transform active:scale-95"
      >
        <Sparkles className="size-5" strokeWidth={1.75} />
      </button>

      {/* Responsive Sheet for mobile (< md: bottom sheet) and tablet (md to < xl: drawer) */}
      <Sheet
        open={isAiOpen}
        onOpenChange={setIsAiOpen}
        title="AI assistant"
        side={isMobile ? 'bottom' : 'right'}
      >
        <AiPanel workspaceId={workspaceId} />
      </Sheet>
    </div>
  );
}
