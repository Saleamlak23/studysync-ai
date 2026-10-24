# Client B progress: Yared Teweldebirhan (Developer B)

Owner: Yared Teweldebirhan. Only he edits this file. Folders: `apps/web/src/shared/lib`, `shared/stores`, `shared/hooks`, the chat, files, notifications, ai, dashboard and admin features, and `e2e/`.

How to use: see `README.md` in this folder. Task IDs: `S` server, `A` Client A, `B` Client B. Status is `todo` or `done`. Set a task to `done` in the last commit of its branch, together with the branch name and date in `Done in`.

## Tasks

### B01 · API client and session

- Status: done
- Suggested branch: `feature/shared-client-api-session`
- Depends on: S00
- Server tasks needed (use MSW mocks until done): S00
- Requirements: FR-AUTH-02 (client side), NFR-09
- Tests: unit tests for refresh and retry logic
- Read first: AGENTS.md 10.1, 10.2, 10.8, 10.9; docs/API.md sections 1 and 2
- Task: `shared/lib/api.ts` (token in memory, single-flight refresh on 401 TOKEN_EXPIRED, one retry, ApiError), session handling and AuthProvider (restore on load), queryClient, errorMessages table, MSW setup with auth handlers.
- Done in: `feature/shared-client-api-session`, 2026-10-23

### B02 · Socket client and AI context store

- Status: done
- Suggested branch: `feature/shared-client-socket-ai-store`
- Depends on: B01
- Server tasks needed (use MSW mocks until done): S05
- Requirements: supports FR-TASK-04, FR-CHAT-05, FR-AI-02
- Tests: unit tests for the store
- Read first: AGENTS.md 7.3, 10.3, 10.7; docs/API.md section 11
- Task: `shared/lib/socket.ts` (fresh token on every connect, reconnect listeners), useWorkspaceSocket, useOnReconnect, `shared/stores/aiContext.ts`.
- Done in: `feature/shared-client-socket-ai-store`, 2026-10-23

### B03 · Personal dashboard

- Status: done
- Suggested branch: `feature/dashboard-client-personal`
- Depends on: B01
- Server tasks needed (use MSW mocks until done): S06, S01
- Requirements: FR-PROF-02, FR-ANA-02
- Tests: component tests for states
- Read first: AGENTS.md 5.1, 10.5; docs/API.md section 2; wireframe 2 (desktop and mobile)
- Task: "/" page: assigned cards, upcoming deadlines, plus A04's WorkspaceList and CreateWorkspaceDialog (import through the workspaces index.ts; placeholders until A04 is done). Exports PersonalDashboard.
- Done in: `feature/dashboard-client-personal`, 2026-10-23

### B04 · Notification bell and list

- Status: done
- Suggested branch: `feature/notifications-client-bell-list`
- Depends on: B01
- Server tasks needed (use MSW mocks until done): S09
- Requirements: FR-NOT-01, 02
- Tests: component tests; manual check TC-NOT-02
- Read first: AGENTS.md 10.5; docs/API.md section 7; wireframe 2
- Task: NotificationBell with unread count and list panel, mark one or all read, loaded over REST (live updates in B07).
- Done in: `feature/notifications-client-bell-list`, 2026-10-23

### B05 · Chat

- Status: done
- Suggested branch: `feature/chat-client-channels-messages`
- Depends on: B02
- Server tasks needed (use MSW mocks until done): S07
- Requirements: FR-CHAT-01, 02, 03, 05
- Tests: unit test for catch-up and dedupe; manual check TC-CHAT-05
- Read first: AGENTS.md 10.3, 10.5, 10.9; docs/API.md sections 5 and 11; wireframe 5 (desktop and mobile)
- Task: Channel list (create and delete for Admin and Owner), message list, composer with mentions, reconnect banner, catch-up with ?after=lastId and dedupe by id, aria-live for new messages.
- Done in: `feature/chat-client-channels-messages`, 2026-10-24

### B06 · Files panel and upload

