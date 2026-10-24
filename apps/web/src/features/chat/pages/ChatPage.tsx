import type { Channel, Message, MessagesPage, WorkspaceRole } from '@studysync/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspaceSocket } from '@/shared/hooks/useWorkspaceSocket.js';
import { ApiError } from '@/shared/lib/api.js';
import { getSocket, useOnReconnect } from '@/shared/lib/socket.js';
import { chatKeys, createChannel, deleteChannel, getChannels, getMembers, getMessages, getWorkspaceRole, postMessage, type ChatMember } from './chatData.js';
import { catchUpMessages, mergeMessages } from './messages.js';

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canManageChannels(role?: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

function useChatRealtime(workspaceId: string, channelId: string | undefined) {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const recoverMessages = useCallback(async () => {
    if (!channelId) return;
    const queryKey = chatKeys.messages(channelId);
    const current = queryClient.getQueryData<MessagesPage>(queryKey);
    if (!current) {
      await queryClient.invalidateQueries({ queryKey });
      return;
    }

    try {
      const caughtUp = await catchUpMessages(current.messages, (after) => getMessages(channelId, { after }));
      queryClient.setQueryData<MessagesPage>(queryKey, (latest) => latest
        ? { ...latest, messages: mergeMessages(latest.messages, caughtUp) }
        : { messages: caughtUp, nextCursor: null });
    } catch {
      await queryClient.invalidateQueries({ queryKey });
    }
  }, [channelId, queryClient]);

  useOnReconnect(recoverMessages);
  useWorkspaceSocket(workspaceId);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnectionState('connected');
    const onDisconnect = () => setConnectionState('disconnected');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnectionState(socket.connected ? 'connected' : 'connecting');
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    const join = () => socket.emit('channel:join', { channelId });
    const receiveMessage = (message: Message) => {
      if (message.channelId !== channelId) return;
      queryClient.setQueryData<MessagesPage>(chatKeys.messages(channelId), (current) => current
        ? { ...current, messages: mergeMessages(current.messages, [message]) }
        : { messages: [message], nextCursor: null });
    };

    socket.on('connect', join);
    socket.on('message:new', receiveMessage);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('message:new', receiveMessage);
      socket.emit('channel:leave', { channelId });
    };
  }, [channelId, queryClient]);
  return connectionState;
}

function ChannelList({
  channels,
  selectedId,
  canManage,
  isCreating,
  onSelect,
  onCreate,
}: {
  channels: Channel[];
  selectedId?: string;
  canManage: boolean;
  isCreating: boolean;
  onSelect: (channel: Channel) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [name, setName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    onCreate(event);
    if (name.trim()) {
      setName('');
      setShowCreate(false);
    }
  }

  return (
    <aside aria-label="Channels" className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-3 md:min-h-0 md:w-56 md:shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">Channels</h2>
        {canManage && <button type="button" className="min-h-11 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft" onClick={() => setShowCreate((visible) => !visible)}>
          {showCreate ? 'Cancel' : 'New channel'}
        </button>}
      </div>
      {showCreate && canManage && <form className="flex flex-col gap-2" onSubmit={submit}>
        <label htmlFor="new-channel-name" className="text-sm font-medium text-fg">Channel name</label>
        <input id="new-channel-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus" />
        <button type="submit" disabled={isCreating || !name.trim()} className="min-h-11 rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
          {isCreating ? 'Creating…' : 'Create channel'}
        </button>
      </form>}
      {channels.length === 0 ? <p className="text-sm text-fg-muted">No channels yet.</p> : <ul className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {channels.map((channel) => <li key={channel.id} className="shrink-0 md:shrink">
          <button type="button" aria-current={selectedId === channel.id ? 'page' : undefined} onClick={() => onSelect(channel)} className={`min-h-11 w-full rounded-md px-3 text-left text-sm ${selectedId === channel.id ? 'bg-primary-soft font-semibold text-primary' : 'text-fg hover:bg-surface-muted'}`}>
            <span aria-hidden="true"># </span>{channel.name}
          </button>
        </li>)}
      </ul>}
    </aside>
  );
}

function MessageItem({ message }: { message: Message }) {
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt));
  return <li className="min-w-0 break-words rounded-md px-3 py-2 hover:bg-surface-muted">
    <div className="flex flex-wrap items-baseline gap-x-2">
      <strong className="text-sm font-semibold text-fg">{message.author?.name ?? 'Deleted user'}</strong>
      <time dateTime={message.createdAt} className="text-xs text-fg-faint">{time}</time>
    </div>
    <p className="whitespace-pre-wrap text-sm text-fg">{message.content}</p>
  </li>;
}

