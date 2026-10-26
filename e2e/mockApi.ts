import type { Page, Route } from '@playwright/test';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER';
type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: null;
  bio: null;
  systemRole: 'USER';
  status: 'ACTIVE';
};
type Workspace = {
  id: string;
  name: string;
  description: string | null;
  aiEnabled: boolean;
  myRole: Role;
  boardId: string;
  lists: MockList[];
};
type MockCard = {
  id: string;
  listId: string;
  position: number;
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  createdById: string;
  assignees: Array<{ userId: string; user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> }>;
  labels: [];
};
type MockList = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  cards: MockCard[];
};
type MockChannel = { id: string; workspaceId: string; name: string; createdAt: string };
type MockFile = {
  id: string;
  workspaceId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploader: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  createdAt: string;
};
type MockMessage = {
  id: string;
  channelId: string;
  author: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  content: string;
  file: MockFile | null;
  createdAt: string;
};
type MockNotification = {
  id: string;
  type: 'ASSIGNED' | 'MENTION' | 'DEADLINE';
  workspaceId: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};
type SocketSession = {
  sid: string;
  userId: string | null;
  workspaceId: string | null;
  channelId: string | null;
  queue: string[];
  connected: boolean;
};
type MockInvite = { id: string; code: string; expiresAt: null; createdAt: string };

const now = () => new Date().toISOString();
const response = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });
const errorBody = (code: string, message: string) => ({ error: { code, message } });

export class MockApi {
  private sequence = 0;
  private readonly usersByEmail = new Map<string, { user: User; password: string }>();
  private readonly usersById = new Map<string, User>();
  private readonly userByToken = new Map<string, string>();
  private readonly userByRefreshToken = new Map<string, string>();
  private readonly workspaces = new Map<string, Workspace>();
  private readonly memberships = new Map<string, Map<string, Role>>();
  private readonly inviteCodes = new Map<string, string>();
  private readonly invites = new Map<string, MockInvite[]>();
  private readonly channels = new Map<string, MockChannel[]>();
  private readonly messages = new Map<string, MockMessage[]>();
  private readonly files = new Map<string, MockFile[]>();
  private readonly notifications = new Map<string, MockNotification[]>();
  private readonly sessions = new Map<string, SocketSession>();
  private previewFailures = 0;

