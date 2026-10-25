import type { AiLimitsResponse, AiUsageResponse } from '@studysync/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AiUsagePanel } from './components/AiUsagePanel.js';
import { AdminUsersPanel } from './components/AdminUsersPanel.js';
import { AiLimitsForm } from './components/AiLimitsForm.js';
import { ToastProvider } from '@/shared/ui';

const userId = 'bf93f121-595c-42b2-8440-4b83f0f6bdcf';
const workspaceId = 'a3ac724d-3b2a-4d1c-a282-8c1a0fcad1f1';

const adminUser = {
  id: userId,
  name: 'Aster Alemu',
  email: 'aster@example.test',
  avatarUrl: null,
  bio: null,
  systemRole: 'USER' as const,
  status: 'ACTIVE' as const,
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
};

const usageData: AiUsageResponse = {
  totals: { requests: 3, tokensIn: 240, tokensOut: 96 },
  rows: [
    {
      userId,
      userName: 'Aster Alemu',
      workspaceId,
      workspaceName: 'Study group',
      feature: 'BREAKDOWN',
      provider: 'groq',
      requests: 3,
      tokensIn: 240,
      tokensOut: 96,
    },
  ],
};

const initialLimits: AiLimitsResponse = {
  userDailyLimit: 20,
  workspaceDailyLimit: 100,
  updatedAt: null,
};

const server = setupServer(
  http.get(/\/api\/v1\/admin\/users/, () => HttpResponse.json([adminUser])),
  http.patch(/\/api\/v1\/admin\/users\/[^/]+$/, async ({ request }) => {
    const body = (await request.json()) as { status: 'ACTIVE' | 'SUSPENDED' };
    return HttpResponse.json({ ...adminUser, status: body.status });
  }),
  http.get(/\/api\/v1\/admin\/ai-usage/, () => HttpResponse.json(usageData)),
  http.get(/\/api\/v1\/admin\/ai-limits/, () => HttpResponse.json(initialLimits)),
  http.put(/\/api\/v1\/admin\/ai-limits/, async ({ request }) => {
    const body = (await request.json()) as Pick<AiLimitsResponse, 'userDailyLimit' | 'workspaceDailyLimit'>;
    return HttpResponse.json({ ...body, updatedAt: '2026-10-25T11:00:00.000Z' });
  }),
);

