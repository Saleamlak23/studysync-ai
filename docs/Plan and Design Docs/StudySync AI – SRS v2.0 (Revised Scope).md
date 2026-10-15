# Software Requirements Specification (SRS)

## StudySync AI: AI Collaborative Study & Project Workspace

**Version:** 2.0 (revised scope, replaces v1.0)\
**Prepared by:** \[Team Members\]\
**Supervisor:** \[Supervisor Name\]\
**Status:** Draft for approval

## 1. Introduction

### 1.1 Purpose

This SRS defines the requirements for StudySync AI, a web application where student teams manage projects, chat in real time, share files, and use an AI assistant that works on their own workspace content. It is written for the project team, supervisor, testers and evaluators.

### 1.2 Scope and Technical Thesis

StudySync AI lets students create workspaces, plan work on a shared Kanban board, chat, share files, and track progress. Its distinguishing feature is **workspace-aware AI that acts on the board**: the AI reads selected workspace content (chat, cards, files), and can turn a project description into structured, validated tasks that the user confirms and the system creates as real cards.

The technical contributions the team will defend are:

1. Real-time collaborative Kanban with conflict-safe card ordering.
2. A provider-agnostic AI service with fallback, structured (schema-validated) output, consent, rate limiting and prompt-injection mitigation.
3. A role-based access model enforced on every REST endpoint and socket event.

The system is web-only. No custom model training. No native mobile app, video calls or payments.

### 1.3 Priority Legend

- **M (Must):** required for the graduation demo
- **S (Should):** include only after all Must items are done and tested
- **C (Could):** stretch, attempted only after feature freeze preparation is complete

### 1.4 Definitions

| Term | Meaning |
| --- | --- |
| Workspace | Shared space for one study group or project team |
| Board / List / Card | Kanban board, its custom columns, and its tasks |
| RBAC | Role-Based Access Control |
| Provider | External LLM API (Groq primary, Gemini fallback) |
| Context item | A chat range, card or file the user selects for the AI |

## 2. Overall Description

### 2.1 Product Perspective

StudySync AI is a standalone web platform. External dependencies: LLM providers, Cloudinary (file storage), an SMTP email provider (optional features only), and a PostgreSQL host.

### 2.2 User Classes

| Class | Description |
| --- | --- |
| Guest | Unauthenticated visitor; can register and log in |
| Member | Participates in workspaces: tasks, chat, files, AI |
| Workspace Admin | Manages members, boards and workspace settings |
| Workspace Owner | Creator; all Admin rights plus consent to AI use, archive and delete workspace |
| System Admin | Platform-level: suspends users, views AI usage |
| Viewer (S) | Read-only workspace member, for instructors or mentors |

### 2.3 Technology Stack

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite + Tailwind CSS v4, React Router, dnd-kit (drag and drop), Recharts (dashboards) |
| Backend | Node.js + Express (ESM) in a monorepo with a shared types package; Zod for input validation |
| Database | PostgreSQL + Prisma (full-text search via `tsvector`; `pgvector` only for the stretch semantic search) |
| Real-time | Socket.io with rooms per workspace, channel and board |
| Auth | JWT access token plus rotating refresh token in an httpOnly cookie; the same JWT authenticates the socket handshake |
| File storage | Cloudinary (verify free-tier size limits for PDF/DOCX) |
| AI | Groq (Llama 3.3 70B) primary, Gemini 2.5 Flash fallback, behind one `AIProvider` interface |
| Jobs | `node-cron` scanning a `reminders` table |
| Email | Nodemailer with a free SMTP provider (S features only) |
| Testing | Vitest + Supertest (API), Playwright (one end-to-end demo path), k6 or Artillery (load) |
| Deployment | Frontend on Vercel or Netlify; API on Render or Railway; managed PostgreSQL (Neon or similar); GitHub Actions CI |

### 2.4 Constraints

