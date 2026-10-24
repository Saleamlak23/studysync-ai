import type { DashboardCard, PersonalDashboard as PersonalDashboardData } from '@studysync/shared';
import type { WorkspaceDashboard as WorkspaceDashboardData } from '@studysync/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, CircleAlert, ListChecks, Users } from 'lucide-react';
import { createElement, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { RouteObject } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ApiError, api } from '@/shared/lib/api.js';
import { useWorkspaceDashboard } from './api.js';

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

function MetricCard({ label, value, icon: Icon, tone = 'neutral' }: { label: string; value: number; icon: LucideIcon; tone?: 'neutral' | 'danger' | 'success' }) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-fg';
  return <article className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm">
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-muted"><Icon aria-hidden="true" className={`size-5 ${toneClass}`} /></span>
    <div className="min-w-0"><p className="text-sm text-fg-muted">{label}</p><p className={`text-2xl font-bold tracking-tight ${toneClass}`}>{value}</p></div>
  </article>;
}

function ChartPanel({ title, children, emptyText }: { title: string; children: ReactNode; emptyText: string }) {
  return <section className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
    <h2 className="mb-4 text-lg font-semibold text-fg">{title}</h2>
    {children ?? <p className="rounded-md border border-dashed border-line-strong bg-surface-muted p-4 text-sm text-fg-muted">{emptyText}</p>}
  </section>;
}

function DashboardCharts({ data }: { data: WorkspaceDashboardData }) {
  const hasListCards = data.cardsPerList.length > 0;
  const hasContributions = data.contributions.length > 0;
  return <div className="grid min-w-0 gap-6 lg:grid-cols-2">
    <ChartPanel title="Cards per list" emptyText="There are no lists in this workspace yet.">
      {hasListCards ? <div role="img" aria-label="Cards per list chart" className="w-full" style={{ height: Math.max(240, data.cardsPerList.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.cardsPerList} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-line)', borderRadius: 'var(--radius-md)' }} />
            <Bar dataKey="count" name="Cards" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div> : null}
    </ChartPanel>
    <ChartPanel title="Contribution by member" emptyText="No member contributions to show yet.">
      {hasContributions ? <div role="img" aria-label="Contribution by member chart" className="w-full" style={{ height: Math.max(240, data.contributions.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.contributions} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-line)', borderRadius: 'var(--radius-md)' }} />
            <Bar dataKey="count" name="Cards contributed" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div> : null}
    </ChartPanel>
  </div>;
}

export function WorkspaceDashboard() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const { data, error, isPending, isError, refetch, isFetching } = useWorkspaceDashboard(workspaceId);

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 text-fg sm:p-6">
    <header><h1 className="text-2xl font-bold tracking-tight">Workspace dashboard</h1><p className="mt-1 text-sm text-fg-muted">Progress and contributions for this workspace.</p></header>
    {isPending ? <div role="status" aria-label="Loading workspace dashboard" className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <div aria-hidden="true" key={item} className="h-20 animate-pulse rounded-lg border border-line bg-surface-muted" />)}</div>
      <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((item) => <div aria-hidden="true" key={item} className="h-72 animate-pulse rounded-lg border border-line bg-surface-muted" />)}</div>
    </div> : isError ? <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger bg-danger-bg p-4">
      <div className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" /><p>{error instanceof ApiError ? error.message : 'We could not load this workspace dashboard. Try again.'}</p></div>
      <button type="button" onClick={() => void refetch()} disabled={isFetching} className="min-h-11 rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>
    </div> : data ? <>
      <section aria-label="Workspace progress" className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open cards" value={data.open} icon={ListChecks} />
        <MetricCard label="Completed cards" value={data.completed} icon={CheckCircle2} tone="success" />
        <MetricCard label="Overdue cards" value={data.overdue} icon={CalendarDays} tone={data.overdue ? 'danger' : 'neutral'} />
      </section>
      <DashboardCharts data={data} />
      <p className="flex items-center gap-2 text-xs text-fg-muted"><Users aria-hidden="true" className="size-4" />Contributions count each member once per card they created or are assigned to.</p>
    </> : <p role="status" className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-4 text-sm text-fg-muted">Workspace dashboard data is not available.</p>}
  </main>;
}

export function DashboardPage() { return <PersonalDashboard />; }

export const dashboardRoutes: RouteObject[] = [
  { path: '/', element: createElement(DashboardPage) },
  { path: '/w/:workspaceId', element: createElement(WorkspaceDashboard) },
];