function renderAdmin(element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{element}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Admin pages', () => {
  it('TC-ADM-01: shows a loading state before users load', async () => {
    server.use(
      http.get(/\/api\/v1\/admin\/users/, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([adminUser]);
      }),
    );

    renderAdmin(<AdminUsersPanel />);
    expect(screen.getByRole('status', { name: 'Loading users' })).toBeInTheDocument();
    expect(await screen.findByText('Aster Alemu')).toBeInTheDocument();
  });

  it('TC-ADM-01: searches users and suspends or reactivates an account', async () => {
    let status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE';
    const searchedQueries: string[] = [];
    server.use(
      http.get(/\/api\/v1\/admin\/users/, ({ request }) => {
        const url = new URL(request.url);
        searchedQueries.push(url.searchParams.get('q') ?? '');
        return HttpResponse.json([{ ...adminUser, status }]);
      }),
      http.patch(/\/api\/v1\/admin\/users\/[^/]+$/, async ({ request }) => {
        const body = (await request.json()) as { status: 'ACTIVE' | 'SUSPENDED' };
        status = body.status;
        return HttpResponse.json({ ...adminUser, status });
      }),
    );

    renderAdmin(<AdminUsersPanel />);
    expect(await screen.findByText('Aster Alemu')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name or email' }), {
      target: { value: 'aster' },
    });
    await waitFor(() => expect(searchedQueries).toContain('aster'));

    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('Suspended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(await screen.findAllByText('User status updated.')).toHaveLength(2);
  });

  it('TC-ADM-01: shows an empty state and lets the admin clear user filters', async () => {
    server.use(
      http.get(/\/api\/v1\/admin\/users/, ({ request }) =>
        new URL(request.url).searchParams.get('q')
          ? HttpResponse.json([])
          : HttpResponse.json([adminUser]),
      ),
    );
    renderAdmin(<AdminUsersPanel />);
    expect(await screen.findByText('Aster Alemu')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name or email' }), {
      target: { value: 'missing' },
    });
    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('TC-ADM-01: shows a retryable error when users fail to load', async () => {
    let fail = true;
    server.use(
      http.get(/\/api\/v1\/admin\/users/, () =>
        fail
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'private details' } }, { status: 500 })
          : HttpResponse.json([adminUser]),
      ),
    );
    renderAdmin(<AdminUsersPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.queryByText('private details')).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Aster Alemu')).toBeInTheDocument();
  });

  it('TC-ADM-02: displays AI usage and requests supported filters', async () => {
    const requestedQueries: URLSearchParams[] = [];
    server.use(
      http.get(/\/api\/v1\/admin\/ai-usage/, ({ request }) => {
        requestedQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json(usageData);
      }),
    );
    renderAdmin(<AiUsagePanel />);
    expect(await screen.findByText('Study group')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter AI usage by user Aster Alemu' }));
    await waitFor(() =>
      expect(requestedQueries.some((query) => query.get('userId') === userId)).toBe(true),
    );

    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To date (UTC)'), { target: { value: '2026-10-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() =>
      expect(
        requestedQueries.some(
          (query) =>
            query.get('userId') === userId &&
            query.get('from')?.startsWith('2026-10-01T') &&
            query.get('to')?.startsWith('2026-10-25T'),
        ),
      ).toBe(true),
    );
  });

  it('TC-ADM-02: shows the empty state when there are no AI usage rows', async () => {
    server.use(http.get(/\/api\/v1\/admin\/ai-usage/, () => HttpResponse.json({
      totals: { requests: 0, tokensIn: 0, tokensOut: 0 },
      rows: [],
    })));
    renderAdmin(<AiUsagePanel />);
    expect(await screen.findByText('No AI usage found.')).toBeInTheDocument();
  });

  it('TC-ADM-02: shows a retryable error when AI usage fails to load', async () => {
    let fail = true;
    server.use(
      http.get(/\/api\/v1\/admin\/ai-usage/, () =>
        fail
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'private details' } }, { status: 500 })
          : HttpResponse.json(usageData),
      ),
    );
    renderAdmin(<AiUsagePanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.queryByText('private details')).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Study group')).toBeInTheDocument();
  });

  it('TC-ADM-02: validates positive whole-number limits and saves valid values', async () => {
    const saved: Array<{ userDailyLimit: number; workspaceDailyLimit: number }> = [];
    server.use(
      http.put(/\/api\/v1\/admin\/ai-limits/, async ({ request }) => {
        const body = (await request.json()) as { userDailyLimit: number; workspaceDailyLimit: number };
        saved.push(body);
        return HttpResponse.json({ ...body, updatedAt: '2026-10-25T11:00:00.000Z' });
      }),
    );
    renderAdmin(<AiLimitsForm />);
    expect(await screen.findByText('Using the configured default limits.')).toBeInTheDocument();

    const userLimit = screen.getByRole('spinbutton', { name: 'Daily limit per user' });
    const workspaceLimit = screen.getByRole('spinbutton', { name: 'Daily limit per workspace' });
    fireEvent.change(userLimit, { target: { value: '0' } });
    fireEvent.change(workspaceLimit, { target: { value: '10.5' } });
    fireEvent.submit(screen.getByRole('form', { name: 'AI limits' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a positive whole number for each daily limit.',
    );
    expect(userLimit).toHaveAttribute('aria-invalid', 'true');
    expect(workspaceLimit).toHaveAttribute('aria-invalid', 'true');
    expect(saved).toHaveLength(0);

    fireEvent.change(userLimit, { target: { value: '5' } });
    fireEvent.change(workspaceLimit, { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('form', { name: 'AI limits' }));
    await waitFor(() => expect(saved).toEqual([{ userDailyLimit: 5, workspaceDailyLimit: 10 }]));
    expect(await screen.findByText('AI limits saved.')).toBeInTheDocument();
  });

  it('shows a loading state for AI limits', async () => {
    server.use(
      http.get(/\/api\/v1\/admin\/ai-limits/, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(initialLimits);
      }),
    );
    renderAdmin(<AiLimitsForm />);
    expect(screen.getByRole('status', { name: 'Loading AI limits' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Daily limit per user')).toHaveValue(20);
  });
});
