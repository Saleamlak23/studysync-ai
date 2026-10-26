# StudySync AI: API Specification

Oct 14, 2026 · @Saleamlak

This specification defines the REST endpoints and Socket.io events of the StudySync AI API, matching SDD section 4 and the schema in the ERD. All endpoints below are Must requirements unless marked (S).

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `/api/v1`; JSON bodies, `Content-Type: application/json` (files use multipart) |
| Authentication | Header `Authorization: Bearer <accessToken>` (15 minutes). The refresh token lives in an httpOnly, Secure, SameSite cookie and is used only by `/auth/refresh` |
| IDs and dates | UUID strings; timestamps in ISO 8601 UTC |
| Roles | Public, User (signed in), Member, Admin (workspace Admin or Owner), Owner, SysAdmin |
| Non-members | Requests for a workspace the caller does not belong to return 404, not 403, so existence is not revealed |
| Pagination | `?limit=` (default 50, max 100) and `?cursor=`; responses include `nextCursor` or null |
| Validation | Every body, query and path parameter is validated with a Zod schema shared with the web app |
| Rate limits | Login and register: 10 per minute per IP; AI endpoints: per-user and per-workspace daily limits (defaults set in configuration, adjustable by the System Admin) |

### Error format

All errors return `{ "error": { "code": "...", "message": "...", "details": [...] } }`.

| HTTP | Code | When |
| --- | --- | --- |
| 400 | VALIDATION\_ERROR | Invalid input; `details` lists fields |
| 401 | UNAUTHENTICATED, TOKEN\_EXPIRED | Missing, invalid or expired access token |
| 403 | FORBIDDEN, ACCOUNT\_SUSPENDED, AI\_DISABLED | Role too low, suspended user, workspace has no AI consent |
| 404 | NOT\_FOUND | Missing resource or non-member access |
| 409 | CONFLICT | Duplicate email, channel name, label name or membership |
| 413 / 415 | FILE\_TOO\_LARGE, STORAGE\_LIMIT\_REACHED, UNSUPPORTED\_FILE\_TYPE | Upload rejected |
| 429 | RATE\_LIMITED, AI\_LIMIT\_REACHED | Limit hit; `AI_LIMIT_REACHED` includes `resetAt` |
| 502 | AI\_UNAVAILABLE, AI\_BAD\_OUTPUT | Both providers failed, or output failed schema validation after one repair attempt |
| 500 | INTERNAL | Unexpected error; no internals exposed |

### Common objects

| Object | Fields |
| --- | --- |
| User | id, name, email, avatarUrl, bio, systemRole, status (email only for the user themselves and workspace Admins) |
| Workspace | id, name, description, aiEnabled, archivedAt, myRole |
| Card | id, listId, title, description, priority, dueDate, position, assignees\[\], labels\[\], commentCount, createdAt, updatedAt |
| Channel | id, workspaceId, name, createdAt |
| Message | id, channelId, author {id, name, avatarUrl} or null, content, file {id, name, mimeType, sizeBytes, uploader, createdAt} or null, createdAt |
| File | id, name, mimeType, sizeBytes, uploader, createdAt (never the file bytes) |
| Notification | id, type, workspaceId, payload, readAt, createdAt |

## 2. Authentication and Profile

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| POST /auth/register | Public | name, email, password (min 8 characters) | 201 `{ user, accessToken }`; sets refresh cookie; 409 if email exists |
| POST /auth/login | Public | email, password | 200 `{ user, accessToken }`; sets refresh cookie; 401 on bad credentials; 403 ACCOUNT\_SUSPENDED |
| POST /auth/refresh | Cookie | none | 200 `{ accessToken }`; rotates the refresh token; reuse of a revoked token revokes the whole chain and returns 401 |
| POST /auth/logout | User | none | 204; revokes the refresh token and clears the cookie |
| GET /me | User | none | 200 `{ user, workspaces: [Workspace] }` |
| PATCH /me | User | name, bio, avatarUrl (any) | 200 User |
| GET /me/dashboard | User | none | 200 `{ assignedCards: DashboardCard[], upcomingDeadlines: DashboardCard[] }`; cards assigned to the requester in their unarchived workspaces, with `list: { id, name }` and `workspace: { id, name }` context. `upcomingDeadlines` is the subset with a due date at or after request time, ordered soonest first; overdue and undated cards remain in `assignedCards` only. |

