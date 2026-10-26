# Client A progress: Rufta Gaiem (Developer A)

Owner: Rufta Gaiem. Only she edits this file. Folders: `apps/web/src/app`, `shared/ui`, `styles`, and the auth, profile, workspaces, board and search features.

How to use: see `README.md` in this folder. Task IDs: `S` server, `A` Client A, `B` Client B. Status is `todo` or `done`. Set a task to `done` in the last commit of its branch, together with the branch name and date in `Done in`.

## Tasks

### A01 · Design-system primitives

- Status: done
- Suggested branch: `feature/ui-client-design-primitives`
- Depends on: S00
- Requirements: NFR-12
- Tests: component tests; accessibility checks
- Read first: AGENTS.md 4.2, 11, 12; all wireframes in docs/wireframes
- Task: Button, Input, Card, Badge, Spinner, Skeleton, EmptyState, Dialog, Sheet, Toast, Avatar in `shared/ui`. Confirm `styles/tokens.css` matches AGENTS.md 11.1.
- Done in: (feature/ui-client-design-primitives, [18/10/2026])

### A02 · App shell and router

- Status: done
- Suggested branch: `feature/app-client-shell-router`
- Depends on: A01
- Requirements: NFR-12
- Tests: component tests for the guards
- Read first: AGENTS.md 5.1, 10.4, 11.7; wireframes 1 to 3 (desktop and mobile)
- Task: AuthLayout, AppShell (sidebar on desktop, bottom navigation below md), WorkspaceLayout, AdminLayout, RequireAuth, RequireSystemAdmin, router composition. Placeholders for NotificationBell, AiPanel and SearchBox until their tasks are done.
- Done in: `feature/app-client-shell-router`, 2026-10-25

### A03 · Login and register

- Status: done
- Suggested branch: `feature/auth-client-login-register`
- Depends on: A02, B01
- Server tasks needed (use MSW mocks until done): S00
- Requirements: FR-AUTH-01, 02
- Tests: form validation component tests (TC-AUTH-01, TC-AUTH-02)
- Read first: AGENTS.md 10.2, 10.9; docs/API.md section 2; wireframe 1
- Task: Pages with Zod validation from `@studysync/shared`, error code messages, redirect after login, logout action, invite-link users returned to /join/:code after login.
- Done in: `feature/auth-client-login-register`, 2026-10-25

### A04 · Workspace list, create and join

- Status: done
- Suggested branch: `feature/workspaces-client-list-create-join`
- Depends on: A03
- Server tasks needed (use MSW mocks until done): S01, S02
- Requirements: FR-WS-01, 02 (join)
- Tests: component tests; 404 and 409 on join
- Read first: AGENTS.md 5.1, 10.5; docs/API.md section 3; wireframe 2
- Task: WorkspaceList and CreateWorkspaceDialog (exported through the feature index.ts for B03), and the /join/:code page.
- Done in: `feature/workspaces-client-list-create-join`, 2026-10-25

### A05 · Workspace settings

- Status: done
- Suggested branch: `feature/workspaces-client-settings`
- Depends on: A04
- Server tasks needed (use MSW mocks until done): S01, S02
- Requirements: FR-WS-03, 04, 05, 06
- Tests: component tests for role-based visibility
- Read first: AGENTS.md 10.9, 10.10; docs/API.md section 3; wireframe 6 (desktop and mobile)
- Task: /w/:id/settings: members and roles, remove member, invite links (create, copy, revoke), AI consent (Owner only), archive (Owner only). Hide or disable actions by role.
- Done in: `feature/workspaces-client-settings`, 2026-10-25

### A06 · Profile edit

- Status: done
- Suggested branch: `feature/profile-client-edit`
- Depends on: A03
- Server tasks needed (use MSW mocks until done): S00
- Requirements: FR-PROF-01
- Tests: form validation test
- Read first: AGENTS.md 10.9; docs/API.md section 2
- Task: Profile dialog to edit name, bio and avatar, reachable from the shell.
- Done in: `feature/profile-client-edit`, 2026-10-26

### A07 · Board view

- Status: done
- Suggested branch: `feature/board-client-view`
- Depends on: A02
- Server tasks needed (use MSW mocks until done): S03
- Requirements: FR-TASK-01
- Tests: component tests for states and role visibility
- Read first: AGENTS.md 10.5, 10.10, 11.6, 11.7; docs/API.md section 4; wireframe 3 (desktop and mobile)
- Task: Lists with cards (layout), list create, rename, delete, reorder for Admin and Owner, loading, empty and error states, mobile list tabs.
- Done in: `feature/board-client-view`, 2026-10-26

### A08 · Board drag and drop, live updates

- Status: done
- Suggested branch: `feature/board-client-dnd-live`
- Depends on: A07, B02
- Server tasks needed (use MSW mocks until done): S05
- Requirements: FR-TASK-03, 04
- Tests: unit tests for moveCardLocally, applyCardMoved, afterCardId calculation
- Read first: AGENTS.md 10.3, 10.6; docs/SDD.md 13.3; docs/API.md section 11
- Task: dnd-kit with pointer, touch and keyboard sensors, optimistic move with rollback, board socket listeners, refetch on reconnect and on renumbered, "Move to list" menu for mobile and keyboard.
- Done in: `feature/board-client-dnd-live`, 2026-10-26

### A09 · Card dialog

- Status: done
- Suggested branch: `feature/board-client-card-dialog`
- Depends on: A07
- Server tasks needed (use MSW mocks until done): S03, S04
- Requirements: FR-TASK-02, 05
- Tests: component tests; 400 and 403 states
- Read first: AGENTS.md 10.7, 10.9, 11.6; docs/API.md section 4; wireframes 3 and 4
- Task: Create, edit and delete cards (full-screen sheet on mobile): title, description, priority, due date, assignees, labels (label palette only), comments with mentions. Selecting a card sets the AI context.
- Done in: `feature/board-client-card-dialog`, 2026-10-26

### A10 · Search box

- Status: done
- Suggested branch: `feature/search-client-box`
- Depends on: A07
- Server tasks needed (use MSW mocks until done): S13
- Requirements: FR-SRCH-01
- Tests: debounce and minimum length test
- Read first: AGENTS.md 10.5; docs/API.md section 9; wireframes 3 and 5
- Task: SearchBox in the workspace top bar with a results panel (cards, messages, files) linking to board or chat, minimum 2 characters, debounce, empty and error states.
- Done in: `feature/search-client-box`, 2026-10-26

### A11 · Responsive and accessibility pass

- Status: todo
- Suggested branch: `feature/responsive-client-polish`
- Depends on: A03 to A10
- Requirements: NFR-03, NFR-12
- Tests: TC-NFR-03 (Lighthouse), TC-NFR-12 (usability notes)
- Read first: AGENTS.md 10.9, 11.7; docs/TEST-PLAN.md section 6; all wireframes
- Task: 360 px pass on every screen of my features, keyboard and screen-reader checks, route-level code splitting, consistent loading, empty and error states.
- Done in: (branch, date)