  private id(): string {
    this.sequence += 1;
    return `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
  }

  private issueSession(userId: string): { accessToken: string; refreshToken: string } {
    const accessToken = `session-${this.id()}`;
    const refreshToken = `refresh-${this.id()}`;
    this.userByToken.set(accessToken, userId);
    this.userByRefreshToken.set(refreshToken, userId);
    return { accessToken, refreshToken };
  }

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/**', (route) => this.handleHttp(route));
    await page.route('**/socket.io/**', (route) => this.handleSocket(route));
  }

  failNextBreakdownPreview(): void {
    this.previewFailures += 1;
  }

  seedDeadlineFor(userId: string, workspaceId: string): void {
    this.addNotification(userId, workspaceId, 'DEADLINE');
  }

  userIdFor(email: string): string | undefined {
    return this.usersByEmail.get(email.toLowerCase())?.user.id;
  }

  accessTokenFor(email: string): string | undefined {
    const userId = this.userIdFor(email);
    if (!userId) return undefined;
    return [...this.userByToken].find(([, tokenUserId]) => tokenUserId === userId)?.[0];
  }

  channelIdFor(workspaceId: string): string | undefined {
    return this.channels.get(workspaceId)?.[0]?.id;
  }

  fileIdFor(workspaceId: string, name: string): string | undefined {
    return this.files.get(workspaceId)?.find((file) => file.name === name)?.id;
  }

  fileFor(workspaceId: string, fileId: string): MockFile | undefined {
    return this.files.get(workspaceId)?.find((file) => file.id === fileId);
  }

  cardCountFor(workspaceId: string): number {
    return this.workspaces.get(workspaceId)?.lists.reduce((count, list) => count + list.cards.length, 0) ?? 0;
  }

  cardIdForTitle(workspaceId: string, title: string): string | undefined {
    return this.workspaces.get(workspaceId)?.lists.flatMap((list) => list.cards).find((card) => card.title === title)?.id;
  }

  socketSessionCountFor(userId: string): number {
    return [...this.sessions.values()].filter((session) => session.userId === userId).length;
  }

  connectedWorkspaceSocketCountFor(userId: string, workspaceId: string): number {
    return [...this.sessions.values()].filter((session) =>
      session.userId === userId && session.workspaceId === workspaceId && session.connected,
    ).length;
  }

  disconnectSocketsFor(userId: string): void {
    for (const session of this.sessions.values()) {
      if (session.userId !== userId || !session.connected) continue;
      session.connected = false;
      session.queue.push('1');
    }
  }

  moveCardWithoutEvent(workspaceId: string, cardId: string, toListName: string): void {
    const workspace = this.workspaces.get(workspaceId);
    const source = workspace?.lists.find((list) => list.cards.some((card) => card.id === cardId));
    const target = workspace?.lists.find((list) => list.name === toListName);
    const card = source?.cards.find((item) => item.id === cardId);
    if (!source || !target || !card) throw new Error('Cannot move a missing mock card or list');
    source.cards = source.cards.filter((item) => item.id !== cardId);
    card.listId = target.id;
    card.position = (target.cards.at(-1)?.position ?? 0) + 1024;
    target.cards.push(card);
  }

  private addNotification(userId: string, workspaceId: string, type: MockNotification['type']): MockNotification {
    const notification: MockNotification = {
      id: this.id(),
      type,
      workspaceId,
      payload: { cardId: this.id(), title: 'Prepare for the study session' },
      readAt: null,
      createdAt: now(),
    };
    const list = this.notifications.get(userId) ?? [];
    list.unshift(notification);
    this.notifications.set(userId, list);
    this.emitToUser(userId, 'notification:new', notification);
    return notification;
  }

  private emit(session: SocketSession, event: string, payload: unknown): void {
    if (session.connected) session.queue.push(`42${JSON.stringify([event, payload])}`);
  }

  private emitToUser(userId: string, event: string, payload: unknown): void {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) this.emit(session, event, payload);
    }
  }

  private emitToWorkspace(workspaceId: string, event: string, payload: unknown): void {
    for (const session of this.sessions.values()) {
      if (session.workspaceId === workspaceId) this.emit(session, event, payload);
    }
  }

  private emitToChannel(channelId: string, event: string, payload: unknown): void {
    for (const session of this.sessions.values()) {
      if (session.channelId === channelId) this.emit(session, event, payload);
    }
  }

  private userFor(route: Route): User | undefined {
    const header = route.request().headers().authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const userId = token ? this.userByToken.get(token) : undefined;
    return userId ? this.usersById.get(userId) : undefined;
  }

  private body(route: Route): Record<string, unknown> {
    const value: unknown = route.request().postDataJSON();
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private workspaceForMember(user: User | undefined, workspaceId: string): Workspace | undefined {
    if (!user || !this.memberships.get(workspaceId)?.has(user.id)) return undefined;
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;
    return { ...workspace, myRole: this.memberships.get(workspaceId)?.get(user.id) ?? 'MEMBER' };
  }

  private summary(user: User, workspace: Workspace): object {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      myRole: this.memberships.get(workspace.id)?.get(user.id) ?? 'MEMBER',
    };
  }

  private workspaceForList(listId: string): Workspace | undefined {
    return [...this.workspaces.values()].find((workspace) => workspace.lists.some((list) => list.id === listId));
  }

  private workspaceForCard(cardId: string): { workspace: Workspace; list: MockList; card: MockCard } | undefined {
    for (const workspace of this.workspaces.values()) {
      for (const list of workspace.lists) {
        const card = list.cards.find((candidate) => candidate.id === cardId);
        if (card) return { workspace, list, card };
      }
    }
    return undefined;
  }

  private async handleHttp(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    const user = this.userFor(route);
    const workspaceMatch = pathname.match(/^\/workspaces\/([^/]+)(\/.*)?$/);

    if (pathname === '/auth/refresh' && method === 'POST') {
      const refreshToken = request.headers().cookie?.match(/(?:^|;\s*)refresh_token=([^;]+)/)?.[1];
      const userId = refreshToken ? this.userByRefreshToken.get(refreshToken) : undefined;
      if (!refreshToken || !userId) {
        return void await route.fulfill(response(errorBody('UNAUTHENTICATED', 'Sign in required'), 401));
      }
      this.userByRefreshToken.delete(refreshToken);
      const session = this.issueSession(userId);
      return void await route.fulfill({
        ...response({ accessToken: session.accessToken }),
        headers: { 'Set-Cookie': `refresh_token=${session.refreshToken}; HttpOnly; Path=/api/v1/auth; SameSite=Lax` },
      });
    }

    if (pathname === '/auth/register' && method === 'POST') {
      const input = this.body(route);
      const email = String(input.email ?? '').toLowerCase();
      if (this.usersByEmail.has(email)) return void await route.fulfill(response(errorBody('CONFLICT', 'That already exists.'), 409));
      const account: User = {
        id: this.id(),
        name: String(input.name ?? 'Study member'),
        email,
        avatarUrl: null,
        bio: null,
        systemRole: 'USER',
        status: 'ACTIVE',
      };
      const password = String(input.password ?? '');
      this.usersByEmail.set(email, { user: account, password });
      this.usersById.set(account.id, account);
      const session = this.issueSession(account.id);
      return void await route.fulfill({
        ...response({ user: account, accessToken: session.accessToken }, 201),
        headers: { 'Set-Cookie': `refresh_token=${session.refreshToken}; HttpOnly; Path=/api/v1/auth; SameSite=Lax` },
      });
    }

    if (pathname === '/auth/login' && method === 'POST') {
      const input = this.body(route);
      const account = this.usersByEmail.get(String(input.email ?? '').toLowerCase());
      if (!account || account.password !== input.password) {
        return void await route.fulfill(response(errorBody('UNAUTHENTICATED', 'Sign in required'), 401));
      }
      const session = this.issueSession(account.user.id);
      return void await route.fulfill({
        ...response({ user: account.user, accessToken: session.accessToken }),
        headers: { 'Set-Cookie': `refresh_token=${session.refreshToken}; HttpOnly; Path=/api/v1/auth; SameSite=Lax` },
      });
    }

    if (pathname === '/auth/logout' && method === 'POST') {
      return void await route.fulfill({ status: 204 });
    }

    if (!user) return void await route.fulfill(response(errorBody('UNAUTHENTICATED', 'Sign in required'), 401));

    if (pathname === '/me') {
      return void await route.fulfill(response({
        user,
        workspaces: [...this.workspaces.values()]
          .filter((workspace) => this.memberships.get(workspace.id)?.has(user.id))
          .map((workspace) => this.summary(user, workspace)),
      }));
    }

    if (pathname === '/me/dashboard') {
      return void await route.fulfill(response({ assignedCards: [], upcomingDeadlines: [] }));
    }

    if (pathname === '/notifications' && method === 'GET') {
      const notifications = this.notifications.get(user.id) ?? [];
      return void await route.fulfill(response({
        notifications,
        nextCursor: null,
        unreadCount: notifications.filter((item) => item.readAt === null).length,
      }));
    }

    const readNotificationMatch = pathname.match(/^\/notifications\/([^/]+)\/read$/);
    if (readNotificationMatch && method === 'POST') {
      const notification = this.notifications.get(user.id)?.find((item) => item.id === readNotificationMatch[1]);
      if (!notification) return void await route.fulfill(response(errorBody('NOT_FOUND', 'Notification not found'), 404));
      notification.readAt = now();
      return void await route.fulfill(response(notification));
    }

    if (pathname === '/notifications/read-all' && method === 'POST') {
      for (const notification of this.notifications.get(user.id) ?? []) notification.readAt ??= now();
      return void await route.fulfill({ status: 204 });
    }

    const fileMatch = pathname.match(/^\/files\/([^/]+)$/);
    if (fileMatch && method === 'GET') {
      const workspaceEntry = [...this.files.entries()].find(([, items]) => items.some((file) => file.id === fileMatch[1]));
      const file = workspaceEntry?.[1].find((item) => item.id === fileMatch[1]);
      if (!workspaceEntry || !file || !this.workspaceForMember(user, workspaceEntry[0])) {
        return void await route.fulfill(response(errorBody('NOT_FOUND', 'File not found'), 404));
      }
      return void await route.fulfill({ status: 200, contentType: file.mimeType, body: `Mock file content: ${file.name}` });
    }

    if (pathname === '/workspaces' && method === 'GET') {
      const owned = [...this.workspaces.values()]
        .filter((workspace) => this.memberships.get(workspace.id)?.has(user.id))
        .map((workspace) => this.summary(user, workspace));
      return void await route.fulfill(response(owned));
    }

    if (pathname === '/workspaces' && method === 'POST') {
      const input = this.body(route);
      const id = this.id();
      const boardId = this.id();
      const firstListId = this.id();
      const lastListId = this.id();
      const workspace: Workspace = {
        id,
        boardId,
        name: String(input.name ?? 'Study workspace'),
        description: typeof input.description === 'string' ? input.description : null,
        aiEnabled: false,
        myRole: 'OWNER',
        lists: [
          { id: firstListId, boardId, name: 'To do', position: 1024, cards: [] },
          { id: lastListId, boardId, name: 'Done', position: 2048, cards: [] },
        ],
      };
      this.workspaces.set(id, workspace);
      this.memberships.set(id, new Map([[user.id, 'OWNER']]));
      this.channels.set(id, [{ id: this.id(), workspaceId: id, name: 'general', createdAt: now() }]);
      this.messages.set(this.channels.get(id)?.[0]?.id ?? '', []);
      this.files.set(id, []);
      this.inviteCodes.set('study-invite', id);
      this.invites.set(id, []);
      return void await route.fulfill(response(this.summary(user, workspace), 201));
    }

    const joinMatch = pathname.match(/^\/invites\/([^/]+)\/join$/);
    if (joinMatch && method === 'POST') {
      const workspaceId = this.inviteCodes.get(joinMatch[1] ?? '');
      const workspace = workspaceId ? this.workspaces.get(workspaceId) : undefined;
      if (!workspace) return void await route.fulfill(response(errorBody('NOT_FOUND', 'Invite not found'), 404));
      const members = this.memberships.get(workspace.id) ?? new Map<string, Role>();
      if (members.has(user.id)) return void await route.fulfill(response(errorBody('CONFLICT', 'Already a member'), 409));
      members.set(user.id, 'MEMBER');
      this.memberships.set(workspace.id, members);
      return void await route.fulfill(response(this.summary(user, workspace)));
    }

    const channelMessagesMatch = pathname.match(/^\/channels\/([^/]+)\/messages$/);
    if (channelMessagesMatch) {
      const channelId = channelMessagesMatch[1] ?? '';
      const workspaceId = [...this.channels.entries()].find(([, channels]) => channels.some((channel) => channel.id === channelId))?.[0];
      if (!workspaceId || !this.workspaceForMember(user, workspaceId)) {
        return void await route.fulfill(response(errorBody('NOT_FOUND', 'Channel not found'), 404));
      }
      const channelMessages = this.messages.get(channelId) ?? [];
      if (method === 'GET') return void await route.fulfill(response({ messages: channelMessages, nextCursor: null }));
      if (method === 'POST') {
        const input = this.body(route);
        const message: MockMessage = {
          id: this.id(),
          channelId,
          author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
          content: String(input.content ?? ''),
          file: typeof input.fileId === 'string' ? this.fileFor(workspaceId, input.fileId) ?? null : null,
          createdAt: now(),
        };
        channelMessages.push(message);
        this.messages.set(channelId, channelMessages);
        this.emitToChannel(channelId, 'message:new', message);
        if (Array.isArray(input.mentionIds)) {
          for (const mentionedUserId of input.mentionIds) {
            if (typeof mentionedUserId === 'string') this.addNotification(mentionedUserId, workspaceId, 'MENTION');
          }
        }
        return void await route.fulfill(response(message, 201));
      }
    }

    const cardMatch = pathname.match(/^\/cards\/([^/]+)(\/.*)?$/);
    if (cardMatch) {
      const found = this.workspaceForCard(cardMatch[1] ?? '');
      const permittedWorkspace = found ? this.workspaceForMember(user, found.workspace.id) : undefined;
      if (!found || !permittedWorkspace) return void await route.fulfill(response(errorBody('NOT_FOUND', 'Card not found'), 404));
      const cardSuffix = cardMatch[2] ?? '';
      if (!cardSuffix && method === 'GET') return void await route.fulfill(response(found.card));
      if (!cardSuffix && method === 'PATCH') {
        const input = this.body(route);
        found.card.title = typeof input.title === 'string' ? input.title : found.card.title;
        found.card.description = typeof input.description === 'string' ? input.description : null;
        found.card.priority = input.priority === 'LOW' || input.priority === 'HIGH' ? input.priority : 'MEDIUM';
        found.card.dueDate = typeof input.dueDate === 'string' ? input.dueDate : null;
        this.emitToWorkspace(found.workspace.id, 'board:card_updated', found.card);
        return void await route.fulfill(response(found.card));
      }
      if (cardSuffix === '/move' && method === 'POST') {
        const input = this.body(route);
        const target = found.workspace.lists.find((list) => list.id === input.toListId);
        if (!target) return void await route.fulfill(response(errorBody('VALIDATION_ERROR', 'List not found'), 400));
        const fromListId = found.card.listId;
        const source = found.workspace.lists.find((list) => list.id === fromListId);
        const targetCards = target.cards.filter((item) => item.id !== found.card.id);
        const afterCardId = typeof input.afterCardId === 'string' ? input.afterCardId : null;
        const afterIndex = afterCardId ? targetCards.findIndex((item) => item.id === afterCardId) : -1;
        if (afterCardId && afterIndex < 0) {
          return void await route.fulfill(response(errorBody('VALIDATION_ERROR', 'Card not found'), 400));
        }
        if (source) source.cards = source.cards.filter((item) => item.id !== found.card.id);
        found.card.listId = target.id;
        targetCards.splice(afterIndex + 1, 0, found.card);
        target.cards = targetCards;
        target.cards.forEach((item, index) => { item.position = (index + 1) * 1024; });
        this.emitToWorkspace(found.workspace.id, 'board:card_moved', {
          cardId: found.card.id,
          fromListId,
          toListId: target.id,
          position: found.card.position,
          renumbered: false,
        });
        return void await route.fulfill(response(found.card));
      }
      if (cardSuffix === '/comments' && method === 'GET') return void await route.fulfill(response([]));
      if (cardSuffix === '/comments' && method === 'POST') {
        const input = this.body(route);
        return void await route.fulfill(response({
          id: this.id(),
          cardId: found.card.id,
          authorId: user.id,
          body: String(input.body ?? ''),
          createdAt: now(),
          author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
        }, 201));
      }
    }

    const createCardMatch = pathname.match(/^\/lists\/([^/]+)\/cards$/);
    if (createCardMatch && method === 'POST') {
      const listId = createCardMatch[1] ?? '';
      const workspace = this.workspaceForList(listId);
      const member = workspace && this.workspaceForMember(user, workspace.id);
      const list = workspace?.lists.find((candidate) => candidate.id === listId);
      if (!workspace || !member || !list) return void await route.fulfill(response(errorBody('NOT_FOUND', 'List not found'), 404));
      const card = this.newCard(list, user, this.body(route));
      list.cards.push(card);
      this.emitToWorkspace(workspace.id, 'board:card_created', card);
      return void await route.fulfill(response(card, 201));
    }

    if (!workspaceMatch) return void await route.fulfill(response(errorBody('NOT_FOUND', 'Not found'), 404));
    const workspaceId = decodeURIComponent(workspaceMatch[1] ?? '');
    const suffix = workspaceMatch[2] ?? '';
    const workspace = this.workspaceForMember(user, workspaceId);
    if (!workspace) return void await route.fulfill(response(errorBody('NOT_FOUND', 'Workspace not found'), 404));

    if (!suffix && method === 'GET') {
      return void await route.fulfill(response({ ...this.summary(user, workspace), aiEnabled: workspace.aiEnabled }));
    }

    if (suffix === '/board' && method === 'GET') {
      return void await route.fulfill(response({
        board: { id: workspace.boardId, workspaceId, name: workspace.name },
        lists: workspace.lists,
      }));
    }

    if (suffix === '/lists' && method === 'POST') {
      const role = this.memberships.get(workspaceId)?.get(user.id);
      if (role !== 'OWNER' && role !== 'ADMIN') return void await route.fulfill(response(errorBody('FORBIDDEN', 'Forbidden'), 403));
      const list: MockList = {
        id: this.id(),
        boardId: workspace.boardId,
        name: String(this.body(route).name ?? ''),
        position: (workspace.lists.at(-1)?.position ?? 0) + 1024,
        cards: [],
      };
      workspace.lists.push(list);
      return void await route.fulfill(response({ id: list.id, boardId: list.boardId, name: list.name, position: list.position }, 201));
    }

    if (suffix === '/dashboard' && method === 'GET') {
      const total = workspace.lists.reduce((sum, list) => sum + list.cards.length, 0);
      return void await route.fulfill(response({
        open: total,
        completed: 0,
        overdue: 0,
        cardsPerList: workspace.lists.map((list) => ({ listId: list.id, name: list.name, count: list.cards.length })),
        contributions: [],
      }));
    }

    if (suffix === '/members' && method === 'GET') {
      const members = this.memberships.get(workspaceId) ?? new Map<string, Role>();
      return void await route.fulfill(response([...members.entries()].flatMap(([userId, role]) => {
        const member = this.usersById.get(userId);
        return member ? [{ user: member, role, joinedAt: now() }] : [];
      })));
    }

    if (suffix === '/channels' && method === 'GET') {
      return void await route.fulfill(response(this.channels.get(workspaceId) ?? []));
    }

    if (suffix === '/channels' && method === 'POST') {
      const role = this.memberships.get(workspaceId)?.get(user.id);
      if (role !== 'OWNER' && role !== 'ADMIN') {
        return void await route.fulfill(response(errorBody('FORBIDDEN', 'You do not have permission to do that.'), 403));
      }
      const channel: MockChannel = { id: this.id(), workspaceId, name: String(this.body(route).name ?? ''), createdAt: now() };
      this.channels.get(workspaceId)?.push(channel);
      this.messages.set(channel.id, []);
      return void await route.fulfill(response(channel, 201));
    }

    if (suffix === '/labels' && method === 'GET') return void await route.fulfill(response([]));

    if (suffix === '/invites' && method === 'GET') {
      const role = this.memberships.get(workspaceId)?.get(user.id);
      if (role !== 'OWNER' && role !== 'ADMIN') return void await route.fulfill(response(errorBody('FORBIDDEN', 'Forbidden'), 403));
      return void await route.fulfill(response(this.invites.get(workspaceId) ?? []));
    }

    if (suffix === '/invites' && method === 'POST') {
      const role = this.memberships.get(workspaceId)?.get(user.id);
      if (role !== 'OWNER' && role !== 'ADMIN') return void await route.fulfill(response(errorBody('FORBIDDEN', 'Forbidden'), 403));
      const invite: MockInvite = { id: this.id(), code: 'study-invite', expiresAt: null, createdAt: now() };
      this.invites.set(workspaceId, [...(this.invites.get(workspaceId) ?? []), invite]);
      this.inviteCodes.set(invite.code, workspaceId);
      return void await route.fulfill(response({ id: invite.id, code: invite.code, expiresAt: invite.expiresAt }, 201));
    }

    const revokeInviteMatch = suffix.match(/^\/invites\/([^/]+)$/);
    if (revokeInviteMatch && method === 'DELETE') {
      const role = this.memberships.get(workspaceId)?.get(user.id);
      if (role !== 'OWNER' && role !== 'ADMIN') return void await route.fulfill(response(errorBody('FORBIDDEN', 'Forbidden'), 403));
      const inviteId = revokeInviteMatch[1] ?? '';
      const current = this.invites.get(workspaceId) ?? [];
      const removed = current.find((invite) => invite.id === inviteId);
      if (!removed) return void await route.fulfill(response(errorBody('NOT_FOUND', 'Invite not found'), 404));
      this.invites.set(workspaceId, current.filter((invite) => invite.id !== inviteId));
      this.inviteCodes.delete(removed.code);
      return void await route.fulfill({ status: 204 });
    }

    if (suffix === '/ai-consent' && method === 'PUT') {
      if (this.memberships.get(workspaceId)?.get(user.id) !== 'OWNER') {
        return void await route.fulfill(response(errorBody('FORBIDDEN', 'Forbidden'), 403));
      }
      workspace.aiEnabled = this.body(route).enabled === true;
      this.workspaces.set(workspaceId, workspace);
      return void await route.fulfill(response({ aiEnabled: workspace.aiEnabled, aiConsentAt: workspace.aiEnabled ? now() : null }));
    }

    if (suffix === '/files' && method === 'GET') return void await route.fulfill(response(this.files.get(workspaceId) ?? []));

    if (suffix === '/files' && method === 'POST') {
      const file = this.fileFromUpload(route, workspaceId, user);
      this.files.get(workspaceId)?.unshift(file);
      return void await route.fulfill(response(file, 201));
    }

    if (suffix === '/ai/ask' && method === 'POST') {
      return void await route.fulfill(response({ answer: 'The selected study card recommends a focused review session.', provider: 'gemini' }));
    }

    if (suffix === '/ai/summarize' && method === 'POST') {
      return void await route.fulfill(response({ summary: 'A concise summary of the selected study context.', provider: 'gemini' }));
    }

    if (suffix === '/ai/breakdown' && method === 'POST') {
      if (this.previewFailures > 0) {
        this.previewFailures -= 1;
        return void await route.fulfill(response(errorBody('AI_UNAVAILABLE', 'The AI could not answer. Nothing was changed. Try again.'), 502));
      }
      return void await route.fulfill(response({
        provider: 'gemini',
        items: [
          { title: 'Review the project brief', description: 'Extract goals and constraints.', priority: 'HIGH' },
          { title: 'Prepare the study outline', description: 'Organize the learning objectives.', priority: 'MEDIUM' },
        ],
      }));
    }

    if (suffix === '/ai/breakdown/confirm' && method === 'POST') {
      const input = this.body(route);
      const listId = String(input.listId ?? '');
      const list = workspace.lists.find((candidate) => candidate.id === listId);
      const items = Array.isArray(input.items) ? input.items as Array<Record<string, unknown>> : [];
      if (!list) return void await route.fulfill(response(errorBody('NOT_FOUND', 'List not found'), 404));
      const created = items.map((item) => this.newCard(list, user, item));
      list.cards.push(...created);
      for (const card of created) this.emitToWorkspace(workspaceId, 'board:card_created', card);
      return void await route.fulfill(response(created, 201));
    }

    return void await route.fulfill(response(errorBody('NOT_FOUND', `Unmocked endpoint: ${method} ${pathname}`), 404));
  }

  private newCard(list: MockList, user: User, input: Record<string, unknown>): MockCard {
    return {
      id: this.id(),
      listId: list.id,
      position: (list.cards.at(-1)?.position ?? 0) + 1024,
      title: String(input.title ?? 'New study card'),
      description: typeof input.description === 'string' ? input.description : null,
      priority: input.priority === 'LOW' || input.priority === 'HIGH' ? input.priority : 'MEDIUM',
      dueDate: typeof input.dueDate === 'string' ? input.dueDate : null,
      createdById: user.id,
      assignees: [],
      labels: [],
    };
  }

  private fileFromUpload(route: Route, workspaceId: string, user: User): MockFile {
    const raw = route.request().postData() ?? '';
    const filename = raw.match(/filename="([^"]+)"/i)?.[1] ?? 'study-notes.pdf';
    const mimeType = raw.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'application/pdf';
    return {
      id: this.id(),
      workspaceId,
      name: filename,
      mimeType,
      sizeBytes: Math.max(1, raw.length),
      uploader: { id: user.id, name: user.name, avatarUrl: null },
      createdAt: now(),
    };
  }

  private async handleSocket(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const sid = url.searchParams.get('sid');
    if (url.searchParams.get('transport') !== 'polling') {
      return void await route.fulfill({ status: 400, body: 'Only mocked Engine.IO polling is available' });
    }

    if (request.method() === 'GET' && !sid) {
      const id = this.id();
      this.sessions.set(id, { sid: id, userId: null, workspaceId: null, channelId: null, queue: [], connected: false });
      return void await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: `0${JSON.stringify({ sid: id, upgrades: [], pingInterval: 60000, pingTimeout: 20000, maxPayload: 1000000 })}`,
      });
    }

    const session = sid ? this.sessions.get(sid) : undefined;
    if (!session) return void await route.fulfill({ status: 400, body: 'Unknown mock socket session' });

    if (request.method() === 'POST') {
      const packets = (request.postData() ?? '').split('\x1e');
      for (const packet of packets) {
        if (packet.startsWith('40')) {
          const auth = packet.slice(2);
          const token = auth ? (JSON.parse(auth) as { token?: string }).token : undefined;
          const userId = token ? this.userByToken.get(token) : undefined;
          session.userId = userId ?? null;
          session.connected = true;
          session.queue.push(`40${JSON.stringify({ sid: session.sid })}`);
        } else if (packet.startsWith('42')) {
          const parsed: unknown = JSON.parse(packet.slice(2));
          if (!Array.isArray(parsed) || typeof parsed[0] !== 'string') continue;
          const [event, payload] = parsed as [string, Record<string, unknown>];
          if (event === 'workspace:join') session.workspaceId = String(payload.workspaceId ?? '');
          if (event === 'channel:join') session.channelId = String(payload.channelId ?? '');
          if (event === 'channel:leave') session.channelId = null;
        }
      }
      return void await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
    }

    if (request.method() === 'GET') {
      if (session.queue.length === 0) await new Promise((resolve) => setTimeout(resolve, 100));
      return void await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: session.queue.shift() ?? '6',
      });
    }

    return void await route.fulfill({ status: 405, body: 'Method not mocked' });
  }
}
