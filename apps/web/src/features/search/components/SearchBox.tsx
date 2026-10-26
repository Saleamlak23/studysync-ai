import { useEffect, useRef, useState, type Ref } from 'react';
import { Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SearchResult } from '@studysync/shared';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery.js';
import { ApiError } from '@/shared/lib/api.js';
import { Button, EmptyState, Spinner } from '@/shared/ui/index.js';
import { useWorkspaceSearch } from '../search.api.js';

type SearchBoxProps = { workspaceId: string };

function friendlyError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Search is unavailable. Try again.';
}

function SearchResults({ workspaceId, query, result, loading, error, retry }: {
  workspaceId: string;
  query: string;
  result?: SearchResult;
  loading: boolean;
  error?: unknown;
  retry: () => void;
}) {
  if (query.trim().length < 2) {
    return <p className="px-3 py-4 text-sm text-fg-muted">Enter at least 2 characters to search this workspace.</p>;
  }

  if (loading) {
    return <div className="flex items-center gap-2 px-3 py-5 text-sm text-fg-muted"><Spinner label="Searching" />Searching this workspace…</div>;
  }

  if (error) {
    return <div className="space-y-3 p-3"><p role="alert" className="text-sm text-danger">{friendlyError(error)}</p><Button size="md" onClick={retry}>Try again</Button></div>;
  }

  if (!result || (result.cards.length === 0 && result.messages.length === 0 && result.files.length === 0)) {
    return <EmptyState title={`No results for “${query.trim()}”`} description="Try another keyword." />;
  }

  return (
    <div className="max-h-[min(65vh,28rem)] space-y-4 overflow-y-auto p-2">
      {result.cards.length > 0 && <section aria-labelledby="search-cards-heading"><h3 id="search-cards-heading" className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Cards</h3><ul className="space-y-1">{result.cards.map((card) => <li key={card.id}><Link to={`/w/${workspaceId}/board`} className="block rounded-md px-3 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"><span className="block break-words text-sm font-medium text-fg">{card.title}</span><span className="mt-1 block break-words text-xs text-fg-muted">{card.snippet}</span><span className="sr-only">Open board</span></Link></li>)}</ul></section>}
      {result.messages.length > 0 && <section aria-labelledby="search-messages-heading"><h3 id="search-messages-heading" className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Messages</h3><ul className="space-y-1">{result.messages.map((message) => <li key={message.id}><Link to={`/w/${workspaceId}/chat`} className="block rounded-md px-3 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"><span className="block text-sm font-medium text-fg">Message</span><span className="mt-1 block break-words text-xs text-fg-muted">{message.snippet}</span><span className="sr-only">Open chat</span></Link></li>)}</ul></section>}
      {result.files.length > 0 && <section aria-labelledby="search-files-heading"><h3 id="search-files-heading" className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Files</h3><ul className="space-y-1">{result.files.map((file) => <li key={file.id}><Link to={`/w/${workspaceId}/chat`} className="block break-words rounded-md px-3 py-2 text-sm font-medium text-fg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus">{file.name}<span className="sr-only">Open chat</span></Link></li>)}</ul></section>}
    </div>
  );
}

export function SearchBox({ workspaceId }: SearchBoxProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [value, setValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const searchEnabled = !isMobile || mobileOpen;
  const query = useWorkspaceSearch(workspaceId, debouncedValue, searchEnabled);
  const waiting = value.trim().length >= 2 && value.trim() !== debouncedValue.trim();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileInputRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  function clearSearch() {
    setValue('');
    setDebouncedValue('');
    setPanelOpen(false);
  }

  function searchInput(inputId: string, resultsId: string, inputRef?: Ref<HTMLInputElement>) {
    return <div className="relative min-w-0 flex-1">
      <label className="sr-only" htmlFor={inputId}>Search cards, messages, files</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
      <input ref={inputRef} id={inputId} type="search" value={value} onChange={(event) => { setValue(event.target.value); setPanelOpen(true); }} onFocus={() => setPanelOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setPanelOpen(false); }} placeholder="Search cards, messages, files" aria-expanded={panelOpen} aria-controls={resultsId} autoComplete="off" className="min-h-(--size-touch) w-full rounded-md border border-line-strong bg-surface py-2 pl-9 pr-10 text-sm text-fg placeholder:text-fg-faint focus:border-primary focus:outline-2 focus:outline-focus" />
      {value && <button type="button" aria-label="Clear search" onClick={clearSearch} className="absolute right-1 top-1/2 inline-flex size-(--size-touch) -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"><X aria-hidden="true" className="size-4" /></button>}
    </div>;
  }

  const showResults = panelOpen;
  const results = showResults ? <SearchResults workspaceId={workspaceId} query={value} result={query.data} loading={waiting || (debouncedValue.trim().length >= 2 && query.isPending)} error={query.isError ? query.error : undefined} retry={() => void query.refetch()} /> : null;

  return (
    <div className="relative min-w-0">
      <div className="hidden md:block md:w-72">{searchInput('workspace-search-input', 'workspace-search-results-desktop')}</div>
      {showResults && <div id="workspace-search-results-desktop" role="region" aria-label="Search results" className="absolute left-0 right-0 top-full z-40 mt-2 hidden overflow-hidden rounded-lg border border-line bg-surface shadow-lg md:block md:left-auto md:right-0 md:w-[min(28rem,calc(100vw-2rem))]">{results}</div>}
      <Button size="lg" className="md:hidden min-w-(--size-touch) px-3" aria-label="Open workspace search" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Search aria-hidden="true" className="size-5" /></Button>
      {mobileOpen && <div className="fixed inset-0 z-50 bg-canvas p-3 md:hidden" role="dialog" aria-modal="true" aria-label="Search this workspace">
        <div className="flex items-center gap-2">{searchInput('workspace-search-mobile-input', 'workspace-search-results-mobile', mobileInputRef)}<Button size="lg" onClick={() => setMobileOpen(false)}>Close</Button></div>
        {showResults && <div id="workspace-search-results-mobile" role="region" aria-label="Search results" className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">{results}</div>}
      </div>}
    </div>
  );
}