- About 8 weeks, 5 members.
- Free-tier services: AI quotas, file limits and cold starts are expected and designed for.
- AI keys are server-side only; no paid-card dependency.
- Responsive for desktop and mobile browsers.

### 2.5 Assumptions

- Team members know the stack (React, Express, Prisma, Socket.io).
- AI provider free tiers remain available during development and demo.
- Users have intermittent connectivity; the app must recover from dropped connections.

## 3. Functional Requirements

### 3.1 Authentication and Authorization

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-AUTH-01 | Register with name, email, password. | M |
| FR-AUTH-02 | Login and logout using JWT access and refresh tokens; refresh tokens rotate and can be revoked. | M |
| FR-AUTH-03 | Passwords stored only as bcrypt or Argon2 hashes. | M |
| FR-AUTH-04 | RBAC for System Admin, Owner, Admin and Member, checked on every protected REST endpoint and socket event. | M |
| FR-AUTH-05 | Password reset by email. | S |
| FR-AUTH-06 | Email verification. | S |
| FR-AUTH-07 | Suspended users cannot log in and are disconnected from sockets. | M |

### 3.2 Profile

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-PROF-01 | Edit name, bio, avatar. | M |
| FR-PROF-02 | Personal dashboard of workspaces, assigned cards and upcoming deadlines. | M |
| FR-PROF-03 | Delete account; personal data removed and authored messages anonymized. | S |

### 3.3 Workspaces

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-WS-01 | Create a workspace with name and description. | M |
| FR-WS-02 | Owner/Admin generates an invite link (revocable, optional expiry); joining via the link adds the user as Member. | M |
| FR-WS-03 | Owner assigns roles Admin or Member. | M |
| FR-WS-04 | Owner/Admin removes members. | M |
| FR-WS-05 | Owner archives a workspace (soft delete, recoverable for 30 days; a scheduled job purges after that). | M |
| FR-WS-06 | Owner enables or disables AI features and records consent for the workspace. | M |
| FR-WS-07 | Viewer role (read-only). | S |
| FR-WS-08 | Activity log of key workspace events. | S |
| FR-WS-09 | Email invitations. | C |

### 3.4 Kanban Board

The board uses **custom lists** (columns). Cards do not have a separate fixed state machine; a card's status is the list it is in. A card may carry a "blocked" label.

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-TASK-01 | Each workspace has a board; create, rename, reorder and delete lists. | M |
| FR-TASK-02 | Create, edit, move and delete cards with title, description, assignees, due date, priority and labels. | M |
| FR-TASK-03 | Drag and drop cards within and between lists; order is stored so concurrent moves do not corrupt it (e.g. fractional positions). | M |
| FR-TASK-04 | Board changes are broadcast live to all members viewing the board; a user who reconnects receives the current board state. | M |
| FR-TASK-05 | Comments on cards; @mentions create notifications. | M |
| FR-TASK-06 | Filter cards by assignee, label, priority and due date. | S |
| FR-TASK-07 | Subtasks (checklist) on a card. | S |
| FR-TASK-08 | Card activity history. | S |
| FR-TASK-09 | Attach uploaded files to a card. | S |

### 3.5 Real-Time Chat

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-CHAT-01 | Each workspace has text channels; owner/admin create and delete channels. | M |
| FR-CHAT-02 | Messages are persisted and delivered live to members of the channel. | M |
| FR-CHAT-03 | @mentions notify the mentioned member. | M |
| FR-CHAT-04 | Share a file in chat. | M |
| FR-CHAT-05 | On socket reconnect the client fetches missed messages (by last message id) and does not duplicate messages. | M |
| FR-CHAT-06 | Typing indicator and online presence. | S |
| FR-CHAT-07 | Edit and delete own messages. | S |
| FR-CHAT-08 | Direct messages, threads, reactions. | C |

### 3.6 Files

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-FILE-01 | Upload files to the workspace (type and size limits enforced server-side). | M |
| FR-FILE-02 | Download only if the user is a member of the owning workspace. | M |
| FR-FILE-03 | List workspace files with uploader and date. | M |
| FR-FILE-04 | Preview images and PDFs. | S |
| FR-FILE-05 | Folders, file versioning. | C |

