# StudySync AI: Entity Relationship Diagram (ERD) and Data Dictionary

Oct 14, 2026 · @Saleamlak

The PostgreSQL database has 20 entities in four groups, all defined in Prisma and following SDD section 5. This document gives the diagram, the field-level dictionary, the relationship rules and the open points.

## 1. ER Diagram

&#91;embedded content: ERD · 20 entities, 4 groups\]

User and Workspace are the two hubs: identity and membership on the top row, the board chain (Board, List, Card) down the middle, and chat, files, notifications and AI logs around them.

## 2. Conventions

- Every primary key is a UUID named `id`; foreign keys are named `<entity>Id`; tables carry `createdAt`, and `updatedAt` where rows change.
- A trailing `?` means optional (nullable). Join tables use a composite primary key.
- Enums: WorkspaceRole (OWNER, ADMIN, MEMBER), SystemRole (USER, ADMIN), UserStatus (ACTIVE, SUSPENDED), Priority (LOW, MEDIUM, HIGH), NotificationType (ASSIGNED, MENTION, DEADLINE), ReminderType (DUE\_24H), AIFeature (ASK, SUMMARIZE, BREAKDOWN), AIStatus (SUCCESS, ERROR).
- Children of a workspace are deleted with it (CASCADE). Authored content keeps its row when the author is deleted (author set to null, shown as a deleted user).

## 3. Data Dictionary

### 3.1 Identity and Access

| Entity | Fields | Keys and constraints |
| --- | --- | --- |
| User | id, name, email, passwordHash, avatarUrl?, bio?, systemRole, status, createdAt, updatedAt | email unique; passwordHash never returned by the API |
| RefreshToken | id, userId, tokenHash, familyId, expiresAt, revokedAt?, createdAt | tokenHash unique; index on userId and familyId; deleted with the user |
| Workspace | id, name, description?, aiEnabled (default false), aiConsentById?, aiConsentAt?, archivedAt?, createdAt, updatedAt | archivedAt starts the 30-day purge window |
| Membership | id, userId, workspaceId, role, joinedAt | unique (userId, workspaceId); index on workspaceId |
| InviteLink | id, workspaceId, code, createdById?, expiresAt?, revokedAt?, createdAt | code unique and random |

### 3.2 Board

| Entity | Fields | Keys and constraints |
| --- | --- | --- |
| Board | id, workspaceId, name | unique workspaceId (one board per workspace) |
| List | id, boardId, name, position | index (boardId, position) |
| Card | id, listId, title, description?, priority, dueDate?, position, createdById?, searchVector, createdAt, updatedAt | index (listId, position); GIN index on searchVector |
| CardAssignee | cardId, userId | composite primary key (cardId, userId) |
| Label | id, workspaceId, name, color | unique (workspaceId, name) |
| CardLabel | cardId, labelId | composite primary key (cardId, labelId) |
| Comment | id, cardId, authorId?, body, createdAt | index (cardId, createdAt) |

### 3.3 Communication and Files

| Entity | Fields | Keys and constraints |
| --- | --- | --- |
| Channel | id, workspaceId, name, createdAt | unique (workspaceId, name) |
| Message | id, channelId, authorId?, content, fileId?, searchVector, createdAt, deletedAt? | index (channelId, createdAt, id) for catch-up; GIN index on searchVector |
| File | id, workspaceId, uploaderId?, name, mimeType, sizeBytes, createdAt | index on workspaceId; the bytes live in FileBlob and are read only when streaming a download |
| FileBlob | fileId, data (bytes) | fileId is both primary key and foreign key (one row per File); kept apart so normal File queries never load the bytes |

### 3.4 Notifications and AI

| Entity | Fields | Keys and constraints |
| --- | --- | --- |
| Notification | id, userId, type, workspaceId, payload (JSON with card, channel or message ids), readAt?, createdAt | index (userId, readAt) |
| Reminder | id, cardId, userId, type, dueAt, createdAt | unique (cardId, userId, type, dueAt) prevents duplicates |
| AIRequestLog | id, userId?, workspaceId, feature, provider, tokensIn, tokensOut, status, latencyMs, createdAt | metadata only, never message bodies; index (userId, createdAt) and (workspaceId, createdAt) |
| AppSetting | key, value (JSON), updatedById?, updatedAt | key is the primary key; one row per setting, such as ai.userDailyLimit and ai.workspaceDailyLimit; configuration defaults apply when a key has no row |

## 4. Relationships

| Relationship | Cardinality | On delete |
| --- | --- | --- |
| User to Membership to Workspace | User 1..N Membership; Workspace 1..N Membership | Cascade |
| Workspace to Board, Board to List, List to Card | 1..1, 1..N, 1..N | Cascade |
| Card to User through CardAssignee | N..N | Cascade |
| Card to Label through CardLabel; Workspace to Label | N..N; 1..N | Cascade |
| Card to Comment; User to Comment (author) | 1..N; 1..N | Cascade; set null |
| Workspace to Channel, Channel to Message | 1..N, 1..N | Cascade |
| User to Message (author), Message to File | 1..N; 0..1 | Set null; set null |
| Workspace to File, InviteLink | 1..N | Cascade |
| User to Notification, RefreshToken | 1..N | Cascade |
| Card to Reminder; User to Reminder | 1..N; 1..N | Cascade |
| Workspace and User to AIRequestLog | 1..N each | Cascade on workspace; set null on user |
| File to FileBlob | 1..1 | Cascade |
| User to AppSetting (last editor) | 1..N | Set null |

## 5. Notes and Open Points

- **Reminder key.** SDD 5.2 lists unique (cardId, type, dueAt); userId is added here because every assignee gets their own reminder.
- **Full-text search.** Prisma has no native tsvector field: declare searchVector as `Unsupported("tsvector")` and create the generated column and GIN indexes in a raw SQL migration.
- **Viewer role.** If the Should-level Viewer role is built, add VIEWER to WorkspaceRole; no table changes are needed.
- **Next step.** Convert this dictionary into `schema.prisma` and use it as the first migration.

* **File storage.** Files are stored in PostgreSQL instead of Cloudinary. Limits are 5 MB per file and, by default, 100 MB per workspace; the bytes are read only to stream a download.

- **Settings.** AppSetting is a key-value table for platform settings the System Admin can change; it currently holds the two AI limits.
