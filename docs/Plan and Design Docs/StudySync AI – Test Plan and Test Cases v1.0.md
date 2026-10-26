# StudySync AI: Test Plan and Test Cases

Oct 14, 2026 · @Saleamlak

This plan defines how every Must requirement and non-functional target of SRS v2.0 will be verified, and gives a test case for each reserved ID in the traceability matrix (42 functional cases, 15 non-functional cases).

## 1. Scope and Approach

In scope: all Must requirements. Should and Could items get test cases only when they are built. Out of scope: testing the external AI providers themselves; AI calls are tested against a mocked provider, plus a few manual runs against the real ones before the demo.

| Level | What it checks | Tool | Type code |
| --- | --- | --- | --- |
| Unit | Pure logic: card ordering, provider fallback, schema validation, reminder selection | Vitest | U |
| API integration | Endpoints, roles, validation, database effects | Vitest and Supertest on a test database | I |
| Real-time | Socket events, rooms, reconnect | socket.io-client inside Vitest | S |
| End to end | The demo path in a real browser: sign up, create workspace, board, chat, AI breakdown | Playwright | E2E |
| Load | Latency and concurrent users | k6 or Artillery | L |
| Manual and review | Usability, UI, security checklist, disconnect behavior | Checklists, 5 test users | M |
| Acceptance | Supervisor accepts the system against the SRS acceptance criteria | UAT sheet | UAT |

## 2. Environment and Test Data

- **Environments:** local test database for automated tests; staging (deployed from `develop`) for load, end-to-end and manual tests; production (deployed from `main`) for the final demo check only.
- **Seed script:** users for each role (System Admin, Owner, Admin, Member, non-member, suspended user), two workspaces, and one large workspace with 500 cards and 5,000 messages for performance tests.
- **Mocks:** an AI provider mock that can return valid output, invalid JSON, a timeout or an error.
- **Devices:** current Chrome on desktop, and a 360 px wide phone viewport (real phone or browser emulation).

## 3. Roles and Responsibilities

| Who | Responsibility |
| --- | --- |
| Every member | Writes unit and integration tests for the slice they own, and does not merge with failing tests |
| Member 3 | Maintains this plan, the seed script, the end-to-end tests and the load tests |
| Team leader | Runs the full regression before each milestone, owns the final test report |
| Supervisor | Performs acceptance testing (UAT) in week 7 |

## 4. Entry, Exit and Defect Rules

- **Entry for a feature:** merged to `develop`, CI green (lint, type check, build), seed data available.
- **Exit for the project:** all Must test cases pass; no open Critical or High defects; every NFR measured and recorded; at least 60% coverage on auth, RBAC, board ordering, reminders and the AI service.

| Severity | Meaning | Fix by |
| --- | --- | --- |
| Critical | Data loss, security hole, or the demo path cannot run | Before the next merge |
| High | A Must feature does not work | Within the week |
| Medium | Feature works with a clear flaw | Before feature freeze or the final week |
| Low | Cosmetic | If time allows |

Every defect is logged with ID, test case ID, steps, severity, owner and status.

## 5. Functional Test Cases

AI tests use the mocked provider unless marked manual.

### 5.1 Authentication and Profile

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-AUTH-01 | FR-AUTH-01 | Register with valid data; repeat with the same email; register with a 5-character password | 201 with user and token; then 409; then 400 | I |
| TC-AUTH-02 | FR-AUTH-02 | Log in; refresh; reuse the old refresh token; log out | New token each refresh; reused token gets 401 and revokes the chain; logout clears the cookie | I |
| TC-AUTH-03 | FR-AUTH-03 | Register, then inspect the database row and all API responses | Only a bcrypt or Argon2 hash is stored; no password or hash in any response | I |
| TC-AUTH-04 | FR-AUTH-04 | Call every protected route and socket join as no token, non-member, Member, Admin, Owner | 401, 404 or 403 as specified; permitted roles succeed | I, S |
| TC-AUTH-05 | FR-AUTH-07 | Suspend a signed-in user; try login, refresh and the open socket | Login 403; refresh 401; socket disconnected | I, S |
| TC-PROF-01 | FR-PROF-01 | PATCH /me with a new name and bio; then with invalid data | Profile updated; invalid input 400 | I |
| TC-PROF-02 | FR-PROF-02, FR-ANA-02 | Assign dated cards to a user in two workspaces; GET /me/dashboard | Only that user's cards and deadlines, soonest first | I |

