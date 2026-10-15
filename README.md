# StudySync AI

An AI collaborative study and project workspace for student teams. Create a workspace, plan work on a shared Kanban board, chat in real time, share files, and use an AI assistant that works on your own workspace content, including turning a project description into real board cards.

Graduation project, College of Technology and Built Environment, Addis Ababa University. Team of three, about 8 weeks.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project documents](#project-documents)
- [Team](#team)

## Features

Must-have scope of SRS v2.0:

- Registration, login, refresh-token rotation, and role-based access (Owner, Admin, Member, System Admin)
- Workspaces with invite links, member roles, archive and restore
- Real-time Kanban board: custom lists, cards, assignees, labels, comments, drag and drop
- Real-time chat with channels, mentions, file sharing, and catch-up after reconnect
- File storage in PostgreSQL (5 MB per file, per-workspace cap)
- In-app notifications and scheduled deadline reminders
- Full-text search across cards, messages and file names
- AI assistant: answer from selected context, summarize chats, cards and files, and break a project into cards (preview, edit, confirm), with consent, limits and provider fallback
- Progress dashboard and a minimal System Admin area (users, AI usage, AI limits)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, dnd-kit, Recharts |
| Backend | Node.js, Express (ESM), Zod |
| Database | PostgreSQL with Prisma 6 |
| Real-time | Socket.io |
| Auth | JWT access token plus rotating refresh token in an httpOnly cookie |
| AI | Groq (Llama 3.3 70B) with Gemini 2.5 Flash as fallback, behind one `AIProvider` interface |
| Jobs | node-cron (deadline reminders, archive purge) |
| Testing | Vitest, Supertest, Playwright, k6 or Artillery |
| CI and hosting | GitHub Actions; Vercel or Netlify (web); Render or Railway (API); managed PostgreSQL |

## Repository structure

```
apps/
  web/                 React single-page app
  api/
    src/
      modules/<feature>/   routes, service, schema, tests (auth, workspaces, board, chat, files, notifications, ai, search, dashboard, admin)
      realtime/            Socket.io setup, rooms, event emitters
      ai/                  AIProvider interface, Groq and Gemini providers, router
      jobs/                node-cron jobs
      middleware/          authenticate, loadMembership, requireRole, error handler
packages/
  shared/              types, Zod schemas, event names used by both apps
prisma/
  schema.prisma        database schema
docs/                  SRS, SDD, ERD, API specification, test plan, traceability matrix
```

## Getting started

### Prerequisites

- Node.js 20 LTS or newer and npm 10 or newer
- PostgreSQL 15 or newer (local install or Docker)
- Free API keys: [Groq](https://console.groq.com) and [Google AI Studio](https://aistudio.google.com) (Gemini)

### Setup

1. Clone and install:

   ```bash
   git clone <repository-url> studysync-ai
   cd studysync-ai
   npm install
   ```

2. Start PostgreSQL. With Docker:

   ```bash
   docker run --name studysync-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=studysync -p 5432:5432 -d postgres:16
   ```

3. Create the environment files from the template and fill in the secrets:

   ```bash
   cp .env.example apps/api/.env
   cp .env.example apps/web/.env   # keep only the VITE_ variables in this one
   ```

4. Create the database tables. The first migration needs one manual edit for full-text search, so create it without applying it:

   ```bash
   npx prisma migrate dev --create-only --name init --schema prisma/schema.prisma
   ```

   Open the generated `migration.sql` and follow the comment at the top of `prisma/schema.prisma` (generated `searchVector` columns and two GIN indexes). Then apply it:

   ```bash
   npx prisma migrate dev --schema prisma/schema.prisma
   ```

5. Load sample data and start both apps:

   ```bash
   npm run db:seed
   npm run dev
   ```

   The web app runs at http://localhost:5173 and the API at http://localhost:4000/api/v1.

## Environment variables

Defined in `.env.example`. Never commit a real `.env` file.

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | API | PostgreSQL connection string |
| `PORT` | API | API port (default 4000) |
| `CLIENT_ORIGIN` | API | Allowed web origin for CORS and cookies |
| `JWT_SECRET`, `REFRESH_SECRET` | API | Secrets for access and refresh tokens (long random strings) |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | API | Token lifetimes (defaults 15m and 7d) |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | API | AI providers |
| `AI_USER_DAILY_LIMIT`, `AI_WORKSPACE_DAILY_LIMIT` | API | Default AI limits; the System Admin can override them in the settings table |
| `FILE_MAX_BYTES`, `WORKSPACE_STORAGE_CAP_BYTES` | API | Upload limits (5 MB per file, 100 MB per workspace by default) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | API | Optional; only for email features |
| `VITE_API_URL` | Web | Base URL of the API |

## Scripts

Agree and create these in the root `package.json` in week 1:

| Command | Purpose |
|---|---|
| `npm run dev` | Run the API and the web app together |
| `npm run build` | Build all packages |
| `npm run lint` and `npm run typecheck` | Static checks (also run in CI) |
| `npm test` | Unit and integration tests |
| `npm run test:e2e` | Playwright end-to-end test of the demo path |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Create sample users, workspaces, cards and messages |
| `npm run db:studio` | Open Prisma Studio |

## Testing

Each requirement has a test case ID (for example `TC-AUTH-02`) listed in the traceability matrix. Include the ID in the test name. AI tests run against a mocked provider; run a few manual checks with the real providers before the demo. Details are in the test plan.

## Deployment

- `develop` deploys to staging; `main` deploys to the production demo.
- Run `npx prisma migrate deploy` as part of each release.
- Set every server variable in the host's environment settings, never in the repository.
- Free hosts sleep when idle: set up a keep-warm ping before the demo and take a database backup first.

## Project documents

Keep exported copies in `docs/` and update them when a contract changes:

- Software Requirements Specification (SRS v2.0)
- Software Design Document (SDD)
- ERD and data dictionary (and `prisma/schema.prisma`)
- API specification
- Requirements traceability matrix
- Test plan and test cases
- UI wireframes (desktop and mobile)

## Team

| Name | Role |
|---|---|
| Saleamlak Setie | Team leader |
| Rufta Gaiem | Developer |
| Yared Teweldebirhan | Developer |

Supervisor: _add name_

## License

Academic project. All rights reserved by the authors unless stated otherwise.
