import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();

describe('profile API', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-PROF-01: updates profile, rejects invalid input, and requires authentication', async () => {
    const email = `profile-${crypto.randomUUID()}@example.test`;
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Profile User', email, password: 'Password123!' });

    expect(registration.status).toBe(201);

    const missingAuth = await request(app).get('/api/v1/me');
    expect(missingAuth.status).toBe(401);

    const invalid = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${registration.body.accessToken as string}`)
      .send({ name: '' });
    expect(invalid.status).toBe(400);

    const updated = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${registration.body.accessToken as string}`)
      .send({ name: 'Updated Name', bio: 'A short profile' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'Updated Name', bio: 'A short profile', email });
    expect(updated.body.passwordHash).toBeUndefined();
  });
});