- Status: done
- Suggested branch: `feature/files-client-panel-upload`
- Depends on: B05
- Server tasks needed (use MSW mocks until done): S08
- Requirements: FR-FILE-01, 02, 03; FR-CHAT-04
- Tests: component tests for error states
- Read first: AGENTS.md 10.9; docs/API.md section 6; wireframe 5
- Task: FilesPanel (list, upload, download), AttachButton for the chat composer, file chips in messages, messages for 413 and 415. The wireframe shows storage usage but the API has no field for it: do not invent one, ask.
- Done in: `feature/chat-client-channels-messages`, 2026-10-24

### B07 · Live notifications

- Status: done
- Suggested branch: `feature/notifications-client-live`
- Depends on: B04, B02
- Server tasks needed (use MSW mocks until done): S09, S12
- Requirements: FR-NOT-01, 03
- Tests: unit test for the cache update
- Read first: AGENTS.md 10.3; docs/API.md section 11
- Task: Subscribe to notification:new, update bell count and list live, show DEADLINE reminders, recover after reconnect.
- Done in: `feature/chat-client-channels-messages`, 2026-10-24

### B08 · AI panel

- Status: done
- Suggested branch: `feature/ai-client-panel`
- Depends on: B02
- Server tasks needed (use MSW mocks until done): S10, S11
- Requirements: FR-AI-01, 02, 03, 06, 07, 08 (UI side)
- Tests: component tests for each error state
- Read first: AGENTS.md 10.7, 10.9, 11.6; docs/API.md section 8; wireframe 3 (desktop and mobile)
- Task: AiPanel (docked at xl, drawer at md, bottom sheet on mobile): selected context with clear button, consent notice, ask and summarize, errors for AI_DISABLED, AI_LIMIT_REACHED (with reset time) and AI_UNAVAILABLE.
- Done in: `feature/chat-client-channels-messages`, 2026-10-24

### B09 · AI breakdown dialog

- Status: todo
- Suggested branch: `feature/ai-client-breakdown-dialog`
- Depends on: B08
- Server tasks needed (use MSW mocks until done): S11
- Requirements: FR-AI-04, 08, 09 (UI side)
- Tests: component tests
- Read first: AGENTS.md 10.9; docs/API.md section 8; docs/SDD.md 13.4; wireframe 4 (desktop and mobile)
- Task: BreakdownDialog: description and target list, generate preview, editable rows, the text "Nothing is created until you confirm.", confirm creates cards through the confirm endpoint, failure leaves nothing changed.
- Done in: (branch, date)

### B10 · Workspace dashboard

- Status: todo
- Suggested branch: `feature/dashboard-client-workspace`
- Depends on: B01
- Server tasks needed (use MSW mocks until done): S14
- Requirements: FR-ANA-01
- Tests: component test with seeded data
- Read first: AGENTS.md 10.5, 11; docs/API.md section 9
- Task: /w/:id dashboard: cards per list, overdue, completed vs open, contribution per member, with Recharts and the tokens.
- Done in: (branch, date)

### B11 · Admin pages

- Status: todo
- Suggested branch: `feature/admin-client-users-ai`
- Depends on: A02
- Server tasks needed (use MSW mocks until done): S15
- Requirements: FR-ADM-01, 02
- Tests: form validation and role guard tests
- Read first: AGENTS.md 10.9; docs/API.md section 10; wireframe 7 (desktop and mobile)
- Task: /admin: user table with search, suspend and reactivate, AI usage table, AI limits form (positive integers).
- Done in: (branch, date)

### B12 · End-to-end demo path

- Status: todo
- Suggested branch: `feature/e2e-client-demo-path`
- Depends on: all A, B and S tasks
- Requirements: SRS acceptance criteria 1 to 7
- Tests: TC-AI-01 (E2E), TC-AI-04 (E2E), TC-AI-08 (E2E)
- Read first: AGENTS.md 12; docs/TEST-PLAN.md sections 1 and 5.6; docs/SRS.md section 9
- Task: Playwright with the mocked AI provider: register, create a workspace, add a card, send a chat message, run an AI breakdown and confirm, check the cards appear.
- Done in: (branch, date)