## 3. Workspaces

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| POST /workspaces | User | name, description? | 201 Workspace; creator becomes Owner; a board and a #general channel are created |
| GET /workspaces | User | none | 200 `[Workspace]` the caller belongs to (archived excluded), each with `myRole`, `memberCount`, and `openCardCount` (cards not in the last-position list) |
| GET /workspaces/:id | Member | none | 200 Workspace with myRole |
| PATCH /workspaces/:id | Admin | name?, description? | 200 Workspace |
| POST /workspaces/:id/archive | Owner | none | 200; soft delete, recoverable for 30 days |
| POST /workspaces/:id/restore | Owner | none | 200; only while within the 30-day window |
| PUT /workspaces/:id/ai-consent | Owner | enabled (boolean) | 200 `{ aiEnabled, aiConsentAt }`; records who consented |
| GET /workspaces/:id/members | Member | none | 200 `[{ user, role, joinedAt }]` |
| PATCH /workspaces/:id/members/:userId | Owner | role: ADMIN or MEMBER | 200; the Owner role cannot be changed here |
| DELETE /workspaces/:id/members/:userId | Admin | none | 204; Admins cannot remove the Owner; a Member may remove themselves |
| POST /workspaces/:id/invites | Admin | expiresAt? | 201 `{ id, code, expiresAt }` |
| GET /workspaces/:id/invites | Admin | none | 200 active invite links |
| DELETE /workspaces/:id/invites/:inviteId | Admin | none | 204; sets revokedAt |
| POST /invites/:code/join | User | none | 200 Workspace; 404 if revoked or expired; 409 if already a member |

## 4. Board

A card's status is the list it sits in. Positions are computed by the server; clients send neighbors, never position numbers.

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| GET /workspaces/:id/board | Member | none | 200 `{ board, lists: [{ ...list, cards: [Card] }] }`; creates an empty board if the workspace's board record is missing |
| POST /workspaces/:id/lists | Admin | name | 201 List, appended at the end; creates an empty board if the workspace's board record is missing |
| PATCH /lists/:id | Admin | name | 200 List |
| POST /lists/:id/move | Admin | afterListId? | 200 List; omitted means move to the start |
| DELETE /lists/:id | Admin | none | 204; deletes its cards |
| POST /lists/:id/cards | Member | title, description?, priority?, dueDate?, assigneeIds?, labelIds? | 201 Card at the end of the list; assignees must be workspace members |
| GET /cards/:id | Member | none | 200 Card |
| PATCH /cards/:id | Member | any of title, description, priority, dueDate, assigneeIds, labelIds | 200 Card; new assignees get a notification |
| POST /cards/:id/move | Member | toListId, afterCardId? | 200 Card with new position; both lists must belong to the same workspace |
| DELETE /cards/:id | Admin or author | none | 204 |
| GET /cards/:id/comments | Member | cursor? | 200 `[Comment]` oldest first |
| POST /cards/:id/comments | Member | body, mentionIds? | 201 Comment; mentioned members get a notification |
| DELETE /comments/:id | Admin or author | none | 204 |
| GET /workspaces/:id/labels | Member | none | 200 `[Label]` |
| POST /workspaces/:id/labels | Member | name, color | 201 Label; 409 on duplicate name |

## 5. Chat

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| GET /workspaces/:id/channels | Member | none | 200 `[Channel]` |
| POST /workspaces/:id/channels | Admin | name | 201 Channel; 409 on duplicate name |
| DELETE /channels/:id | Admin | none | 204 |
| GET /channels/:id/messages | Member | limit? (default 50, max 100), before?, after? (message ids) | 200 `{ messages, nextCursor }`; initial and `before` pages are chronological; `before` and `after` cannot be combined. `nextCursor` is the oldest returned message when older results remain, and the latest returned message for a capped `after` page when newer results remain. `after` returns messages in ascending order for reconnect catch-up. |
| POST /channels/:id/messages | Member | content, fileId?, mentionIds? | 201 Message; optional file must belong to the channel workspace; mention IDs must be workspace members. Broadcast as `message:new` after commit. Mention notifications are added in S09. |
| PATCH /messages/:id (S) | Author | content | 200 Message |
| DELETE /messages/:id (S) | Admin or author | none | 204; soft delete |

## 6. Files

Allowed types: PDF, DOCX, TXT, PNG, JPG. Maximum size: 5 MB per file (5,242,880 bytes) and a per-workspace storage cap (default 100 MB, configurable). Files are stored in PostgreSQL in a separate table and streamed through the API, so no external storage service is needed.

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| POST /workspaces/:id/files | Member | multipart field `file` | 201 File; 413 if the file or the workspace storage cap is exceeded, 415 if the type is not allowed |
| GET /workspaces/:id/files | Member | limit? (default 50, max 100), cursor? (file ID) | 200 `[File]` newest first; cursor returns files older than the cursor. Each item includes safe metadata and uploader, never bytes |
| GET /workspaces/:id/files/summary | Member | none | 200 `{ fileCount, usedBytes, limitBytes }`; workspace-wide totals, without file bytes |
| GET /files/:id | Member | none | 200 `file download`; the file bytes are streamed with Content-Type and Content-Disposition headers, only after a membership check |

## 7. Notifications

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| GET /notifications | User | unread?, cursor? | 200 `{ notifications, nextCursor, unreadCount }` |
| POST /notifications/:id/read | User | none | 200 Notification |
| POST /notifications/read-all | User | none | 204 |

Deadline reminders are created by the scheduled job, not by an endpoint, and arrive as `DEADLINE` notifications.

