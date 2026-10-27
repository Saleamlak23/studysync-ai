import { FileText, Kanban, MessageSquare, PanelRightOpen, Settings, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { AiPanel } from '@/features/ai';
import { useWorkspaceFileSummary } from '@/features/files';
import { SearchBox } from '@/features/search';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery.js';
import { aiContext } from '@/shared/stores/aiContext.js';
import { Sheet } from '@/shared/ui/index.js';

export function WorkspaceLayout() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAiCollapsed, setIsAiCollapsed] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const resizeStart = useRef<{ clientX: number; width: number } | null>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const fileSummary = useWorkspaceFileSummary(workspaceId);
  const fileCount = fileSummary.data?.fileCount;

  useEffect(() => aiContext.subscribeToAssistantOpen(() => {
    setIsAiCollapsed(false);
    if (!isDesktop) setIsAiOpen(true);
  }), [isDesktop]);

  const base = `/w/${workspaceId}`;
  const minAiPanelWidth = 280;
  const maxAiPanelWidth = 640;

  function resizeAiPanel(event: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current) return;
    const nextWidth = resizeStart.current.width + resizeStart.current.clientX - event.clientX;
    setAiPanelWidth(Math.max(minAiPanelWidth, Math.min(maxAiPanelWidth, nextWidth)));
  }

  function resizeAiPanelWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') setAiPanelWidth((width) => Math.min(maxAiPanelWidth, width + 16));
    else if (event.key === 'ArrowRight') setAiPanelWidth((width) => Math.max(minAiPanelWidth, width - 16));
    else if (event.key === 'Home') setAiPanelWidth(minAiPanelWidth);
    else if (event.key === 'End') setAiPanelWidth(maxAiPanelWidth);
    else return;
    event.preventDefault();
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden pb-(--size-bottom-nav) md:pb-0">
      {/* Workspace central area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Workspace search and assistant controls */}
        <div className="shrink-0 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-end gap-2.5">
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

      {/* Resizable AI panel on >= xl */}
      <div
        role="separator"
        aria-label="Resize AI assistant"
        aria-orientation="vertical"
        aria-valuemin={minAiPanelWidth}
        aria-valuemax={maxAiPanelWidth}
        aria-valuenow={aiPanelWidth}
        tabIndex={isAiCollapsed ? -1 : 0}
        onPointerDown={(event) => { resizeStart.current = { clientX: event.clientX, width: aiPanelWidth }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={resizeAiPanel}
        onPointerUp={(event) => { resizeStart.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { resizeStart.current = null; }}
        onKeyDown={resizeAiPanelWithKeyboard}
        className={`${isAiCollapsed ? 'hidden' : 'hidden xl:block'} w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-ai-soft focus-visible:bg-ai-soft`}
      />
      <aside
        aria-label={isAiCollapsed ? undefined : 'AI assistant'}
        className={`hidden xl:flex h-full shrink-0 border-l border-line bg-surface ${isAiCollapsed ? 'w-10 flex-col items-center' : 'flex-col overflow-hidden'}`}
        style={isAiCollapsed ? undefined : { width: aiPanelWidth }}
      >
        {isAiCollapsed
          ? <button
            type="button"
            aria-label="Expand AI assistant"
            title="Expand AI assistant"
            onClick={() => setIsAiCollapsed(false)}
            className="mt-2 inline-flex min-h-11 min-w-10 items-center justify-center text-fg-muted hover:bg-surface-muted hover:text-fg"
          ><PanelRightOpen aria-hidden="true" className="size-4" strokeWidth={1.75} /></button>
          : <AiPanel workspaceId={workspaceId} onCollapse={() => setIsAiCollapsed(true)} />}
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
