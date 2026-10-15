import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { createUser } from '../../tests/factories.js';
const app = createApp();
const uniqueEmail = () => `auth-${crypto.randomUUID()}@example.test`;
const cookieToken = (response: Response) => String(response.headers['set-cookie']?.[0]).match(/refresh_token=([^;]+)/)?.[1] ?? '';
describe('authentication contracts', () => {
  afterAll(async () => { await prisma.$disconnect(); });
  it('TC-AUTH-01: registers, rejects duplicate email, and rejects a short password', async () => {
    const email = uniqueEmail();
    const valid = await request(app).post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'Password123!' });
    expect(valid.status).toBe(201); expect(valid.body.user.email).toBe(email); expect(valid.body.accessToken).toBeTruthy();
    expect((await request(app).post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'Password123!' })).status).toBe(409);
    expect((await request(app).post('/api/v1/auth/register').send({ name: 'Test User', email: uniqueEmail(), password: '12345' })).status).toBe(400);
  });
  it('TC-AUTH-02: rotates refresh token, detects reuse, revokes its family, and logs out', async () => {
    const email = uniqueEmail();
    const registration = await request(app).post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'Password123!' });
    const firstToken = cookieToken(registration);
    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${firstToken}`);
    expect(rotated.status).toBe(200);
    const secondToken = cookieToken(rotated);
    expect(secondToken).not.toBe(firstToken);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${firstToken}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${secondToken}`)).status).toBe(401);
    const logout = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${registration.body.accessToken}`).set('Cookie', `refresh_token=${secondToken}`);
    expect(logout.status).toBe(204); expect(logout.headers['set-cookie'][0]).toContain('Max-Age=0');
  });
  it('TC-AUTH-03: stores a password hash and never returns the password or hash', async () => {
    const email = uniqueEmail();
    const response = await request(app).post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'Password123!' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe('Password123!'); expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(JSON.stringify(response.body)).not.toContain('Password123!'); expect(response.body.user.passwordHash).toBeUndefined();
  });
  it('TC-AUTH-04: protects the profile endpoint from missing credentials', async () => {
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });
  it('TC-AUTH-05: blocks suspended accounts at login and refresh', async () => {
    const user = await createUser({ email: uniqueEmail(), status: 'SUSPENDED' });
    expect((await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Password123!' })).status).toBe(403);
    const session = await request(app).post('/api/v1/auth/register').send({ name: 'Temp', email: uniqueEmail(), password: 'Password123!' });
    const token = cookieToken(session);
    await prisma.user.update({ where: { email: session.body.user.email }, data: { status: 'SUSPENDED' } });
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${token}`)).status).toBe(401);
  });
});