## 8. AI

All AI endpoints require Member role, a workspace with `aiEnabled` true, and available limits. Context is selected by the user as ids; the server loads the content itself after a membership check.

| Method and path | Request | Response |
| --- | --- | --- |
| POST /workspaces/:id/ai/ask | question, context: \[{ type: card, message\_range or file; ids or range }\], optional history: up to 10 `{ role: user or assistant, content }` messages (max 4,000 characters each) for follow-ups; selected workspace content remains the source for workspace facts | 200 `{ answer, provider }` |
| POST /workspaces/:id/ai/summarize | target: { type: message\_range, card or file; ... } | 200 `{ summary, provider }`; files: TXT, PDF, DOCX within the size cap |
| POST /workspaces/:id/ai/breakdown | description, listId | 200 `{ items: [{ title, description, priority, dueDate? }], provider }`; preview only, nothing is created |
| POST /workspaces/:id/ai/breakdown/confirm | listId, items (edited by the user) | 201 `[Card]`; the server re-validates every item, creates all cards in one transaction and broadcasts the board events |

AI-specific errors: AI\_DISABLED (403), AI\_LIMIT\_REACHED (429, with `resetAt`), AI\_UNAVAILABLE and AI\_BAD\_OUTPUT (502). Each call writes an AIRequestLog row with metadata only.

## 9. Search and Dashboard

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| GET /workspaces/:id/search | Member | q (min 2 characters), type? (cards, messages, files), limit? | 200 `{ cards[], messages[], files[] }` with plain-text snippets (no HTML highlight markup); full-text search, membership enforced |
| GET /workspaces/:id/dashboard | Member | none | 200 `{ cardsPerList[], overdue, completed, open, contributions[] }`; creates an empty board if the workspace's board record is missing |

## 10. System Administration

| Method and path | Role | Request | Response and notes |
| --- | --- | --- | --- |
| GET /admin/users | SysAdmin | q?, status?, cursor? | 200 `[User]` with status |
| PATCH /admin/users/:id | SysAdmin | status: ACTIVE or SUSPENDED | 200 User; suspension revokes refresh tokens and disconnects sockets |
| GET /admin/ai-usage | SysAdmin | from?, to?, userId?, workspaceId? | 200 totals and rows grouped by user, workspace, feature and provider |
| GET /admin/ai-limits | SysAdmin | none | 200 { userDailyLimit, workspaceDailyLimit, updatedAt }; the configured defaults are returned until the first change |
| PUT /admin/ai-limits | SysAdmin | userDailyLimit, workspaceDailyLimit (positive integers) | 200 the saved limits; stored in AppSetting, applied from the next AI request and kept across restarts |

## 11. Real-Time Events (Socket.io)

Connect with `auth: { token: <accessToken> }`. The server validates the token and the user's status at the handshake; after a token refresh the client reconnects. Writes always use the REST endpoints above; sockets only push.

| Event | Direction | Payload | Notes |
| --- | --- | --- | --- |
| workspace:join | Client to server | { workspaceId } | Ack `{ ok }`; joins `workspace:{id}` and `board:{id}` after a membership check |
| channel:join, channel:leave | Client to server | { channelId } | Joins `channel:{id}` after a membership check |
| message:new | Server to client | Message | After the message is saved |
| board:card\_created, board:card\_updated | Server to client | Card | After the change commits |
| board:card\_moved | Server to client | { cardId, fromListId, toListId, position, renumbered? } | `renumbered` is true when other cards' positions changed; clients refetch the board instead of patching locally |
| board:card\_deleted | Server to client | { cardId, listId } |  |
| board:list\_changed | Server to client | { lists: \[{ id, name, position }\] } | Create, rename, move or delete of a list |
| notification:new | Server to client | Notification | Sent to room `user:{id}` |
| presence:update (S) | Server to client | { userId, online } |  |

On reconnect the client calls `GET /channels/:id/messages?after=<lastMessageId>` for each open channel and refetches the board.

## 12. Assumptions and Open Points

- **Done cards.** The dashboard counts a card as completed when it sits in the last list of the board; confirm this rule with the team.
- **AI limits.** Limits live in the AppSetting table (keys ai.userDailyLimit and ai.workspaceDailyLimit) and are edited with PUT /admin/ai-limits; until a row exists the defaults from configuration apply. Choose the default values after measuring the free-tier quotas of the AI providers.
- **Machine-readable spec.** Generate `openapi.yaml` from the shared Zod schemas (for example with zod-to-openapi) so the web app, tests and this document stay in sync.
- **Versioning.** The `/v1` prefix is kept so later breaking changes do not affect the demo build.

* **File storage in PostgreSQL.** Files are kept in a FileBlob table and streamed by the API. This replaces Cloudinary, whose Free plan blocks PDF delivery by default and has no token-based authentication. Check the database host's storage limit and set the per-workspace cap to fit it, and keep storage behind a FileStorage interface so object storage can replace it later.