### 5.2 Workspaces

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-WS-01 | FR-WS-01 | Create a workspace | Creator is Owner; a board and a #general channel exist | I |
| TC-WS-02 | FR-WS-02 | Create an invite; second user joins; join again; use a revoked and an expired link | Joins as Member; second join 409; bad links 404 | I |
| TC-WS-03 | FR-WS-03 | Owner changes a role; Admin tries; try to change the Owner | Owner succeeds; Admin 403; Owner role unchanged | I |
| TC-WS-04 | FR-WS-04 | Admin removes a Member; Admin removes the Owner; a Member and Admin leave from workspace settings | Member removed; Owner removal 403; both non-owner roles can confirm leaving and return to the workspace list | I |
| TC-WS-05 | FR-WS-05 | Archive; list workspaces; restore; set archive date 31 days back and run the purge job | Hidden after archive; restore works within 30 days; purge deletes the workspace and its children | I |
| TC-WS-06 | FR-WS-06 | Owner enables AI; Admin tries to change it | Only the Owner can; consent time and user recorded | I |
| TC-WS-07 | FR-WS-01 | List workspaces with members and cards in open lists; inspect the response | Each workspace has accurate member and open-card counts; cards in the final-position list are excluded | I |

### 5.3 Kanban Board

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-TASK-01 | FR-TASK-01 | Create, rename, move and delete a list as Admin and as Member; request a board and create a list after removing its board record | Admin succeeds; Member 403; order persisted; missing board is recreated | I |
| TC-TASK-02 | FR-TASK-02 | Create a card with assignees and labels; edit; delete; assign a non-member | Saved; non-member assignee 400; new assignee notified | I |
| TC-TASK-03 | FR-TASK-03 | Move cards within and between lists; send two moves at once; move to another workspace's list; make the gap tiny | Order consistent, no duplicate positions; cross-workspace 400; list renumbered when needed | I, U |
| TC-TASK-04 | FR-TASK-04 | Two clients on one board; one creates, edits, moves, deletes a card; a non-member client listens | The other client receives each event within 1 s; the non-member receives nothing | S |
| TC-TASK-05 | FR-TASK-05 | Comment with a mention; delete as author, as Admin, as another Member | Comment saved and mention notified; other Member 403 | I |

### 5.4 Chat and Files

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-CHAT-01 | FR-CHAT-01 | Create a channel as Admin and Member; repeat a name | Admin 201; Member 403; duplicate 409 | I |
| TC-CHAT-02 | FR-CHAT-02 | Client A posts; client B is in the channel; client C is outside | B receives message:new; C does not; message stored | S |
| TC-CHAT-03 | FR-CHAT-03 | Post a message with workspace-member and non-member mention IDs | S07 validates workspace membership; notification delivery is deferred to S09 and verified with TC-NOT-01 | I |
| TC-CHAT-04 | FR-CHAT-04 | Upload a file and post it with fileId; use a file from another workspace | Message shows the file; foreign file rejected | I |
| TC-CHAT-05 | FR-CHAT-05 | Disconnect a client for 30 s while others post; reconnect | Missed messages load in order with no duplicates | S, M |
| TC-FILE-01 | FR-FILE-01 | Upload each allowed type; a file of 5 MB plus 1 byte; a disallowed type; exceed the workspace cap | Allowed 201; too large 413; type 415; cap 413 STORAGE\_LIMIT\_REACHED | I |
| TC-FILE-02 | FR-FILE-02 | Download as a member and as a non-member | Member gets the exact bytes and type; non-member 404 | I |
| TC-FILE-03 | FR-FILE-03 | List files after several uploads | Newest first with uploader; no file bytes in the list | I |
| TC-FILE-04 | FR-FILE-03 | Request workspace file summary as a member, non-member and unauthenticated user | Member receives total file count, used bytes and storage limit; non-member 404; no token 401 | I |

### 5.5 Notifications and Reminders

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-NOT-01 | FR-NOT-01 | Keep a client connected; assign a card to it; mention it | notification:new arrives live; GET /notifications lists both | S, I |
| TC-NOT-02 | FR-NOT-02 | Mark one and then all notifications read | readAt set; unreadCount updates | I |
| TC-NOT-03 | FR-NOT-03 | Card due in 23 hours; run the reminder job twice; card due in 3 days | One reminder per assignee, no duplicate; none for the later card | I |

### 5.6 AI Features

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-AI-01 | FR-AI-01 | Open a workspace with AI on and with AI off | Panel usable when on; disabled or hidden when off | E2E, M |
| TC-AI-02 | FR-AI-02 | Ask with a selected card and ask a follow-up; with a card from another workspace | Readable conversation continues from bounded prior turns and selected content; foreign item rejected | I, E2E |
| TC-AI-03 | FR-AI-03 | Summarize a chat range, a card, TXT, PDF and DOCX files; an oversized and an unsupported file | Summary returned; clear error for bad files | I |
| TC-AI-04 | FR-AI-04 | Breakdown, edit the preview, confirm; confirm with an invalid item; mock returns invalid JSON | Preview creates nothing; confirm creates all cards at once and broadcasts; invalid item 400; bad output retried once then 502 | I, E2E |
| TC-AI-05 | FR-AI-05 | Primary provider times out; then both fail | Fallback used and logged; both failing gives 502 AI\_UNAVAILABLE | U |
| TC-AI-06 | FR-AI-06 | Call each AI endpoint with consent off | 403 AI\_DISABLED and no provider call | I |
| TC-AI-07 | FR-AI-07 | Exceed the user and workspace limits | 429 with resetAt; every request logged with metadata only | I |
| TC-AI-08 | FR-AI-08 | Force a provider error during a breakdown | Clear message and retry option; no cards created | I, E2E |
| TC-AI-09 | FR-AI-09 | Put instruction-like text in a card and summarize it (mock and real provider) | Treated as data; no change without user confirmation; output schema-validated | I, M |

