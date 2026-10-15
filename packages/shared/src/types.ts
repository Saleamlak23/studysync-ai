export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
export type Page<T> = { items: T[]; nextCursor: string | null };
