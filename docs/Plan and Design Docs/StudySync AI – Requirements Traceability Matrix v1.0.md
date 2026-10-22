# StudySync AI: Requirements Traceability Matrix (RTM)

Oct 14, 2026 · @Saleamlak

This matrix links all 43 Must functional requirements and 15 non-functional requirements of SRS v2.0 to their design, interface, data and test case, so nothing is built without a requirement and nothing is left untested. Every requirement has a design section and a reserved test case ID.

## 1. How to Use This Matrix

- **Sources:** requirement IDs come from SRS v2.0; design references are SDD v1.0 section numbers; interfaces come from the API specification; data names come from the ERD.
- **Test IDs** follow `TC-<AREA>-<number>`. They are reserved here; the steps and expected results go in the test plan and test cases document.
- **Status** starts as Not started. When a requirement is built, replace the status with the pull request or file path, then with Passed after its test passes.
- **Scope:** Should and Could requirements are added as rows when the team decides to build them.
- **Code location:** backend in `apps/api/src/modules/<module>`, shared types in `packages/shared`.

## 2. Functional Requirements (Must)

### 2.1 Authentication and Profile

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-AUTH-01 | Register with name, email, password | 4, 6.1 | POST /auth/register | User | TC-AUTH-01 | Passed — S00, `apps/api/src/modules/auth/auth.test.ts` |
| FR-AUTH-02 | Login, logout, rotating refresh tokens | 6.1 | POST /auth/login, /auth/refresh, /auth/logout | User, RefreshToken | TC-AUTH-02 | Passed — S00, `apps/api/src/modules/auth/auth.test.ts` |
| FR-AUTH-03 | Passwords stored only as hashes | 6.1, 8 | POST /auth/register | User.passwordHash | TC-AUTH-03 | Passed — S00, `apps/api/src/modules/auth/auth.test.ts` |
| FR-AUTH-04 | Role checks on every route and socket event | 6.1 | All protected endpoints; workspace:join | Membership | TC-AUTH-04 | Partial — S00 tests unauthenticated profile access; full route and socket role matrix remains for S16 |
| FR-AUTH-07 | Suspended users cannot log in and are disconnected | 6.1 | POST /auth/login; PATCH /admin/users/:id | User.status, RefreshToken | TC-AUTH-05 | Partial — S00 tests suspended login and refresh; admin suspension and socket disconnection remain for S15 |
| FR-PROF-01 | Edit name, bio, avatar | 4 | GET and PATCH /me | User | TC-PROF-01 | Partial — S00 tests name and bio; avatar coverage remains |
| FR-PROF-02 | Personal dashboard of cards and deadlines | 4 | GET /me/dashboard | Card, CardAssignee | TC-PROF-02 | Implemented — TC-PROF-02 added; execution blocked because local PostgreSQL migration setup failed |

### 2.2 Workspaces

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-WS-01 | Create a workspace | 4 | POST /workspaces | Workspace, Membership, Board, Channel | TC-WS-01 | Passed — S01, `apps/api/src/modules/workspaces/workspaces.test.ts` |
| FR-WS-02 | Invite and join by link | 4 | POST /workspaces/:id/invites; POST /invites/:code/join | InviteLink, Membership | TC-WS-02 | Passed — S02, `apps/api/src/modules/workspaces/members-invites.test.ts` |
| FR-WS-03 | Owner assigns Admin or Member | 6.1 | PATCH /workspaces/:id/members/:userId | Membership | TC-WS-03 | Passed — S02, `apps/api/src/modules/workspaces/members-invites.test.ts` |
| FR-WS-04 | Remove members | 4 | DELETE /workspaces/:id/members/:userId | Membership | TC-WS-04 | Passed — S02, `apps/api/src/modules/workspaces/members-invites.test.ts` |
| FR-WS-05 | Archive with 30-day recovery and purge | 6.5 | POST /workspaces/:id/archive and /restore; daily purge job | Workspace.archivedAt | TC-WS-05 | Partial — S01 archive, restore and expiry checks passed; purge remains for S12 |
| FR-WS-06 | Owner enables AI and records consent | 6.4 | PUT /workspaces/:id/ai-consent | Workspace.aiEnabled, aiConsentAt | TC-WS-06 | Passed — S01, `apps/api/src/modules/workspaces/workspaces.test.ts` |

