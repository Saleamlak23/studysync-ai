import type { WorkspaceDashboard as WorkspaceDashboardData } from '@studysync/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/shared/lib/api.js';
import { WorkspaceDashboard } from '@/features/dashboard';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/shared/lib/api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/api.js')>()),
  api: apiMock,
}));

const dashboardData: WorkspaceDashboardData = {
  cardsPerList: [
    { listId: '9249381f-8471-45d1-9c01-b9f964cc8962', name: 'To do', position: 1024, count: 4 },
    { listId: 'c747bd88-98c9-4d47-86dd-08c79f801c25', name: 'Done', position: 2048, count: 2 },
  ],
  overdue: 1,
  completed: 2,
  open: 4,
  contributions: [
    { userId: '2ed78a9d-a508-4d0f-834e-06310b1d3d03', name: 'Yared Teweldebirhan', avatarUrl: null, count: 3 },
    { userId: 'c747bd88-98c9-4d47-86dd-08c79f801c25', name: 'Rufta Gaiem', avatarUrl: null, count: 2 },
  ],
};

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/w/workspace-1']}>
      <Routes><Route path="/w/:workspaceId" element={<WorkspaceDashboard />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  apiMock.mockReset();
});

describe('WorkspaceDashboard', () => {
  it('shows a loading state while workspace aggregates are requested', () => {
    apiMock.mockReturnValue(new Promise(() => undefined));
    renderDashboard();

    expect(screen.getByRole('status', { name: 'Loading workspace dashboard' })).toBeInTheDocument();
  });

  it('shows a retryable friendly error state', async () => {
    apiMock.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Something went wrong'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows zero counts and helpful empty states when no aggregate data exists', async () => {
    apiMock.mockResolvedValue({ cardsPerList: [], overdue: 0, completed: 0, open: 0, contributions: [] });
    renderDashboard();

    expect(await screen.findByText('There are no lists in this workspace yet.')).toBeInTheDocument();
    expect(screen.getByText('No member contributions to show yet.')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('FR-ANA-01 / TC-ANA-01: renders seeded counts per list and member contributions', async () => {
    apiMock.mockResolvedValue(dashboardData);
    renderDashboard();

    expect(await screen.findByRole('region', { name: 'Workspace progress' })).toBeInTheDocument();
    expect(screen.getByText('Open cards').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Completed cards').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Overdue cards').parentElement).toHaveTextContent('1');
    expect(screen.getByRole('img', { name: 'Cards per list chart' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Contribution by member chart' })).toBeInTheDocument();
    expect(screen.getByText(/Contributions count each member once per card/)).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/workspaces/workspace-1/dashboard');
  });
});
