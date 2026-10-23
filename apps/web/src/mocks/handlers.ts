import { loginBody, registerBody } from '@studysync/shared';
import { http, HttpResponse } from 'msw';

type MockUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: null;
  bio: null;
  systemRole: 'USER';
  status: 'ACTIVE';
};

let currentUser: MockUser | null = null;
let currentPassword: string | null = null;

function validationError(issues: unknown) {
  return HttpResponse.json(
    { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: issues } },
    { status: 400 },
  );
}

function unauthenticated() {
  return HttpResponse.json(
    { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
    { status: 401 },
  );
}

export const authHandlers = [
  http.post('/api/v1/auth/register', async ({ request }) => {
    const parsed = registerBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);

    currentUser = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      avatarUrl: null,
      bio: null,
      systemRole: 'USER',
      status: 'ACTIVE',
    };
    currentPassword = parsed.data.password;
    return HttpResponse.json(
      { user: currentUser, accessToken: `mock-${crypto.randomUUID()}` },
      { status: 201 },
    );
  }),
  http.post('/api/v1/auth/login', async ({ request }) => {
    const parsed = loginBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    if (
      !currentUser ||
      parsed.data.email !== currentUser.email ||
      parsed.data.password !== currentPassword
    ) {
      return unauthenticated();
    }

    return HttpResponse.json({ user: currentUser, accessToken: `mock-${crypto.randomUUID()}` });
  }),
  http.post('/api/v1/auth/refresh', () => {
    if (!currentUser) return unauthenticated();
    return HttpResponse.json({ accessToken: `mock-${crypto.randomUUID()}` });
  }),
  http.post('/api/v1/auth/logout', () => {
    currentUser = null;
    currentPassword = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/v1/me', () => (currentUser ? HttpResponse.json({ user: currentUser, workspaces: [] }) : unauthenticated())),
];

export const handlers = [...authHandlers];