### 2.3 Kanban Board

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-TASK-01 | Create, rename, reorder, delete lists | 4 | POST /workspaces/:id/lists; PATCH, DELETE /lists/:id; POST /lists/:id/move | List | TC-TASK-01 | Passed — S03, `apps/api/src/modules/board/board.test.ts` |
| FR-TASK-02 | Create, edit, delete cards with assignees, labels, due date | 4 | POST /lists/:id/cards; GET, PATCH, DELETE /cards/:id; GET, POST /workspaces/:id/labels | Card, CardAssignee, Label, CardLabel | TC-TASK-02, TC-TASK-05, TC-NOT-01 | Passed — S03/S04/S09; TC-TASK-02, TC-TASK-05 and TC-NOT-01 passed; PR/staging pending |
| FR-TASK-03 | Drag and drop with conflict-safe order | 6.3 | POST /cards/:id/move | Card.position | TC-TASK-03 | Implemented — S05; tests added, execution blocked because the configured test database is unavailable |
| FR-TASK-04 | Board changes appear live for all members | 6.2 | board:card\_created, card\_updated, card\_moved, card\_deleted, list\_changed | none | TC-TASK-04 | Implemented — S05; socket integration test added, execution blocked because the configured test database is unavailable |
| FR-TASK-05 | Comments with mentions | 4 | GET, POST /cards/:id/comments; DELETE /comments/:id | Comment, Notification | TC-TASK-05, TC-NOT-01 | Passed — S04/S09; TC-TASK-05 and TC-NOT-01 passed; PR/staging pending |

### 2.4 Chat and Files

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-CHAT-01 | Channels per workspace | 4 | GET and POST /workspaces/:id/channels; DELETE /channels/:id | Channel | TC-CHAT-01 | Implemented — TC-CHAT-01 passed |
| FR-CHAT-02 | Messages saved and delivered live | 6.2 | POST /channels/:id/messages; message:new | Message | TC-CHAT-02 | Implemented — TC-CHAT-02 passed, including member-only socket delivery |
| FR-CHAT-03 | Mentions notify members | 4 | POST /channels/:id/messages (mentionIds) | Notification | TC-CHAT-03, TC-NOT-01 | Passed — S07/S09; TC-CHAT-03 and TC-NOT-01 passed; PR/staging pending |
| FR-CHAT-04 | Share a file in chat | 6.6 | POST /channels/:id/messages (fileId) | Message.fileId, File | TC-CHAT-04 | Passed — S08 uploaded attachment integration; foreign-workspace file rejected |
| FR-CHAT-05 | Catch up after reconnect without duplicates | 6.2 | GET /channels/:id/messages?after= | Message | TC-CHAT-05 | Implemented — TC-CHAT-05 passed for initial, before, and bounded after pages |
| FR-FILE-01 | Upload with type and size limits | 6.6 | POST /workspaces/:id/files | File, FileBlob | TC-FILE-01 | Passed — S08, allowed types and file/workspace size limits verified |
| FR-FILE-02 | Download only for workspace members | 6.6 | GET /files/:id | File, FileBlob, Membership | TC-FILE-02 | Passed — S08, exact bytes/type for member; non-member receives 404 |
| FR-FILE-03 | List workspace files | 4 | GET /workspaces/:id/files | File | TC-FILE-03 | Passed — S08, newest-first safe metadata and cursor paging verified |

### 2.5 Notifications and Reminders

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-NOT-01 | In-app notifications, delivered live | 6.2 | GET /notifications; notification:new | Notification | TC-NOT-01 | Passed — S09; TC-NOT-01 passed; PR/staging pending |
| FR-NOT-02 | Mark read or unread | 4 | POST /notifications/:id/read and /read-all | Notification.readAt | TC-NOT-02 | Passed — S09; TC-NOT-02 passed; PR/staging pending |
| FR-NOT-03 | Scheduled deadline reminders without duplicates | 6.5 | Scheduled job; notification:new | Reminder, Notification | TC-NOT-03 | Not started |

### 2.6 AI Features

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-AI-01 | AI assistant panel in each workspace | 4, 7 | Web app panel calling /ai/\* | none | TC-AI-01 | Not started |
| FR-AI-02 | Answer from user-selected context | 6.4 | POST /workspaces/:id/ai/ask | AIRequestLog | TC-AI-02 | Not started |
| FR-AI-03 | Summarize chat, card or TXT, PDF, DOCX file | 6.4 | POST /workspaces/:id/ai/summarize | AIRequestLog, File | TC-AI-03 | Not started |
| FR-AI-04 | Task breakdown: preview, confirm, create cards | 6.4 | POST /workspaces/:id/ai/breakdown and /breakdown/confirm | Card, AIRequestLog | TC-AI-04 | Not started |
| FR-AI-05 | Provider timeout, retry and fallback | 6.4 | AI provider router (internal) | AIRequestLog.provider | TC-AI-05 | Not started |
| FR-AI-06 | No content sent without owner consent | 6.4, 8 | All /ai/\* (403 AI\_DISABLED) | Workspace.aiEnabled | TC-AI-06 | Not started |
| FR-AI-07 | Per-user and per-workspace limits, request log | 6.4 | All /ai/\* (429 AI\_LIMIT\_REACHED) | AIRequestLog | TC-AI-07 | Not started |
| FR-AI-08 | Clear failure message, nothing partly created | 6.4 | 502 AI\_UNAVAILABLE, AI\_BAD\_OUTPUT | none | TC-AI-08 | Not started |
| FR-AI-09 | Prompt-injection mitigation, confirm before changes | 6.4, 8 | Prompt builder and parser (internal) | none | TC-AI-09 | Not started |

