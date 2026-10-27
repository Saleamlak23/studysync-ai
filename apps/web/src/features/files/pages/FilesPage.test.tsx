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

const summary = { fileCount: 0, usedBytes: 0, limitBytes: 100 * 1024 * 1024 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('files components', () => {
  it('TC-FILE-03: loads an empty workspace file panel', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(response(String(input).endsWith('/files/summary') ? summary : [])),
    ));

    renderWithQueryClient(<FilesPanel workspaceId="workspace-1" />);

    expect(await screen.findByText(/No files yet/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 5 MB/)).toBeInTheDocument();
    expect(screen.getByText('0 B of 100.0 MB')).toBeInTheDocument();
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
    let listCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/files/summary')) return Promise.resolve(response(summary));
      listCalls += 1;
      return Promise.resolve(listCalls === 1
        ? response({ error: { code: 'INTERNAL', message: 'internal detail' } }, 500)
        : response([]));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<FilesPanel workspaceId="workspace-1" />);

    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText(/No files yet/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('TC-FILE-02: shows a friendly message when a file download request fails', async () => {
    const file = {
      id: 'file-1',
      name: 'project-summary.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      uploader: { id: 'user-1', name: 'Student', avatarUrl: null },
      createdAt: '2026-10-27T00:00:00.000Z',
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/files/summary')) return Promise.resolve(response(summary));
      if (url.includes('/files/file-1')) return Promise.reject(new TypeError('Network request failed'));
      return Promise.resolve(response([file]));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<FilesPanel workspaceId="workspace-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download project-summary.pdf' }));

    const downloadMessage = "We couldn't download this file. Check your connection and try again.";
    const downloadAlert = await screen.findByText(downloadMessage);
    expect(downloadAlert.closest('[role="alert"]')).toHaveTextContent(downloadMessage);
    expect(screen.getByText('project-summary.pdf')).toBeInTheDocument();
  });

  it('TC-FILE-04: displays file count and workspace storage capacity', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(response(String(input).endsWith('/files/summary')
        ? { fileCount: 3, usedBytes: 1536, limitBytes: 4096 }
        : [])),
    ));

    const { container } = renderWithQueryClient(<FilesPanel workspaceId="workspace-1" />);

    expect(await screen.findByRole('heading', { name: 'Files in this workspace (3)' })).toBeInTheDocument();
    expect(screen.getByText('1.5 KB of 4.0 KB')).toBeInTheDocument();
    expect(container.querySelector('progress[aria-label="Workspace storage used"]')).toHaveAttribute('value', '1536');
  });
});
