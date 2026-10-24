import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachButton, FilesPanel } from './FilesPage.js';

function renderWithQueryClient(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('files components', () => {
  it('TC-FILE-03: loads an empty workspace file panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([])));

    renderWithQueryClient(<FilesPanel workspaceId="workspace-1" />);

    expect(await screen.findByText(/No files yet/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 5 MB/)).toBeInTheDocument();
  });

  it.each([
    [413, 'FILE_TOO_LARGE', 'Files can be up to 5 MB.'],
    [413, 'STORAGE_LIMIT_REACHED', 'This workspace has used all of its file storage.'],
    [415, 'UNSUPPORTED_FILE_TYPE', 'Use PDF, DOCX, TXT, PNG or JPG files.'],
  ])('TC-FILE-01: shows a friendly upload error for %s %s', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { code, message: 'server detail' } }, status)));
    const file = new File(['sample'], 'sample.pdf', { type: 'application/pdf' });

    renderWithQueryClient(<AttachButton workspaceId="workspace-1" onUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Upload file'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('alert')).not.toHaveTextContent('server detail');
  });

  it('TC-FILE-03: retries a failed file list request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 'INTERNAL', message: 'internal detail' } }, 500))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<FilesPanel workspaceId="workspace-1" />);

    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText(/No files yet/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
