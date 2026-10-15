import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export const signAccessToken = (userId: string) => jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] });
export const newRefreshToken = () => randomBytes(48).toString('base64url');
export const hashRefreshToken = (token: string) => createHmac('sha256', env.REFRESH_SECRET).update(token).digest('hex');
export const newTokenFamilyId = () => randomUUID();
