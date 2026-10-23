import type { DashboardCard, PersonalDashboard as PersonalDashboardData } from '@studysync/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CircleAlert } from 'lucide-react';
import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ApiError, api } from '@/shared/lib/api.js';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function TaskCard({ card }: { card: DashboardCard }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="break-words font-semibold text-fg">{card.title}</h3>
        <p className="text-sm text-fg-muted">{card.workspace.name} <span aria-hidden="true">·</span> {card.list.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          <span className="rounded-full border border-line px-2 py-0.5">{card.priority.toLowerCase()} priority</span>
          {card.dueDate ? <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-4" />Due {formatDate(card.dueDate)}</span> : <span>No due date</span>}
        </div>
      </div>
    </li>
  );
}

function TaskSection({ title, cards, emptyText }: { title: string; cards: DashboardCard[]; emptyText: string }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h2 className="mb-3 text-base font-semibold text-fg">{title}</h2>
      {cards.length === 0 ? <p className="rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">{emptyText}</p> : <ul className="space-y-3">{cards.map((card) => <TaskCard key={card.id} card={card} />)}</ul>}
    </section>
  );
}

function WorkspaceIntegrationPlaceholder() {
  return (
    <section aria-label="My workspaces" className="border-t border-line pt-5">
      <h2 className="mb-2 text-base font-semibold text-fg">My workspaces</h2>
      <p className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-4 text-sm text-fg-muted">Workspace list and creation controls will appear here when the workspace feature is available.</p>
    </section>
  );
}

export function PersonalDashboard() {
  const { data, error, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['personal-dashboard'],
    queryFn: () => api<PersonalDashboardData>('/me/dashboard'),
  });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header><h1 aria-label="Dashboard" className="text-xl font-semibold text-fg">My dashboard</h1><p className="mt-1 text-sm text-fg-muted">Your assigned work and upcoming deadlines.</p></header>
      {isPending ? (
        <div role="status" aria-label="Loading dashboard" className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((section) => <section key={section} className="space-y-3" aria-hidden="true"><div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />{[0, 1, 2].map((card) => <div key={card} className="h-24 rounded-lg border border-line bg-surface" />)}</section>)}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger bg-danger-bg p-4 text-fg">
          <div className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" /><p>{error instanceof ApiError ? error.message : 'We could not load your dashboard. Try again.'}</p></div>
          <button type="button" className="min-h-11 rounded-md border border-line bg-surface px-4 font-medium text-fg hover:bg-surface-muted" onClick={() => void refetch()} disabled={isFetching}>Try again</button>
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-6 md:grid-cols-2">
            <TaskSection title="Assigned to me" cards={data.assignedCards} emptyText="You have no assigned cards yet." />
            <TaskSection title="Upcoming deadlines" cards={data.upcomingDeadlines} emptyText="You have no upcoming deadlines." />
          </div>
          <WorkspaceIntegrationPlaceholder />
        </>
      )}
    </main>
  );
}

export function WorkspaceDashboard() {
  return <main className="bg-canvas p-6 text-fg"><h1 className="text-xl font-semibold">Workspace dashboard</h1></main>;
}

export function DashboardPage() { return <PersonalDashboard />; }

export const dashboardRoutes: RouteObject[] = [
  { path: '/', element: createElement(DashboardPage) },
  { path: '/w/:workspaceId', element: createElement(WorkspaceDashboard) },
];
