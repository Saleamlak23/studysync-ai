# Server progress: Saleamlak Setie

Owner: Saleamlak Setie (server owner and team leader). Only he edits this file. Folders: `apps/api`, `prisma`, `packages/shared`.

How to use: see `README.md` in this folder. Task IDs: `S` server, `A` Client A, `B` Client B. Status is `todo` or `done`. Set a task to `done` in the last commit of its branch, together with the branch name and date in `Done in`.

## Tasks

### S00 · Starter project

- Status: done
- Suggested branch: `chore/project-scaffold`
- Depends on: none
- Requirements: FR-AUTH-01, 02, 03, 04; FR-PROF-01 (server side); skeleton for everything else
- Tests: TC-AUTH-01 to 05, ordering unit tests
- Read first: README.md; AGENTS.md sections 3, 4, 9; the starter-project prompt
- Task: Monorepo, CI, `packages/shared`, Prisma migration and seed, server auth and profile modules, empty module routers, client placeholders only.
- Done in: feature/api-starter-foundation, 2026-10-17

### S01 · Workspaces core

- Status: done
- Suggested branch: `feature/workspaces-server-core`
- Depends on: S00
- Requirements: FR-WS-01, FR-WS-05 (archive and restore), FR-WS-06
- Tests: TC-WS-01, TC-WS-06, TC-WS-05 (archive and restore parts)
- Read first: AGENTS.md 4.1, 7, 8, 9.2, 9.4; docs/API.md section 3; docs/SDD.md 6.1; docs/TEST-PLAN.md 5.2
- Task: Create (also creates its board and #general channel, creator becomes Owner, one transaction), list, get, update, archive, restore, AI consent.
- Done in: feature/workspaces-server-core, 2026-10-20

### S02 · Members and invite links

- Status: done
- Suggested branch: `feature/workspaces-server-members-invites`
- Depends on: S01
- Requirements: FR-WS-02, FR-WS-03, FR-WS-04
- Tests: TC-WS-02, TC-WS-03, TC-WS-04
- Read first: AGENTS.md 7, 9.4; docs/API.md section 3; docs/SDD.md 6.1; docs/TEST-PLAN.md 5.2
- Task: List members, change role, remove member (Owner cannot be removed, a member may leave), create, list and revoke invite links, join by link.
- Done in: feature/workspaces-server-members-invites, 2026-10-20

### S03 · Board lists and cards

- Status: done
- Suggested branch: `feature/board-server-lists-cards`
- Depends on: S01
- Requirements: FR-TASK-01, FR-TASK-02
- Tests: TC-TASK-01, TC-TASK-02
- Read first: AGENTS.md 7, 8, 9.5; docs/API.md section 4; docs/TEST-PLAN.md 5.3
- Task: Board read, list CRUD and list move, card CRUD with assignees and labels. Leave assignment notifications as a TODO until S09.
- Done in: feature/board-server-lists-cards, 2026-10-20

### S04 · Comments and labels

- Status: done
- Suggested branch: `feature/board-server-comments-labels`
- Depends on: S03
- Requirements: FR-TASK-05
- Tests: TC-TASK-05
- Read first: AGENTS.md 7, 9.4; docs/API.md section 4
- Task: Card comments (list, create, delete) and workspace labels (list, create). Mentions create notifications later: leave a TODO.
- Done in: feature/board-server-comments-labels, 2026-10-22

### S05 · Card move and board real-time

- Status: done
- Suggested branch: `feature/board-server-move-realtime`
- Depends on: S03
- Requirements: FR-TASK-03, FR-TASK-04
- Tests: TC-TASK-03, TC-TASK-04
- Read first: AGENTS.md 7.3, 9.5, 9.7; docs/SDD.md 6.2, 6.3; docs/TEST-PLAN.md 5.3
- Task: Fractional ordering with renumbering, socket authentication and rooms, all board:* events after commit. Document the extra `renumbered` field in the event payload.
- Done in: feature/board-server-move-realtime, 2026-10-22

### S06 · Personal dashboard data

- Status: done
- Suggested branch: `feature/profile-server-dashboard`
- Depends on: S03
- Requirements: FR-PROF-02, FR-ANA-02
- Tests: TC-PROF-02
- Read first: AGENTS.md 7, 8; docs/API.md section 2; docs/TEST-PLAN.md 5.1
- Task: GET /me/dashboard: the user's assigned cards and upcoming deadlines across workspaces, soonest first.
- Done in: feature/profile-server-dashboard, 2026-10-22

### S07 · Channels and messages

- Status: done
- Suggested branch: `feature/chat-server-channels-messages`
- Depends on: S05
- Requirements: FR-CHAT-01, 02, 03, 05
- Tests: TC-CHAT-01, 02, 03, 05
- Read first: AGENTS.md 7, 9.7; docs/API.md sections 5 and 11; docs/SDD.md 6.2; docs/TEST-PLAN.md 5.4
- Task: Channels (list, create, delete), messages (before and after cursors, mentionIds), message:new, channel rooms, catch-up without duplicates. Leave mention notifications as a TODO.
- Done in: feature/chat-server-channels-messages, 2026-10-22

### S08 · File storage

- Status: done
- Suggested branch: `feature/files-server-storage`
- Depends on: S07
- Requirements: FR-FILE-01, 02, 03; FR-CHAT-04
- Tests: TC-FILE-01, 02, 03; TC-CHAT-04
- Read first: AGENTS.md 9.8; docs/API.md section 6; docs/SDD.md 6.6; docs/TEST-PLAN.md 5.4
- Task: Upload to PostgreSQL (FileBlob), type allowlist, 5 MB limit, workspace cap, list, streamed download after membership check, attach to a chat message.
- Done in: feature/files-server-storage, 2026-10-22

### S09 · Notifications

- Status: done
- Suggested branch: `feature/notifications-server-core`
- Depends on: S04, S07
- Requirements: FR-NOT-01, FR-NOT-02
- Tests: TC-NOT-01, TC-NOT-02
- Read first: AGENTS.md 7, 9.7; docs/API.md section 7; docs/TEST-PLAN.md 5.5
- Task: List, mark read, mark all read, notification:new to the user room. Replace the TODOs for assignment and mention notifications in the board and chat modules.
- Done in: feature/notifications-server-core, 2026-10-22

### S10 · AI providers and limits

- Status: done
- Suggested branch: `feature/ai-server-providers-limits`
- Depends on: S01
- Requirements: FR-AI-05, 06, 07
- Tests: TC-AI-05, 06, 07
- Read first: AGENTS.md 9.9; docs/SDD.md 6.4; docs/API.md section 8; docs/TEST-PLAN.md 5.6
- Task: AIProvider interface, Groq and Gemini, router (30 s deadline, one retry, fallback), consent check, limits from AppSetting with env defaults, AIRequestLog (metadata only), mock provider for tests.
- Done in: feature/ai-server-providers-limits, 2026-10-22

### S11 · AI features

- Status: done
- Suggested branch: `feature/ai-server-features`
- Depends on: S10, S05, S08
- Requirements: FR-AI-02, 03, 04, 08, 09
- Tests: TC-AI-02, 03, 04, 08, 09
- Read first: AGENTS.md 9.9; docs/SDD.md 6.4 and 13.4; docs/API.md section 8; docs/TEST-PLAN.md 5.6
- Task: Ask, summarize (chat range, card, TXT, PDF, DOCX), breakdown preview and confirm (one transaction, events after commit), prompt-injection protection, clean failures.
- Done in: feature/ai-server-features, 2026-10-22

### S12 · Reminder and purge jobs

- Status: done
- Suggested branch: `feature/jobs-server-reminders-purge`
- Depends on: S09
- Requirements: FR-NOT-03, FR-WS-05 (purge)
- Tests: TC-NOT-03, TC-WS-05 (purge part)
- Read first: AGENTS.md 9.10; docs/SDD.md 6.5; docs/TEST-PLAN.md 5.2 and 5.5
- Task: Reminder job every 15 minutes (no duplicates) and the daily purge of workspaces archived more than 30 days ago.
- Done in: feature/jobs-server-reminders-purge, 2026-10-22

### S13 · Search

- Status: todo
- Suggested branch: `feature/search-server-fulltext`
- Depends on: S07, S08
- Requirements: FR-SRCH-01
- Tests: TC-SRCH-01
- Read first: AGENTS.md 9.11; docs/API.md section 9; docs/TEST-PLAN.md 5.7
- Task: Workspace search over cards, messages and file names with snippets, membership enforced, query of 2+ characters.
- Done in: (branch, date)

### S14 · Workspace dashboard data

- Status: todo
- Suggested branch: `feature/dashboard-server-workspace`
- Depends on: S03
- Requirements: FR-ANA-01
- Tests: TC-ANA-01
- Read first: AGENTS.md 8, 15; docs/API.md section 9; docs/TEST-PLAN.md 5.7
- Task: Cards per list, overdue, completed vs open (completed = card in the last list), contribution per member.
- Done in: (branch, date)

### S15 · System admin

- Status: todo
- Suggested branch: `feature/admin-server-users-ai`
- Depends on: S10
- Requirements: FR-ADM-01, 02; FR-AUTH-07
- Tests: TC-ADM-01, 02; TC-AUTH-05
- Read first: AGENTS.md 7, 8, 9.4; docs/API.md section 10; docs/TEST-PLAN.md 5.1 and 5.7
- Task: List and search users, suspend and reactivate (revokes refresh tokens, disconnects sockets), AI usage report, GET and PUT /admin/ai-limits.
- Done in: (branch, date)

### S16 · Hardening and security tests

- Status: todo
- Suggested branch: `feature/hardening-server-security-tests`
- Depends on: S01 to S15
- Requirements: NFR-06, 07, 08, 09, 10, 13, 14
- Tests: TC-NFR-06, 07, 08, 09, 10, 13, 14
- Read first: AGENTS.md 12, 13; docs/TEST-PLAN.md section 6; docs/SRS.md section 5
- Task: Check that every protected route has negative tests and fix gaps: rate limits on login and AI, headers, CORS, secret scan, 60% coverage on core modules, account deletion and AI history items in scope.
- Done in: (branch, date)
