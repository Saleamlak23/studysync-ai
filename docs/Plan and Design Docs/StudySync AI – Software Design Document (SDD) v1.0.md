# StudySync AI: Software Design Document (SDD)

Oct 14, 2026 · @Saleamlak

This SDD turns SRS v2.0 into a buildable design: a modular monolith (React single-page app, Express API, PostgreSQL) with Socket.io for live updates and a provider-agnostic AI service. It is the basis for the ERD, API specification, test plan and traceability matrix.

## 1. Introduction

**Purpose.** Describe architecture, modules, data, interfaces and key decisions so three developers can build in parallel without rework.

**Scope.** All Must requirements of SRS v2.0; Should and Could items are noted only where the design must leave room for them.

**References.** SRS v2.0 (IDs FR-\* and NFR-\*) and its stack in section 2.3. Requirement IDs are used below to trace design back to the SRS.

## 2. Architectural Drivers

| Driver | Source | Design response |
| --- | --- | --- |
| Live board and chat for several users | FR-TASK-04, FR-CHAT-02, NFR-02 | Socket.io rooms per workspace, board and channel; events sent after the database commit |
| Concurrent card moves must not corrupt order | FR-TASK-03 | Fractional card positions assigned by the server |
| Unreliable connections | FR-CHAT-05, NFR-10 | Auto reconnect; REST catch-up by last message id; board refetch on reconnect |
| Strict access control | FR-AUTH-04, NFR-08 | One RBAC layer shared by REST and socket handlers |
| Free-tier AI quotas and outages | FR-AI-05 to 07, NFR-04 | Provider interface, Groq to Gemini fallback, limits table, timeouts |
| Untrusted AI output and content | FR-AI-04, FR-AI-09 | Schema-validated JSON, preview and confirm, delimited prompts |
| 3 developers, 8 weeks | SRS 2.4 | Modular monolith, one repo, shared types, vertical slices, deploy in week 1 |
| Free-tier hosting | NFR-05, NFR-11 | Stateless API, keep-warm ping, managed Postgres, files stored in PostgreSQL |

## 3. Architecture Overview

### 3.1 Style

Client-server **modular monolith**: one Express app split into feature modules with clear boundaries and one PostgreSQL database. Microservices are rejected as too costly for the team and timeline. REST carries all commands and queries; Socket.io only pushes events to clients.

### 3.2 Layers

| Layer | Responsibility | Technology |
| --- | --- | --- |
| Presentation | UI, routing, UI state, socket client | React, TypeScript, Vite, Tailwind v4, React Router, dnd-kit, Recharts |
| API | Routes, input validation, auth and RBAC middleware, rate limiting | Express, Zod, Helmet, express-rate-limit |
| Real-time | Handshake auth, rooms, broadcasts | Socket.io |
| Service | Business rules per module, transactions | TypeScript services |
| Data access | Queries and migrations | Prisma, PostgreSQL |
| Integration | AI, files, email, scheduler | Groq and Gemini clients, Nodemailer, node-cron |

### 3.3 Deployment View

| Component | Host | Notes |
| --- | --- | --- |
| Web client (static build) | Vercel or Netlify | Calls the API over HTTPS |
| API and Socket.io server | Render or Railway | Single stateless instance; keep-warm ping |
| PostgreSQL | Neon or similar | Managed; backup before the demo |
| File storage | PostgreSQL (same database) | Bytes in a separate FileBlob table, streamed through the API; type and size checked by the API |
| AI providers | Groq, Gemini | Keys only in server environment variables |
| Email (Should features) | SMTP provider | Optional |

A single instance needs no Socket.io adapter; a Redis adapter would be added only if the API is scaled out.

### 3.4 Repository Structure

npm workspaces monorepo: `apps/web`, `apps/api` (`src/modules/<feature>/` with routes, service, schema, tests; plus `src/realtime`, `src/ai`, `src/jobs`, `src/middleware`), `packages/shared` (types, Zod schemas, event names) and `prisma/schema.prisma`.

## 4. Module Design

