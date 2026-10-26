import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().default(4000), CLIENT_ORIGIN: z.string().url(), DATABASE_URL: z.string().min(1), JWT_SECRET: z.string().min(32), REFRESH_SECRET: z.string().min(32), ACCESS_TOKEN_TTL: z.string().default('15m'), REFRESH_TOKEN_TTL: z.string().default('7d'), GROQ_API_KEY: z.string().optional(), GEMINI_API_KEY: z.string().optional(), GROQ_MODEL: z.string().default('openai/gpt-oss-120b'), GEMINI_MODEL: z.string().default('gemini-3.8-flash'), AI_USER_DAILY_LIMIT: z.coerce.number().default(20), AI_WORKSPACE_DAILY_LIMIT: z.coerce.number().default(100), FILE_MAX_BYTES: z.coerce.number().default(5 * 1024 * 1024), WORKSPACE_STORAGE_CAP_BYTES: z.coerce.number().default(100 * 1024 * 1024) });
export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