### 3.7 Notifications and Reminders

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-NOT-01 | In-app notifications for assignment, mention and approaching deadline, delivered live over sockets. | M |
| FR-NOT-02 | Mark notifications read or unread. | M |
| FR-NOT-03 | A scheduled job creates deadline reminders (e.g. 24 hours before due) from the `reminders` table, without duplicates. | M |
| FR-NOT-04 | Email notifications and per-user notification preferences. | S |

### 3.8 AI Features

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-AI-01 | AI assistant panel inside each workspace. | M |
| FR-AI-02 | The assistant answers using only the context items the user selects (chat range, card with comments, file), truncated to a fixed token budget. | M |
| FR-AI-03 | Summarize a chat range, a card, or an uploaded TXT, PDF or DOCX file; the server extracts the text first and rejects unsupported or oversized files with a clear message. | M |
| FR-AI-04 | **Task breakdown:** from a project description the AI returns structured JSON, validated with a schema; the user previews, edits and confirms; only then are cards created in a chosen list. | M |
| FR-AI-05 | The AI service uses a provider interface with timeout, one retry, and automatic fallback from Groq to Gemini. | M |
| FR-AI-06 | Before any content is sent to a provider, the workspace must have owner consent, and the user sees a notice that content goes to third-party providers and should not include sensitive data. | M |
| FR-AI-07 | Per-user daily and per-workspace limits on AI requests; every request is logged (user, workspace, feature, provider, tokens, status). | M |
| FR-AI-08 | AI failures show a clear message and a retry option; nothing is partially created. | M |
| FR-AI-09 | Prompt-injection mitigation: user and file content is passed as delimited, untrusted data; AI output never changes data without explicit user confirmation. | M |
| FR-AI-10 | Save an AI output as a workspace note or card comment. | S |
| FR-AI-11 | Study plan from topics and deadlines, creating cards after confirmation. | S |
| FR-AI-12 | Generate quizzes and flashcards from notes or files. | S |
| FR-AI-13 | Semantic search across workspace content using embeddings and `pgvector`. | C |

### 3.9 Search

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-SRCH-01 | Keyword search over cards (title, description), messages and file names within a workspace, using PostgreSQL full-text search and respecting membership. | M |
| FR-SRCH-02 | Search filters (type, date, author). | S |

### 3.10 Dashboard

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-ANA-01 | Workspace dashboard: cards per list, overdue cards, completed vs open, and contribution per member. | M |
| FR-ANA-02 | Personal view of assigned cards and upcoming deadlines. | M |
| FR-ANA-03 | Export workspace report as CSV. | S |

### 3.11 Calendar

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-CAL-01 | Calendar view of cards with due dates. | S |
| FR-CAL-02 | Custom events and iCal export. | C |

### 3.12 System Administration

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-ADM-01 | System Admin lists, searches, suspends and reactivates users. | M |
| FR-ADM-02 | System Admin views AI usage per user and workspace and can adjust limits. | M |
| FR-ADM-03 | System Admin lists workspaces and archives abusive ones. | S |
| FR-ADM-04 | Audit log view. | S |

## 4. External Interfaces

- **UI:** responsive web UI (minimum 360 px width) with dashboard, Kanban board, chat, AI side panel, simple calendar (S), admin pages. Readable fonts, keyboard-operable forms, labels on controls.
- **APIs:** REST over HTTPS with JSON; Socket.io for chat, board and notification events. Events: `message:new`, `board:card_moved`, `board:card_updated`, `notification:new`, `presence:update`.
- **External services:** LLM providers, Cloudinary, SMTP provider (S features), PostgreSQL.

## 5. Non-Functional Requirements

Every requirement states how it will be verified.