| Module | Responsibility | Main interface | Main tables | SRS |
| --- | --- | --- | --- | --- |
| Auth and Profile | Register, login, refresh rotation, logout, suspension check, profile | POST /auth/register, /auth/login, /auth/refresh, /auth/logout; GET and PATCH /me | User, RefreshToken | FR-AUTH-01 to 04, 07; FR-PROF-01 |
| Workspace | Workspaces, memberships, roles, invite links, archive, AI consent | /workspaces, /workspaces/:id/members, /workspaces/:id/invites, POST /invites/:code/join | Workspace, Membership, InviteLink | FR-WS-01 to 06 |
| Board | Lists, cards, comments, ordering | /workspaces/:id/board, /lists, /cards, POST /cards/:id/move, /cards/:id/comments; board:\* events | List, Card, CardAssignee, Label, Comment | FR-TASK-01 to 05 |
| Chat | Channels, messages, catch-up | /channels, GET /channels/:id/messages?after=; message:new | Channel, Message | FR-CHAT-01 to 05 |
| File | Upload, list, authorized download | POST and GET /workspaces/:id/files, GET /files/:id | File, FileBlob | FR-FILE-01 to 03 |
| Notification | Create, deliver, read; reminder job | /notifications, POST /notifications/:id/read; notification:new | Notification, Reminder | FR-NOT-01 to 03 |
| AI | Providers, context, summaries, task breakdown, consent, limits | POST /workspaces/:id/ai/ask, /summarize, /breakdown, /breakdown/confirm | AIRequestLog | FR-AI-01 to 09 |
| Search | Full-text search | GET /workspaces/:id/search?q= | tsvector columns | FR-SRCH-01 |
| Dashboard | Progress aggregates | GET /workspaces/:id/dashboard, GET /me/dashboard | Queries over Card | FR-ANA-01, 02; FR-PROF-02 |
| Admin | Users and AI usage | /admin/users, /admin/ai-usage, /admin/ai-limits | User, AIRequestLog, AppSetting | FR-ADM-01, 02 |

## 5. Data Design

### 5.1 Key Relationships

- User 1..N Membership N..1 Workspace; the role is stored on Membership.
- Workspace 1..1 Board, 1..N List; List 1..N Card; Card N..N User (CardAssignee); Card 1..N Comment; Card N..N Label.
- Workspace 1..N Channel; Channel 1..N Message; a Message may reference a File.
- Workspace 1..N File, InviteLink, AIRequestLog; each File has one FileBlob that holds its bytes.
- User 1..N Notification and RefreshToken; Card 1..N Reminder.

### 5.2 Data Decisions

| Decision | Rationale |
| --- | --- |
| UUID primary keys | No guessable ids in URLs |
| Card.position is a fractional number within its list | A move updates one row |
| Soft delete (archivedAt, deletedAt) plus a purge job | FR-WS-05, FR-PROF-03 |
| Unique (userId, workspaceId) on Membership | One role per user per workspace |
| Message cursor is (createdAt, id) | Stable catch-up after reconnect |
| tsvector column and GIN index on Card and Message text | Fast search without an extra service (NFR-01) |
| AIRequestLog stores metadata only | NFR-14 |
| Unique (cardId, type, dueAt) on Reminder | No duplicate reminders |
| Indexes: Card(listId, position), Message(channelId, createdAt), Notification(userId, readAt) | Query performance |

The ERD with full fields is the next document.

## 6. Key Design Details

### 6.1 Authentication and Authorization

Login returns a 15-minute access token in the response and a 7-day refresh token in an httpOnly, Secure, SameSite cookie. Refresh rotates the token and records the old one as revoked; reuse of a revoked token revokes the whole chain. The socket handshake sends the access token; on expiry the client refreshes and reconnects.

Middleware chain: authenticate, loadMembership, requireRole. Socket handlers call the same permission functions as REST.

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| Read workspace data, post cards and messages | Yes | Yes | Yes |
| Create, rename, delete lists and channels | Yes | Yes | No |
| Delete other members' cards or messages | Yes | Yes | No |
| Create and revoke invite links, remove members | Yes | Yes | No |
| Change member roles | Yes | No | No |
| Enable AI and give consent; archive workspace | Yes | No | No |
| Use AI features (when enabled) | Yes | Yes | Yes |

