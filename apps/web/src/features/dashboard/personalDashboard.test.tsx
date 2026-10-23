import type { PersonalDashboard as PersonalDashboardData } from '@studysync/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonalDashboard } from '@/features/dashboard';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/shared/lib/api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/api.js')>()),
  api: apiMock,
}));

const card: PersonalDashboardData['assignedCards'][number] = {
  id: '2ed78a9d-a508-4d0f-834e-06310b1d3d03', listId: '9249381f-8471-45d1-9c01-b9f964cc8962',
  title: 'Review the project plan', description: null, priority: 'HIGH', dueDate: '2026-11-02T00:00:00.000Z',
  position: 1024, createdById: null, createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
  assignees: [], labels: [], list: { id: '9249381f-8471-45d1-9c01-b9f964cc8962', name: 'To do' },
  workspace: { id: 'c747bd88-98c9-4d47-86dd-08c79f801c25', name: 'Study group' },
};

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PersonalDashboard /></QueryClientProvider>);
}

afterEach(() => apiMock.mockReset());

describe('PersonalDashboard (TC-PROF-02)', () => {
  it('shows loading while dashboard data is pending', () => {
    apiMock.mockReturnValue(new Promise(() => undefined));
    renderDashboard();
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument();
  });
  it('shows empty states when there are no assigned cards or deadlines', async () => {
    apiMock.mockResolvedValue({ assignedCards: [], upcomingDeadlines: [] });
    renderDashboard();
    expect(await screen.findByText('You have no assigned cards yet.')).toBeInTheDocument();
    expect(screen.getByText('You have no upcoming deadlines.')).toBeInTheDocument();
  });
  it('shows an actionable error state when the request fails', async () => {
    apiMock.mockRejectedValue(new Error('Please sign in to continue.'));
    renderDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your dashboard. Try again.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('shows assigned cards and upcoming deadline context', async () => {
    apiMock.mockResolvedValue({ assignedCards: [card], upcomingDeadlines: [card] });
    renderDashboard();
    expect(await screen.findAllByText('Review the project plan')).toHaveLength(2);
    expect(screen.getAllByText(/Study group/)).toHaveLength(2);
    expect(screen.getAllByText(/Due/)).toHaveLength(2);
  });
});
