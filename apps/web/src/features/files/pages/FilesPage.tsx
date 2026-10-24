import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError, api, apiBlob } from '@/shared/lib/api.js';

export type WorkspaceFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploader: { id: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
};

export type AttachedFile = Pick<WorkspaceFile, 'id' | 'name' | 'mimeType' | 'sizeBytes'>;

const MAX_FILE_BYTES = 5_242_880;
const PAGE_SIZE = 100;
const fileKeys = { workspace: (workspaceId: string) => ['files', workspaceId] as const };

function fileError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The file action could not be completed. Try again.';
}

function uploadFile(workspaceId: string, file: File): Promise<WorkspaceFile> {
  const body = new FormData();
  body.append('file', file);
  return api<WorkspaceFile>(`/workspaces/${encodeURIComponent(workspaceId)}/files`, { method: 'POST', body });
}

async function downloadFile(file: AttachedFile): Promise<void> {
  const blob = await apiBlob(`/files/${encodeURIComponent(file.id)}`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadControl({
  workspaceId,
  onUploaded,
  compact = false,
  disabled = false,
}: {
  workspaceId: string;
  onUploaded?: (file: AttachedFile) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => uploadFile(workspaceId, file),
    onSuccess: async (file) => {
      setMessage(null);
      onUploaded?.(file);
      await queryClient.invalidateQueries({ queryKey: fileKeys.workspace(workspaceId) });
    },
    onError: (error) => setMessage(fileError(error)),
  });

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || disabled) return;
    if (file.size > MAX_FILE_BYTES) {
      setMessage('Files can be up to 5 MB.');
      return;
    }
    setMessage(null);
    mutation.mutate(file);
  }

  return <div className="flex flex-col items-start gap-2">
    <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-muted ${disabled || mutation.isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
      {mutation.isPending ? 'Uploading…' : compact ? 'Attach file' : 'Upload file'}
      <input ref={input} type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selectFile} disabled={disabled || mutation.isPending} className="sr-only" aria-label={compact ? 'Attach file' : 'Upload file'} />
    </label>
    <p className="text-xs text-fg-muted">PDF, DOCX, TXT, PNG or JPG. Up to 5 MB.</p>
    {message && <p role="alert" className="max-w-full rounded-md border border-danger bg-danger-bg p-2 text-sm text-fg">{message}</p>}
  </div>;
}

function DownloadControl({ file, compact = false }: { file: AttachedFile; compact?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => downloadFile(file),
    onError: (error) => setMessage(fileError(error)),
  });

  return <div className={`flex min-w-0 items-center gap-3 rounded-md border border-line bg-surface p-3 ${compact ? 'w-full' : ''}`}>
    <div className="min-w-0 flex-1">
      <p className="break-all text-sm font-medium text-fg">{file.name}</p>
      <p className="text-xs text-fg-muted">{formatBytes(file.sizeBytes)}</p>
    </div>
    <button type="button" aria-label={`Download ${file.name}`} onClick={() => { setMessage(null); mutation.mutate(); }} disabled={mutation.isPending} className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50">
      {mutation.isPending ? 'Downloading…' : 'Download'}
    </button>
    {message && <p role="alert" className="basis-full rounded-md border border-danger bg-danger-bg p-2 text-sm text-fg">{message}</p>}
  </div>;
}

export function useUploadFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(workspaceId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fileKeys.workspace(workspaceId) }),
  });
}

export function AttachButton({
  workspaceId,
  onUploaded,
  disabled = false,
}: {
  workspaceId: string;
  onUploaded: (file: AttachedFile) => void;
  disabled?: boolean;
}) {
  return <UploadControl workspaceId={workspaceId} onUploaded={onUploaded} compact disabled={disabled} />;
}

export function FileChip({ file }: { file: AttachedFile }) {
  return <DownloadControl file={file} compact />;
}

export function FilesPanel({ workspaceId, onClose }: { workspaceId: string; onClose?: () => void }) {
  const filesQuery = useInfiniteQuery({
    queryKey: fileKeys.workspace(workspaceId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<WorkspaceFile[]>(`/workspaces/${encodeURIComponent(workspaceId)}/files`, {
      query: { limit: PAGE_SIZE, cursor: pageParam },
    }),
    getNextPageParam: (lastPage) => lastPage.length === PAGE_SIZE ? lastPage.at(-1)?.id : undefined,
    enabled: Boolean(workspaceId),
  });
  const files = filesQuery.data?.pages.flat() ?? [];

  return <section aria-label="Files in this workspace" className="flex h-full min-h-0 flex-col gap-3 rounded-lg border border-line bg-surface p-3 sm:p-4">
    <header className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-fg">Files in this workspace</h2>
      {onClose && <button type="button" aria-label="Close files" onClick={onClose} className="min-h-11 rounded-md px-3 text-sm font-medium text-fg hover:bg-surface-muted">Close</button>}
    </header>
    <UploadControl workspaceId={workspaceId} />
    {filesQuery.isPending ? <div role="status" aria-label="Loading files" className="space-y-3"><div className="h-16 animate-pulse rounded-md bg-surface-muted" /><div className="h-16 animate-pulse rounded-md bg-surface-muted" /></div> : null}
    {filesQuery.isError ? <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg">
      <p>{fileError(filesQuery.error)}</p>
      <button type="button" onClick={() => void filesQuery.refetch()} disabled={filesQuery.isFetching} className="min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>
    </div> : null}
    {!filesQuery.isPending && !filesQuery.isError && files.length === 0 ? <p className="rounded-md border border-dashed border-line p-4 text-sm text-fg-muted">No files yet. Upload one to share it with this workspace.</p> : null}
    {files.length > 0 && <ul aria-label="Workspace files" className="min-h-0 flex-1 space-y-2 overflow-y-auto">
      {files.map((file) => <li key={file.id}>
        <DownloadControl file={file} />
        <p className="px-1 pt-1 text-xs text-fg-muted">Uploaded by {file.uploader?.name ?? 'Deleted user'}</p>
      </li>)}
    </ul>}
    {filesQuery.hasNextPage && <button type="button" onClick={() => void filesQuery.fetchNextPage()} disabled={filesQuery.isFetchingNextPage} className="min-h-11 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50">
      {filesQuery.isFetchingNextPage ? 'Loading…' : 'Load older files'}
    </button>}
  </section>;
}

export function FilesPage() {
  return <main className="bg-canvas p-6 text-fg"><h1 className="text-xl font-semibold">Files</h1></main>;
}
