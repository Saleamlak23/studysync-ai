import type { Response } from 'supertest';
export function bearer(response: Response): string { return `Bearer ${response.body.accessToken as string}`; }