| ID | Category | Requirement | Verification |
| --- | --- | --- | --- |
| NFR-01 | Performance | API p95 latency under 500 ms for non-AI endpoints with seeded data (workspace of 500 cards, 5,000 messages). | k6 run on staging |
| NFR-02 | Performance | Chat message and card-move events reach other connected clients within 1 s on the deployed system. | Scripted two-client timing test |
| NFR-03 | Performance | Initial page load under 3 s on Lighthouse's throttled mobile profile; route-level code splitting. | Lighthouse report |
| NFR-04 | Performance | AI calls show a loading state, time out at 30 s, then fall back or report failure. | Integration tests with a mocked slow provider |
| NFR-05 | Capacity | 50 concurrent connected users for 5 minutes with no errors in the chat and board paths (reduced from 100 to match free-tier hosting). | Artillery run |
| NFR-06 | Security | HTTPS only; CORS limited to the frontend origin; security headers (Helmet); login and AI endpoints rate limited. | Config review, automated test |
| NFR-07 | Security | All inputs validated with Zod; all queries via Prisma (parameterized); user-generated content escaped or sanitized before rendering. | Unit tests, checklist review |
| NFR-08 | Security | Every protected route and socket event has an RBAC check, and a negative test (wrong role, non-member) exists for each. | Test suite coverage report |
| NFR-09 | Security | Secrets (JWT, AI and storage keys) are only in server environment variables, never in the client bundle or repository. | Repository scan, review |
| NFR-10 | Reliability | Socket.io reconnects automatically; no lost or duplicate messages after a 30 s network drop. | Manual and scripted disconnect test |
| NFR-11 | Reliability | Availability is best-effort on free tiers; a keep-warm ping prevents cold starts during evaluation; a database backup is taken before the final demo. | Demo checklist |
| NFR-12 | Usability | A first-time user creates a workspace and a first card within 3 minutes unaided; works at 360 px width. | Test with 5 users; responsive check |
| NFR-13 | Maintainability | ESLint and Prettier in CI; pull requests reviewed by a teammate; at least 60% test coverage on auth, RBAC, board ordering, reminders and AI service modules. | CI report |
| NFR-14 | Privacy | Account deletion removes personal data; AI history is deletable by the user; AI usage logs store metadata, not message bodies. | Test, schema review |
| NFR-15 | Privacy | The consent notice states that selected content is sent to third-party AI providers whose terms apply. | UI review |

## 6. Data Requirements

### 6.1 Main Entities

User, Workspace, Membership (role), InviteLink, Board, List, Card, CardAssignee, Label, Comment, Channel, Message, File, Notification, Reminder, AIRequestLog, AINote (S), ActivityLog (S), RefreshToken.

### 6.2 Data Retention

- Archived workspaces are soft-deleted and purged by a scheduled job after 30 days.
- User data remains until account deletion; deleted users' messages are anonymized.
- AI request logs keep metadata only; retention is limited (e.g. 90 days).

## 7. System Models

### 7.1 Main Use Cases

1. Register and log in
2. Create workspace and invite members by link
3. Create, assign and move cards
4. Chat and share files
5. Receive mention and deadline notifications
6. Summarize content with AI
7. Generate a task breakdown and create cards from it
8. View progress dashboard
9. Admin suspends user and reviews AI usage

### 7.2 Use Case: AI Task Breakdown

**Actor:** Workspace Member. **Precondition:** logged in, member of a workspace where the owner enabled AI.

1. The user enters a project description and selects a target list.
2. The system checks consent and rate limits.
3. The AI service calls the primary provider; on failure it retries, then uses the fallback.
4. The response is parsed and validated against the task schema (title, description, priority, optional due date).
5. The user sees a preview, edits or removes items, and confirms.
6. The system creates the cards in one transaction and broadcasts them to the board.

**Alternative flows:** invalid AI output leads to one automatic retry, then an error message and nothing created; limit exceeded leads to a message with the reset time.

## 8. Out of Scope

