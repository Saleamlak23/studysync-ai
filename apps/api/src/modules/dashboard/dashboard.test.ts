import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { createApp } from '../../app.js';
import { createUser } from '../../tests/factories.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Creates a fresh workspace owned by a new user and returns login context. */
async function createDashboardWorkspace() {
  const user = await createUser();
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Password123!' });
  expect(login.status).toBe(200);
  const token: string = login.body.accessToken;
  const ws = await request(app)
    .post('/api/v1/workspaces')
    .set(auth(token))
    .send({ name: `Dashboard ${crypto.randomUUID()}` });
  expect(ws.status).toBe(201);
  return { userId: user.id, workspaceId: ws.body.id as string, token };
}

describe('workspace dashboard', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // Positive cases
  // ------------------------------------------------------------------

  it(
    'TC-ANA-01: returns correct counts with seeded cards across lists',
    async () => {
      const owner = await createDashboardWorkspace();

      // Create an "In Progress" list and a "Done" list.
      // The workspace creation already produces a #general channel and one
      // default list; we add two more so the "last list" concept is testable.
      const listA = await request(app)
        .post(`/api/v1/workspaces/${owner.workspaceId}/lists`)
        .set(auth(owner.token))
        .send({ name: 'In Progress' });
      expect(listA.status).toBe(201);
      const listB = await request(app)
        .post(`/api/v1/workspaces/${owner.workspaceId}/lists`)
        .set(auth(owner.token))
        .send({ name: 'Done' });
      expect(listB.status).toBe(201);

      const inProgressId = listA.body.id as string;
      const doneId = listB.body.id as string;

      const pastDate = new Date(Date.now() - 86_400_000).toISOString(); // yesterday

      // Card 1: open + overdue (past due date, not in the last list)
      const c1 = await request(app)
        .post(`/api/v1/lists/${inProgressId}/cards`)
        .set(auth(owner.token))
        .send({ title: 'Overdue card', dueDate: pastDate });
      expect(c1.status).toBe(201);

      // Card 2: open, no due date
      const c2 = await request(app)
        .post(`/api/v1/lists/${inProgressId}/cards`)
        .set(auth(owner.token))
        .send({ title: 'Open card' });
      expect(c2.status).toBe(201);

      // Card 3: completed (in the last list), past due date —
      // must NOT count as overdue because completed cards are excluded.
      const c3 = await request(app)
        .post(`/api/v1/lists/${doneId}/cards`)
        .set(auth(owner.token))
        .send({ title: 'Completed card', dueDate: pastDate });
      expect(c3.status).toBe(201);

      const res = await request(app)
        .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
        .set(auth(owner.token));
      expect(res.status).toBe(200);

      // cardsPerList: each list appears with the right count
      const cpl: Array<{ listId: string; count: number }> = res.body.cardsPerList;
      const inProgressEntry = cpl.find((l) => l.listId === inProgressId);
      const doneEntry = cpl.find((l) => l.listId === doneId);
      expect(inProgressEntry?.count).toBe(2); // c1 + c2
      expect(doneEntry?.count).toBe(1);       // c3

      expect(res.body.overdue).toBe(1);   // only c1 (c3 is completed, not counted)
      expect(res.body.completed).toBe(1); // c3
      expect(res.body.open).toBe(2);      // c1 + c2 (open = not in last list)

      // Owner created all three cards → contribution count ≥ 3
      const contribs: Array<{ userId: string; count: number }> =
        res.body.contributions;
      const ownerContrib = contribs.find((c) => c.userId === owner.userId);
      expect(ownerContrib?.count).toBeGreaterThanOrEqual(3);
    },
  );

  it('TC-ANA-01: empty board (no cards) returns zero counts', async () => {
    const owner = await createDashboardWorkspace();
    const res = await request(app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(0);
    expect(res.body.completed).toBe(0);
    expect(res.body.open).toBe(0);
    expect(res.body.contributions).toEqual([]);
  });

  it('TC-ANA-01: restores a missing board and returns an empty dashboard', async () => {
    const owner = await createDashboardWorkspace();
    await prisma.board.delete({ where: { workspaceId: owner.workspaceId } });

    const res = await request(app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
      .set(auth(owner.token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      cardsPerList: [],
      overdue: 0,
      completed: 0,
      open: 0,
      contributions: [],
    });
    expect(await prisma.board.findUnique({ where: { workspaceId: owner.workspaceId } })).not.toBeNull();
  });

  // ------------------------------------------------------------------
  // Negative cases
  // ------------------------------------------------------------------

  it('TC-ANA-01: unauthenticated request returns 401 UNAUTHENTICATED', async () => {
    const owner = await createDashboardWorkspace();
    const res = await request(app).get(
      `/api/v1/workspaces/${owner.workspaceId}/dashboard`,
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it(
    'TC-ANA-01: non-member receives 404 NOT_FOUND (workspace existence not revealed)',
    async () => {
      const owner = await createDashboardWorkspace();
      const outsider = await createDashboardWorkspace();
      const res = await request(app)
        .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
        .set(auth(outsider.token));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  );

  it(
    'TC-ANA-01: archived workspace returns 404 NOT_FOUND',
    async () => {
      const owner = await createDashboardWorkspace();
      const archive = await request(app)
        .post(`/api/v1/workspaces/${owner.workspaceId}/archive`)
        .set(auth(owner.token));
      expect(archive.status).toBe(200);

      const res = await request(app)
        .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
        .set(auth(owner.token));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  );
});
