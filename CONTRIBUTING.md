# Contributing to StudySync AI

Rules for the three-person team. They are short on purpose: follow them and the repository stays easy to review, test and demo.

## 1. Workflow

### Branches

| Branch | Purpose | Rules |
|---|---|---|
| `main` | Stable production releases | Protected. Merge from `develop` only when the changes are tested and ready for production (for example, the v1.0 release) |
| `develop` | Integration and staging for the next release | Protected. Feature and fix branches are merged here first; once the release is stable and production-ready, merge `develop` into `main` |
| `feature/<area>-<short-description>` | New work, for example `feature/board-card-move` | Branch from `develop` |
| `fix/<area>-<short-description>` | Bug fixes | Branch from `develop` |
| `docs/<short-description>` | Documentation only | Branch from `develop` |

Never push directly to `main` or `develop`.

### Pull requests

1. Keep them small: one requirement or one fix, ideally under 400 changed lines.
2. Use the title format `type(scope): summary`, for example `feat(board): move card between lists`.
3. In the description, give the requirement ID (for example FR-TASK-03), the test case ID (for example TC-TASK-03), what changed, and how to test it.
4. At least one teammate other than the author must approve. Rotate reviewers.
5. CI must pass: lint, type check, tests and build.
6. Squash and merge, then delete the branch.

### Commit messages

Use Conventional Commits: `type(scope): summary` in the imperative, under 72 characters.

- **Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`
- **Scopes:** `auth`, `workspace`, `board`, `chat`, `files`, `notifications`, `ai`, `search`, `dashboard`, `admin`, `web`, `api`, `db`, `shared`, `ci`

Example: `fix(chat): avoid duplicate messages after reconnect`

## 2. Definition of Done

A requirement is done only when all of these are true:

- [ ] The behavior matches the requirement in the SRS and the API specification
- [ ] Tests exist and pass, including the negative cases (wrong role, non-member, invalid input)
- [ ] CI is green and the change is reviewed
- [ ] Documents are updated if a contract changed: API specification for endpoints or events, ERD and `schema.prisma` for the database, SDD for design decisions
- [ ] The traceability matrix row has the pull request and the test status
- [ ] It runs on staging and has been smoke-tested there

## 3. Code Standards

### General

- TypeScript in strict mode. No `any` without a comment explaining why.
- Prettier and ESLint are the authority on formatting; do not argue about style in reviews.
- Files: React components in `PascalCase.tsx`, everything else in `camelCase.ts`. Variables and functions in `camelCase`, types and components in `PascalCase`, constants in `UPPER_SNAKE_CASE`.
- No dead code, commented-out code or leftover `console.log`.
- Share types, Zod schemas and event names through `packages/shared`; do not duplicate them in the two apps.

### Backend

- Each feature lives in `apps/api/src/modules/<feature>/` with `routes`, `service`, `schema` and `tests`. Routes only parse, validate and call a service; business rules live in the service.
- Every protected route uses the same chain: `authenticate`, then `loadMembership(workspaceId)`, then `requireRole(...)`. Socket handlers use the same permission functions.
- Validate every body, query and path parameter with Zod before using it.
- Return errors through the central error handler using the codes in the API specification. Never leak stack traces or internals.
- Writes go through REST. Sockets only push events, and only after the database commit.
- Never return `passwordHash`, token hashes or file bytes in a normal response. Read `FileBlob` only when streaming a download.
- Use transactions when several rows must change together (for example creating cards from an AI breakdown).

### Database

- Change the schema only through Prisma migrations. Never edit a migration that has been merged; add a new one.
- Name migrations by what they do, for example `add_app_setting`.
- Full-text search columns need the hand-edited SQL described at the top of `schema.prisma`.
- Add an index with any new query that filters or sorts on a new column.

### Frontend

- Server data is fetched with TanStack Query; socket events update the query cache. Keep local state for UI only.
- Style with Tailwind utilities. Every input has a label, every button a clear name, touch targets are at least 44 px, and screens work at 360 px width.
- Follow the wireframes. Raise a change in the team chat before deviating from a screen's structure.

### AI code

- All provider calls go through the `AIProvider` interface and the router (timeout, one retry, fallback).
- User and file content is placed in a delimited block marked as untrusted data. AI output never changes data without an explicit user confirmation.
- Validate AI output against a Zod schema before showing or saving it.
- Log metadata only in `AIRequestLog`. Never log prompts, messages or file contents.

## 4. Testing Rules

- Every pull request that changes behavior includes tests for it.
- Put the test case ID in the test name, for example `it('TC-AUTH-02: rotates refresh token and rejects reuse')`.
- Every protected route has at least one negative test (no token, non-member, insufficient role).
- Use the AI provider mock in automated tests; never call real providers in CI.
- Core modules (auth, roles, board ordering, reminders, AI service) must stay at or above 60% coverage.
- Run `npm test` and `npm run lint` before opening a pull request.

## 5. Security Checklist

Reviewers check these on every pull request:

- No secrets, keys or `.env` files in the diff
- Every new route has authentication, a membership check and a role check
- All input is validated and all output to the browser is escaped
- No sensitive data in logs or error messages
- New file or AI features respect the size limits, storage cap, consent and rate limits

If you find a secret in the repository history, tell the team leader immediately and rotate the key.

## 6. Issues and Planning

- Track work in the GitHub Projects board with the columns Backlog, In progress, In review, Done.
- One issue per requirement or defect. Use the requirement ID in the title.
- Labels: area (`auth`, `board`, `chat`, ...), `bug`, `blocked`, and priority (`must`, `should`, `could`).
- Feature freeze is at the end of week 6. After that, only bug fixes, tests and documentation are merged to `develop`.

## 7. Ownership

Each member owns a vertical slice (backend and frontend), but anyone may review any slice.

| Owner | Slice |
|---|---|
| Team leader (Saleamlak Setie) | Auth, roles, workspaces and invites, AI service and AI panel, deployment and CI, integration and documentation lead |
| Member 2 (Rufta Gaiem) | Kanban board and board real-time, dashboard, search |
| Member 3 (Yared Teweldebirhan) | Chat, files, notifications and reminders, system admin, test plan and test automation |

## 8. Communication

- Weekly standup (15 minutes): what I finished, what I will do, what blocks me.
- Weekly progress meeting with the supervisor. Write minutes in `docs/meetings/` with the date, decisions and action items.
- Decisions that change scope or contracts are written down in the relevant document, not only in chat.