### 5.7 Search, Dashboard and Administration

| ID | Req | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-SRCH-01 | FR-SRCH-01 | Search a card title, description, message and file name; search content from another workspace; a 1-character query; dismiss the prompt/results by interacting outside the search; inspect snippets for HTML tags | Matches with plain-text snippets; nothing from other workspaces; short query 400; search panel closes outside; snippets contain no HTML tags | I |
| TC-ANA-01 | FR-ANA-01 | Seed cards across lists, some overdue, some in the last list; GET dashboard; repeat with the board record removed | Counts per list, overdue, completed and open match the seed; a missing board is recreated and returns empty aggregates | I |
| TC-ADM-01 | FR-ADM-01 | System Admin lists, searches, suspends and reactivates; a normal user tries | Works for System Admin; others 403 | I |
| TC-ADM-02 | FR-ADM-02 | View AI usage with filters; read and change the limits with GET and PUT /admin/ai-limits, then use up the new limit | Totals match request logs; invalid values 400; the new limits apply at once and survive a restart | I |

## 6. Non-Functional Test Cases

| ID | Req | Method | Pass criterion | Type |
| --- | --- | --- | --- | --- |
| TC-NFR-01 | NFR-01 | k6 against staging with the large seed workspace, main endpoints | p95 latency under 500 ms | L |
| TC-NFR-02 | NFR-02 | Two scripted clients; timestamp message and card-move events | Delivered within 1 s | S |
| TC-NFR-03 | NFR-03 | Lighthouse with throttled mobile profile on login and board | Load under 3 s | M |
| TC-NFR-04 | NFR-04 | Mock a slow provider | Loading state shown, timeout at 30 s, then fallback or error | I |
| TC-NFR-05 | NFR-05 | Artillery: 50 connected users for 5 minutes using chat and board | No errors on those paths | L |
| TC-NFR-06 | NFR-06 | Review config; send 11 logins in a minute; request from a foreign origin | HTTPS only, headers present, rate limit returns 429, foreign origin blocked | I, M |
| TC-NFR-07 | NFR-07 | Send script tags and SQL-like text in every text field | Stored as text, rendered escaped, no query errors | I, M |
| TC-NFR-08 | NFR-08 | Check that each protected route and socket event has a negative test | Coverage list complete, all pass | I |
| TC-NFR-09 | NFR-09 | Scan repository and client bundle for keys | No secrets found | M |
| TC-NFR-10 | NFR-10 | Drop the network for 30 s during chat | No lost or duplicate messages | S, M |
| TC-NFR-11 | NFR-11 | Demo checklist: keep-warm ping active, backup taken | All items ticked before the demo | M |
| TC-NFR-12 | NFR-12 | Five new users create a workspace and a card unaided; run at 360 px | Each succeeds within 3 minutes; no layout breakage | M |
| TC-NFR-13 | NFR-13 | Read the CI report | Lint and types pass; coverage at least 60% on core modules | CI |
| TC-NFR-14 | NFR-14 | Delete an account; delete AI history; inspect AI logs | Personal data removed; logs hold metadata only | I |
| TC-NFR-15 | NFR-15 | Open the consent dialog | Notice names third-party AI providers | M |

## 6.1 Supplemental UI Recovery Test

| ID | Scope | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-UX-01 | Route error recovery | Trigger a route loader or lazy import failure from both the authentication and authenticated route trees; select each recovery action | Branded error page replaces the framework developer screen; technical details are hidden; retry reloads and dashboard navigation works | I, M |

## 6.2 Supplemental Wireframe-Parity Test

| ID | Scope | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-UX-02 | Workspace navigation and collaboration entry | At desktop and 360 px, open the personal dashboard and a workspace; use create/join actions, workspace shortcuts, workspace navigation and the Files panel | Dashboard shows workspace cards with member/open-task counts and create/join actions; sidebar shortcuts work; workspace mobile navigation shows Board, Chat, Files (with count) and Settings; file storage usage and capacity are visible | M |

## 7. Schedule

| Week | Testing work |
| --- | --- |
| 1 | Set up Vitest, Supertest, test database and seed script in CI; auth and RBAC tests |
| 2 to 5 | Each member adds tests with every feature; AI tests with the mock provider in week 5 |
| 6 | Full regression before feature freeze; Playwright demo path |
| 7 | Load, security, usability and acceptance testing; defect fixing and re-tests |
| 8 | Final regression, test report, demo rehearsal |

## 8. Reporting

Results go into the test report: pass or fail per test case ID, defects found and fixed, load and Lighthouse numbers, and coverage. Update the traceability matrix status for each requirement when its test passes.