Google OAuth, direct messages, threads and reactions, file versioning, recurring tasks, iCal export, backup and restore UI, meeting transcript summarization, gamification, native apps, video calls, payments, custom model training, and a Guest or Mentor role beyond the optional read-only Viewer.

## 9. MVP and Acceptance Criteria

### 9.1 MVP (Must items only)

Auth with RBAC; workspaces with invite links; real-time Kanban; real-time chat with files; in-app notifications and deadline reminders; keyword search; AI assistant, summaries and task breakdown with consent, limits and fallback; progress dashboard; minimal admin; deployment, tests and documentation.

### 9.2 Acceptance Criteria

1. A user can register, log in, create a workspace and invite another user by link.
2. Roles are enforced: a Member cannot remove members, a non-member cannot read any workspace data.
3. Two users see each other's card moves and chat messages live, and the board stays consistent after concurrent moves and a reconnect.
4. Files upload, download and attach in chat, with permission checks.
5. Mentions and deadlines produce in-app notifications.
6. AI summarizes a chat range, a card and a PDF; with the primary provider disabled the fallback still answers.
7. AI task breakdown creates validated cards only after user confirmation.
8. Without owner consent, no content is sent to any AI provider.
9. The admin can suspend a user and view AI usage.
10. The app is deployed, the NFR verification results are recorded, and the documentation and final report are complete.

## 10. Project Plan, Team and Risks

### 10.1 Eight-Week Plan

| Week | Focus |
| --- | --- |
| 1 | ERD, wireframes, monorepo, CI, **deploy an empty app**, auth |
| 2 | Workspaces, roles, invite links, RBAC tests, AI provider stub endpoint |
| 3 | Kanban board with drag and drop and real-time sync |
| 4 | Chat, files, notifications, reconnect handling |
| 5 | AI features, reminders job, search |
| 6 | Dashboard, admin, integration, **feature freeze at end of week** |
| 7 | Testing, load and security checks, usability test, bug fixes, buffer |
| 8 | Final report, demo rehearsal, backup |

S and C items start only after the corresponding Must item is complete and tested.

### 10.2 Team Split (vertical slices)

| Member | Owns (backend and frontend) |
| --- | --- |
| 1 | Auth, RBAC, workspaces and invites, deployment and CI |
| 2 | Kanban board and board real-time |
| 3 | Chat, files, notifications and reminders |
| 4 | AI service, AI panel, search |
| 5 | Dashboard, admin, test plan and test automation, documentation lead |

Every member also writes tests and documentation for their own slice; Member 5 coordinates them.

### 10.3 Risks

| Risk | Mitigation |
| --- | --- |
| AI quota or provider outage | Provider fallback, per-user limits, cached results, recorded demo data |
| Scope creep | Feature freeze end of week 6; S and C only after M is tested |
| Board ordering bugs under concurrent edits | Fractional positions, server-side ordering, dedicated concurrency tests |
| Free-tier cold starts or limits | Keep-warm ping, early deployment, file size checks |
| Late integration | Deploy in week 1, integrate weekly, shared types package |
| Unreliable AI output | Schema validation, preview and confirm step, mocked-provider tests |
| Team coordination | Weekly standup, GitHub project board, PR reviews |

## Appendix A: Main Changes from v1.0

- Scope cut from about 100 requirements to a focused Must set; 12 modules reduced to the ones the thesis needs.
- Added an explicit technical thesis and a headline AI feature (task breakdown that creates cards).
- Resolved the Kanban lists vs. task states conflict (custom lists only).
- Replaced email invites and OAuth with invite links; made email features optional.
- Replaced semantic search as a dependency with full-text search; semantic search is a stretch.
- Added missing requirements: reconnect handling, board concurrency, reminder scheduler, file text extraction, AI consent, limits and injection mitigation.
- Rewrote non-functional requirements with measurable targets and verification methods suited to free-tier hosting.
- Moved deployment to week 1, AI stub to week 2, added feature freeze and buffer, and changed the team split to vertical slices.