function MessageComposer({
  channel,
  members,
  isSending,
  onSend,
}: {
  channel: Channel;
  members: ChatMember[];
  isSending: boolean;
  onSend: (content: string, mentionIds: string[]) => void;
}) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<Array<{ id: string; token: string }>>([]);
  const [caret, setCaret] = useState(0);
  const mentionMatch = content.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
  const suggestions = mentionMatch
    ? members.filter((member) => member.user.name.toLocaleLowerCase().includes(mentionMatch[1].toLocaleLowerCase())).slice(0, 5)
    : [];

  function addMention(member: ChatMember) {
    if (!mentionMatch) return;
    const matchStart = caret - mentionMatch[1].length - 1;
    const token = `@${member.user.name}`;
    const next = `${content.slice(0, matchStart)}${token} ${content.slice(caret)}`;
    setContent(next);
    setMentions((current) => current.some((item) => item.id === member.user.id) ? current : [...current, { id: member.user.id, token }]);
    setCaret(next.length);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed, [...new Set(mentions.filter((item) => content.includes(item.token)).map((item) => item.id))]);
    setContent('');
    setMentions([]);
    setCaret(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && suggestions.length > 0) {
      event.preventDefault();
      addMention(suggestions[0]);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return <form onSubmit={submit} className="relative flex items-end gap-2 border-t border-line bg-surface p-3 sm:p-4">
    <div className="min-w-0 flex-1">
      {suggestions.length > 0 && <ul aria-label="Mention suggestions" className="absolute bottom-full left-3 z-10 mb-2 max-h-48 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-md">
        {suggestions.map((member) => <li key={member.user.id}><button type="button" className="min-h-11 w-full rounded px-3 text-left text-sm text-fg hover:bg-primary-soft" onClick={() => addMention(member)}>{member.user.name}</button></li>)}
      </ul>}
      <label htmlFor="chat-message" className="sr-only">Message #{channel.name}</label>
      <textarea id="chat-message" value={content} onChange={(event) => { setContent(event.target.value); setCaret(event.target.selectionStart); setMentions((current) => current.filter((item) => event.target.value.includes(item.token))); }} onClick={(event) => setCaret(event.currentTarget.selectionStart)} onKeyUp={(event) => setCaret(event.currentTarget.selectionStart)} onKeyDown={handleKeyDown} rows={2} maxLength={5000} placeholder={`Message #${channel.name}, use @ to mention`} className="min-h-11 max-h-36 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-focus" />
      <p className="sr-only">Type @ followed by a name to mention a workspace member. Press Enter to send; Shift and Enter adds a line.</p>
    </div>
    <button type="submit" disabled={!content.trim() || isSending} className="min-h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
      {isSending ? 'Sending…' : 'Send'}
    </button>
  </form>;
}

