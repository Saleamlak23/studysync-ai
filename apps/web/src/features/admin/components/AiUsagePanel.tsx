import type { AdminAiUsageQuery, AiUsageRow } from '@studysync/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '@/shared/lib/api.js';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@/shared/ui';
import { useAdminAiUsage } from '@/features/admin';

type UsageFilters = {
  from: string;
  to: string;
};

function dateBoundary(value: string, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  const time = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const date = new Date(`${value}${time}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function rowIdentity(row: AiUsageRow): string {
  return `${row.userId ?? 'deleted'}-${row.workspaceId}-${row.feature}-${row.provider}`;
}

export function AiUsagePanel() {
  const [draft, setDraft] = useState<UsageFilters>({ from: '', to: '' });
  const [query, setQuery] = useState<AdminAiUsageQuery>({});
  const usage = useAdminAiUsage(query);

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      from: dateBoundary(draft.from, false),
      to: dateBoundary(draft.to, true),
    }));
  }

  function filterByUser(userId: string | null) {
    if (userId) setQuery((current) => ({ ...current, userId }));
  }

  function filterByWorkspace(workspaceId: string) {
    setQuery((current) => ({ ...current, workspaceId }));
  }

  function clearFilters() {
    setDraft({ from: '', to: '' });
    setQuery({});
  }

  function renderIdentityFilters(row: AiUsageRow) {
    const userLabel = row.userName ?? 'Deleted user';
    return (
      <div className="flex min-w-0 flex-col items-start gap-1">
        <button
          type="button"
          className="min-h-(--size-touch) break-words text-left font-semibold text-primary underline-offset-2 hover:underline"
          aria-label={`Filter AI usage by user ${userLabel}`}
          disabled={!row.userId}
          onClick={() => filterByUser(row.userId)}
        >
          {userLabel}
        </button>
        <button
          type="button"
          className="min-h-(--size-touch) break-words text-left text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
          aria-label={`Filter AI usage by workspace ${row.workspaceName}`}
          onClick={() => filterByWorkspace(row.workspaceId)}
        >
          {row.workspaceName}
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="ai-usage-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="ai-usage-heading" className="text-lg font-semibold">
          AI usage
        </h2>
        <p className="text-sm text-fg-muted">Usage totals grouped by user, workspace, feature, and provider.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <form onSubmit={applyDates} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Input
            id="ai-usage-from"
            label="From date (UTC)"
            type="date"
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
          />
          <Input
            id="ai-usage-to"
            label="To date (UTC)"
            type="date"
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
          />
          <Button type="submit" variant="primary" className="min-h-(--size-touch)">
            Apply dates
          </Button>
        </form>

        {usage.isPending ? (
          <div role="status" aria-label="Loading AI usage" className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : usage.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-sm text-danger">
              {usage.error instanceof ApiError ? usage.error.message : 'We could not load AI usage. Try again.'}
            </p>
            <Button onClick={() => void usage.refetch()}>Try again</Button>
          </div>
        ) : usage.data.rows.length === 0 ? (
          <EmptyState
            title="No AI usage found."
            description="There are no AI requests for the selected filters."
            action={Object.keys(query).length > 0 ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-3" aria-label="AI usage totals">
              <Card variant="tile">
                <p className="text-xs text-fg-muted">Requests</p>
                <p className="text-lg font-semibold">{usage.data.totals.requests}</p>
              </Card>
              <Card variant="tile">
                <p className="text-xs text-fg-muted">Input tokens</p>
                <p className="text-lg font-semibold">{usage.data.totals.tokensIn}</p>
              </Card>
              <Card variant="tile">
                <p className="text-xs text-fg-muted">Output tokens</p>
                <p className="text-lg font-semibold">{usage.data.totals.tokensOut}</p>
              </Card>
            </div>
            {Object.keys(query).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {query.userId && <Badge>Filtered by user</Badge>}
                {query.workspaceId && <Badge>Filtered by workspace</Badge>}
                {(query.from || query.to) && <Badge>Filtered by date</Badge>}
                <Button className="min-h-(--size-touch)" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <ul className="flex flex-col gap-2" aria-label="AI usage rows">
              {usage.data.rows.map((row) => (
                <li key={rowIdentity(row)}>
                  <Card variant="tile" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                    {renderIdentityFilters(row)}
                    <div className="flex flex-wrap gap-2">
                      <Badge>{row.feature}</Badge>
                      <Badge variant="ai">{row.provider}</Badge>
                    </div>
                    <p className="text-sm text-fg-muted">
                      {row.requests} {row.requests === 1 ? 'request' : 'requests'}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {row.tokensIn} in · {row.tokensOut} out
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </section>
  );
}
