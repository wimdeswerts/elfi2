// Passwords (salted scrypt hashes) and signed session cookies. Pure Node crypto: no database, no Express.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const hashOf = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, (e, key) => (e ? reject(e) : resolve(key))));

// A hash is "salt:key", both base64. The salt is random per user, so equal passwords give different hashes.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('base64')}:${(await hashOf(password, salt)).toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await hashOf(password, Buffer.from(salt, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Easier for children: names and passwords ignore case. Both are lowercased before they are stored (the password: before hashing) and before they are checked.
export const userKey = (name: string) => name.trim().toLowerCase(); // the stored name, also the database key
export const displayName = userKey; // the same lowercase name is shown as the player
export const normalizePassword = (password: string) => password.toLowerCase();
export const validName = (name: string) => /^[\p{L}\p{N}_.-]{2,30}$/u.test(name.trim());

export const SESSION_DAYS = 30;
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

// "<user key base64url>.<expiry ms>.<signature>"; stateless, so it works on serverless hosting.
export function makeSession(key: string, secret: string, now = Date.now()): string {
  const payload = `${Buffer.from(key).toString('base64url')}.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload, secret)}`;
}

// The user key of a valid, unexpired session, else null.
export function readSession(token: string | undefined, secret: string | undefined, now = Date.now()): string | null {
  if (!token || !secret) return null;
  const [user, expiry, signature, ...rest] = token.split('.');
  if (!user || !expiry || !signature || rest.length) return null;
  const given = Buffer.from(signature);
  const wanted = Buffer.from(sign(`${user}.${expiry}`, secret));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted) || Number(expiry) <= now) return null;
  return Buffer.from(user, 'base64url').toString();
}