### 6.2 Real-Time Design

Writes go through REST, so every change has one validated path. After the database commit the server broadcasts to rooms: `user:{id}`, `workspace:{id}`, `board:{workspaceId}`, `channel:{id}`. A socket joins a room only after a membership check.

| Event | Direction | Trigger |
| --- | --- | --- |
| message:new | Server to client | Message saved |
| board:card\_created, card\_updated, card\_moved, card\_deleted, list\_changed | Server to client | Board change committed |
| notification:new | Server to client | Notification saved |
| presence:update (Should) | Server to client | Connect or disconnect |

Reconnect: the client keeps the last message id per channel and calls GET messages?after= to catch up, and refetches the board; message ids prevent duplicates.

### 6.3 Board Ordering

A moved card gets the average of its new neighbors' positions; at the start or end of a list it gets plus or minus 1024. If the gap becomes too small the list is renumbered in one transaction. The move runs in a transaction, checks that both lists belong to the workspace, and then broadcasts. The client updates optimistically and rolls back if the server rejects the move.

### 6.4 AI Service

Structure: AI controller, AIService (consent check, limit check, context builder, prompt builder, parser), an `AIProvider` interface with GroqProvider and GeminiProvider, and a router that applies a 30-second timeout, one retry and fallback.

The assistant presents an in-memory conversation for the current workspace and selected context. Follow-up requests send at most the last 10 user/assistant messages (4,000 characters each); the API validates and treats the transcript as untrusted input. Workspace context is still loaded server-side from the selected item IDs and remains the source for workspace facts; prior assistant advice may be explained as suggestions, not verified workspace facts. Conversations are not persisted.

Task breakdown flow:

1. Authenticate, check membership and that the workspace owner enabled AI.
2. Check the per-user daily and per-workspace limits (read from the AppSetting table, with defaults from configuration); reject with the reset time if exceeded.
3. Build the prompt: fixed instructions plus user content in a delimited block marked as untrusted data.
4. Call Groq; on timeout or error retry once, then call Gemini.
5. Parse the JSON and validate it with a Zod schema (title, description, priority, optional due date); on invalid output retry once with a repair instruction, otherwise fail with a clear message.
6. Log metadata (user, workspace, feature, provider, tokens, status) to AIRequestLog.
7. Return a preview; nothing is written yet.
8. On confirm the server re-validates the edited items, creates the cards in one transaction and broadcasts the board events.

For ask and summarize, the user selects the context items; the server loads them itself after a membership check, truncates them to a token budget, and applies the same prompt rules. Uploaded files are converted to text on the server (TXT directly, PDF and DOCX with parsing libraries) within a size cap; failures return a clear error.

### 6.5 Scheduled Jobs

Every 15 minutes `node-cron` finds cards due within 24 hours that have no reminder, then inserts the Reminder and Notification in one transaction and pushes the event. A daily job purges workspaces archived more than 30 days ago.

### 6.6 File Handling

The client uploads to the API (multipart). The API checks membership, a MIME type allowlist and the size limit, checks the workspace storage cap, and saves a File row and a FileBlob row (the bytes) in one transaction. Downloads are streamed by the API after a membership check; bytes are read only on download, never with normal file queries. Storage sits behind a FileStorage interface so object storage can replace it later.

## 7. Frontend Design

| Route | Page | Guard |
| --- | --- | --- |
| /login, /register | Authentication | Public |
| / | Personal dashboard | Signed in |
| /join/:code | Accept invite | Signed in |
| /w/:id | Workspace dashboard | Member |
| /w/:id/board | Kanban board | Member |
| /w/:id/chat/:channelId | Chat | Member |
| /w/:id/files | Files | Member |
| /w/:id/settings | Members, invites, AI consent | Admin or Owner |
| /admin | System administration | System Admin |

Server data is fetched with TanStack Query; socket events update its cache. Auth state lives in a React context. The layout is a sidebar, main area and an AI side panel, usable from 360 px width. The shared package supplies types and Zod schemas to both apps.