export function ChatPage() {
  const { workspaceId = '', channelId } = useParams<{ workspaceId: string; channelId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const channelsQuery = useQuery({ queryKey: chatKeys.channels(workspaceId), queryFn: () => getChannels(workspaceId), enabled: Boolean(workspaceId) });
  const roleQuery = useQuery({ queryKey: chatKeys.workspace(workspaceId), queryFn: () => getWorkspaceRole(workspaceId), enabled: Boolean(workspaceId) });
  const membersQuery = useQuery({ queryKey: chatKeys.members(workspaceId), queryFn: () => getMembers(workspaceId), enabled: Boolean(workspaceId) });
  const channels = channelsQuery.data ?? [];
  const activeChannel = channels.find((channel) => channel.id === channelId) ?? (channelId ? undefined : channels[0]);
  const messagesKey = useMemo(() => chatKeys.messages(activeChannel?.id ?? ''), [activeChannel?.id]);
  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => getMessages(activeChannel!.id),
    enabled: Boolean(activeChannel),
  });
  const canManage = canManageChannels(roleQuery.data?.myRole);
  const connectionState = useChatRealtime(workspaceId, activeChannel?.id);

  useEffect(() => {
    if (!channelsQuery.isPending && !channelsQuery.isError && channels[0] && (!channelId || !channels.some((channel) => channel.id === channelId))) {
      navigate(`/w/${encodeURIComponent(workspaceId)}/chat/${encodeURIComponent(channels[0].id)}`, { replace: true });
    }
  }, [channelId, channels, channelsQuery.isError, channelsQuery.isPending, navigate, workspaceId]);

  const createMutation = useMutation({
    mutationFn: (name: string) => createChannel(workspaceId, name),
    onSuccess: async (channel) => {
      setMutationMessage(null);
      await queryClient.invalidateQueries({ queryKey: chatKeys.channels(workspaceId) });
      navigate(`/w/${encodeURIComponent(workspaceId)}/chat/${encodeURIComponent(channel.id)}`);
    },
    onError: (error) => setMutationMessage(friendlyError(error, 'The channel could not be created. Try again.')),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteChannel,
    onSuccess: async (_result, deletedId) => {
      setConfirmDeleteId(null);
      setMutationMessage(null);
      const nextChannel = channels.find((channel) => channel.id !== deletedId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.channels(workspaceId) }),
        queryClient.removeQueries({ queryKey: chatKeys.messages(deletedId) }),
      ]);
      if (channelId === deletedId) {
        navigate(nextChannel ? `/w/${encodeURIComponent(workspaceId)}/chat/${encodeURIComponent(nextChannel.id)}` : `/w/${encodeURIComponent(workspaceId)}/chat`);
      }
    },
    onError: (error) => setMutationMessage(friendlyError(error, 'The channel could not be deleted. Try again.')),
  });
  const sendMutation = useMutation({
    mutationFn: ({ content, mentionIds }: { content: string; mentionIds: string[] }) => postMessage(activeChannel!.id, content, mentionIds),
    onSuccess: (message) => {
      setMutationMessage(null);
      queryClient.setQueryData<MessagesPage>(chatKeys.messages(message.channelId), (current) => current
        ? { ...current, messages: mergeMessages(current.messages, [message]) }
        : { messages: [message], nextCursor: null });
    },
    onError: (error) => setMutationMessage(friendlyError(error, 'Your message could not be sent. Try again.')),
  });

  const loadEarlier = useCallback(async () => {
    if (!activeChannel || !messagesQuery.data?.nextCursor || messagesQuery.isFetching) return;
    try {
      const older = await getMessages(activeChannel.id, { before: messagesQuery.data.nextCursor });
      queryClient.setQueryData<MessagesPage>(chatKeys.messages(activeChannel.id), (current) => current
        ? { ...current, messages: mergeMessages(older.messages, current.messages), nextCursor: older.nextCursor }
        : older);
    } catch (error) {
      setMutationMessage(friendlyError(error, 'Earlier messages could not be loaded. Try again.'));
    }
  }, [activeChannel, messagesQuery.data, messagesQuery.isFetching, queryClient]);

  function selectChannel(channel: Channel) {
    setMutationMessage(null);
    navigate(`/w/${encodeURIComponent(workspaceId)}/chat/${encodeURIComponent(channel.id)}`);
  }

  function createFromForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (name) createMutation.mutate(name);
  }

  return <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 p-3 sm:p-5">
    <h1 className="sr-only">Workspace chat</h1>
    {channelsQuery.isPending ? <div role="status" aria-label="Loading channels" className="space-y-3 rounded-lg border border-line bg-surface p-4"><div className="h-5 w-32 animate-pulse rounded bg-surface-muted" /><div className="h-12 animate-pulse rounded bg-surface-muted" /></div> : null}
    {channelsQuery.isError ? <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-danger bg-danger-bg p-4 text-fg">
      <p>{friendlyError(channelsQuery.error, 'Channels could not be loaded.')}</p>
      <button type="button" onClick={() => void channelsQuery.refetch()} disabled={channelsQuery.isFetching} className="min-h-11 rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>
    </div> : null}
    {!channelsQuery.isPending && !channelsQuery.isError && <>
      <ChannelList channels={channels} selectedId={activeChannel?.id} canManage={canManage} isCreating={createMutation.isPending} onSelect={selectChannel} onCreate={createFromForm} />
      {mutationMessage && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg"><p>{mutationMessage}</p><button type="button" aria-label="Dismiss message" onClick={() => setMutationMessage(null)} className="min-h-11 px-2 font-semibold">Dismiss</button></div>}
      {!activeChannel ? <section aria-label="Chat messages" className="flex min-h-48 flex-1 items-center justify-center rounded-lg border border-line bg-surface p-6 text-center">
        <div><h2 className="font-semibold text-fg">No channels yet</h2><p className="mt-2 text-sm text-fg-muted">{canManage ? 'Create a channel to start the conversation.' : 'An administrator can create a channel for this workspace.'}</p></div>
      </section> : <section aria-label={`Chat in ${activeChannel.name}`} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        {connectionState !== 'connected' && <div role="status" className="border-b border-warning bg-warning-bg px-4 py-2 text-sm text-fg">
          {connectionState === 'disconnected' ? 'Reconnecting. Missed messages will load automatically.' : 'Connecting to chat…'}
        </div>}
        <header className="flex flex-wrap items-center gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold text-fg"><span aria-hidden="true"># </span>{activeChannel.name}</h2><p className="text-xs text-fg-muted">Workspace channel</p></div>
          {channels.length > 0 && <label className="sr-only" htmlFor="mobile-channel-select">Choose channel</label>}
          {channels.length > 1 && <select id="mobile-channel-select" value={activeChannel.id} onChange={(event) => { const next = channels.find((channel) => channel.id === event.target.value); if (next) selectChannel(next); }} className="min-h-11 max-w-full rounded-md border border-line bg-surface px-3 text-sm text-fg md:hidden">
            {channels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}
          </select>}
          {canManage && <div className="flex items-center gap-2">
            {confirmDeleteId === activeChannel.id ? <><span className="text-xs text-fg-muted">Delete this channel?</span><button type="button" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(activeChannel.id)} className="min-h-11 rounded-md bg-danger px-3 text-sm font-semibold text-white disabled:opacity-50">{deleteMutation.isPending ? 'Deleting…' : 'Confirm'}</button><button type="button" onClick={() => setConfirmDeleteId(null)} className="min-h-11 rounded-md px-3 text-sm font-medium text-fg hover:bg-surface-muted">Cancel</button></> : <button type="button" onClick={() => setConfirmDeleteId(activeChannel.id)} className="min-h-11 rounded-md px-3 text-sm font-medium text-danger hover:bg-danger-bg">Delete channel</button>}
          </div>}
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 sm:p-4">
          {messagesQuery.isPending ? <div role="status" aria-label="Loading messages" className="space-y-3 p-2"><div className="h-14 animate-pulse rounded bg-surface-muted" /><div className="h-14 animate-pulse rounded bg-surface-muted" /></div> : null}
          {messagesQuery.isError ? <div role="alert" className="m-2 flex flex-col items-start gap-3 rounded-md border border-danger bg-danger-bg p-4 text-fg">
            <p>{friendlyError(messagesQuery.error, 'Messages could not be loaded.')}</p>
            <button type="button" onClick={() => void messagesQuery.refetch()} disabled={messagesQuery.isFetching} className="min-h-11 rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>
          </div> : null}
          {!messagesQuery.isPending && !messagesQuery.isError && (messagesQuery.data?.messages.length ?? 0) === 0 ? <div className="flex flex-1 items-center justify-center p-6 text-center"><div><h3 className="font-semibold text-fg">Start the conversation</h3><p className="mt-1 text-sm text-fg-muted">Send the first message in #{activeChannel.name}.</p></div></div> : null}
          {!messagesQuery.isPending && !messagesQuery.isError && (messagesQuery.data?.messages.length ?? 0) > 0 ? <>
            {messagesQuery.data?.nextCursor && <button type="button" onClick={() => void loadEarlier()} disabled={messagesQuery.isFetching} className="mx-auto mb-3 min-h-11 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50">{messagesQuery.isFetching ? 'Loading…' : 'Load earlier messages'}</button>}
            <ol aria-label="Messages" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-1">
              {messagesQuery.data?.messages.map((message) => <MessageItem key={message.id} message={message} />)}
            </ol>
          </> : null}
        </div>
        {membersQuery.isError && <p role="status" className="mx-3 mb-2 text-xs text-fg-muted">Member suggestions are unavailable. You can still send a message.</p>}
        <MessageComposer channel={activeChannel} members={membersQuery.data ?? []} isSending={sendMutation.isPending} onSend={(content, mentionIds) => { setMutationMessage(null); sendMutation.mutate({ content, mentionIds }); }} />
      </section>}
    </>}
  </main>;
}