### 2.7 Search, Dashboard and Administration

| ID | Requirement | SDD | Interface | Data | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-SRCH-01 | Full-text search within a workspace | 5.2 | GET /workspaces/:id/search | Card, Message, File | TC-SRCH-01 | Not started |
| FR-ANA-01 | Workspace progress dashboard | 4 | GET /workspaces/:id/dashboard | Card, List | TC-ANA-01 | Not started |
| FR-ANA-02 | Personal view of assigned cards and deadlines | 4 | GET /me/dashboard | Card, CardAssignee | TC-PROF-02 (shared) | Implemented — TC-PROF-02 added; execution blocked because local PostgreSQL migration setup failed |
| FR-ADM-01 | List, search, suspend and reactivate users | 4 | GET /admin/users; PATCH /admin/users/:id | User | TC-ADM-01 | Not started |
| FR-ADM-02 | View AI usage and adjust limits | 4 | GET /admin/ai-usage; GET and PUT /admin/ai-limits | AIRequestLog, AppSetting | TC-ADM-02 | Not started |

## 3. Non-Functional Requirements

| ID | Requirement | Verification | SDD | Test | Status |
| --- | --- | --- | --- | --- | --- |
| NFR-01 | API p95 under 500 ms on seeded data | k6 run on staging | 2, 5.2 | TC-NFR-01 | Not started |
| NFR-02 | Chat and card-move events within 1 s | Scripted two-client timing test | 6.2 | TC-NFR-02 | Not started |
| NFR-03 | Page load under 3 s on throttled mobile | Lighthouse report | 7 | TC-NFR-03 | Not started |
| NFR-04 | AI timeout 30 s, then fallback or failure | Mocked slow provider tests | 6.4 | TC-NFR-04 | Not started |
| NFR-05 | 50 concurrent users for 5 minutes | Artillery run | 3.3 | TC-NFR-05 | Not started |
| NFR-06 | HTTPS, CORS, security headers, rate limits | Configuration review, automated test | 8 | TC-NFR-06 | Not started |
| NFR-07 | Input validation, parameterized queries, sanitized output | Unit tests, checklist review | 8 | TC-NFR-07 | Not started |
| NFR-08 | Role check on every route and socket event, with negative tests | Test suite coverage report | 6.1 | TC-NFR-08 | Not started |
| NFR-09 | Secrets only in server environment variables | Repository scan, review | 9 | TC-NFR-09 | Not started |
| NFR-10 | No lost or duplicate messages after a 30 s drop | Manual and scripted disconnect test | 6.2 | TC-NFR-10 | Not started |
| NFR-11 | Best-effort availability, keep-warm ping, backup before demo | Demo checklist | 3.3, 9 | TC-NFR-11 | Not started |
| NFR-12 | New user creates workspace and card in 3 minutes; works at 360 px | Test with 5 users, responsive check | 7 | TC-NFR-12 | Not started |
| NFR-13 | Lint and type checks in CI, at least 60% coverage on core modules | CI report | 9 | TC-NFR-13 | Not started |
| NFR-14 | Account deletion, deletable AI history, metadata-only logs | Test, schema review | 5.2, 6.4 | TC-NFR-14 | Not started |
| NFR-15 | Consent notice names third-party AI providers | UI review | 6.4 | TC-NFR-15 | Not started |

## 4. Coverage and Gaps

- **Coverage:** every Must requirement has a design section, an interface or internal component, the data it touches and a reserved test ID.
- **FR-ADM-02:** viewing AI usage and adjusting limits are both designed; limits are stored in the AppSetting table and changed with PUT /admin/ai-limits.
- **Shared test:** FR-PROF-02 and FR-ANA-02 use the same endpoint and share TC-PROF-02.
- **Internal-only items:** FR-AI-05 and FR-AI-09 have no endpoint of their own; their tests call the AI service directly with a mocked provider.
- **Next step:** the test plan turns each reserved test ID into steps and expected results, and records the test tool for each.