## 8. Security Design

| Threat | Control | SRS |
| --- | --- | --- |
| Stolen or replayed tokens | Short access token, rotating refresh token, httpOnly cookie, refresh accepted only as a same-site JSON request | FR-AUTH-02 |
| Access across workspaces | Membership check on every route and socket join, negative test for each | NFR-08 |
| Injection and XSS | Zod validation, Prisma parameters, sanitized output, Helmet and CSP | NFR-07 |
| Brute force and abuse | Rate limits on login and AI endpoints | NFR-06 |
| Prompt injection | Delimited untrusted content, schema validation, no change without user confirmation | FR-AI-09 |
| Secret leakage | Environment variables only, secret scan in CI | NFR-09 |
| Data sent to AI | Owner consent, notice, no message bodies in logs | FR-AI-06, NFR-14, NFR-15 |
| Malicious files | Type and size allowlist, per-workspace storage cap, downloads streamed only after a membership check | FR-FILE-01 |

## 9. Deployment and Environments

Local development uses a local or hosted dev database. Staging deploys from `develop` and production (the demo) from `main`. GitHub Actions runs lint, type check, tests and build on every pull request and deploys on merge; `prisma migrate deploy` runs at release. Server variables: DATABASE\_URL, JWT\_SECRET, REFRESH\_SECRET, CLIENT\_ORIGIN, GROQ\_API\_KEY, GEMINI\_API\_KEY, and SMTP settings if email is used.

## 10. Design Decisions

| Decision | Alternative | Why |
| --- | --- | --- |
| Modular monolith | Microservices | Team size and deployment effort |
| REST for writes, sockets push only | Writes over sockets | One validated path, simpler RBAC and tests |
| Fractional positions | Renumber whole list | One-row moves, safe concurrency |
| PostgreSQL full-text search | Elasticsearch | No extra service |
| Provider interface with fallback | Single provider | Free-tier limits and outages |
| Preview and confirm for AI | Auto-create cards | Safety and trust |
| Invite links | Email invites | No email dependency |
| Single API instance | Multi-instance with Redis | Scale not needed for the demo |

## 11. Coverage of the SRS (seed for the traceability matrix)

| SRS section | Module | SDD sections |
| --- | --- | --- |
| 3.1 Authentication, 3.2 Profile | Auth and Profile | 4, 6.1 |
| 3.3 Workspaces | Workspace | 4, 5, 6.1 |
| 3.4 Kanban | Board | 4, 6.2, 6.3 |
| 3.5 Chat | Chat | 4, 6.2 |
| 3.6 Files | File | 4, 6.6 |
| 3.7 Notifications | Notification | 4, 6.5 |
| 3.8 AI | AI | 4, 6.4 |
| 3.9 Search | Search | 4, 5.2 |
| 3.10 Dashboard | Dashboard | 4 |
| 3.12 Administration | Admin | 4 |

The traceability matrix will add, per requirement ID, the code module and the test case.

## 12. Open Items

- Tune token lifetimes and the default AI limits (editable by the System Admin through AppSetting) after measuring provider quotas.
- Check the database host's storage limit and set the per-workspace file cap to fit it; files are stored in PostgreSQL, so no external storage service is needed.
- Diagrams are in section 13; add flows for invite join and file upload only if time allows.

## 13. Diagrams

### 13.1 Architecture and Deployment

&#91;embedded content: architecture and deployment · 4 tiers\]

The web build is served by a static host; the browser talks to one API instance over REST and Socket.io, and the API reaches PostgreSQL through Prisma and the AI providers over HTTPS.

### 13.2 Login Sequence

&#91;embedded content: login sequence · 3 participants\]

The refresh token rotates on every use, so a stolen old token is detected when it is replayed.

### 13.3 Card Move Sequence

&#91;embedded content: card move sequence · 4 participants\]

The move is committed before anything is broadcast, so other members never see a change that was rolled back.

### 13.4 AI Task Breakdown Sequence

&#91;embedded content: AI task breakdown sequence · 5 participants\]

Only the confirm call writes cards; the first call and the AI output itself change nothing.
