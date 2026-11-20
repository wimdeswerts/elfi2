// The users live in MongoDB Atlas (database 'elfi', or MONGODB_DB). Only a salted hash of the password is stored.
// MONGODB_URI may contain the placeholders <USER> and <PASSWORD>, filled from DATABASE_USER and DATABASE_PASSWORD.
import { MongoClient } from 'mongodb';
import { displayName, hashPassword, normalizePassword, userKey, verifyPassword } from './auth.js';

interface User { _id: string; name: string; hash: string; failed: number; lockedUntil: number }

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60_000;

export function mongoUri(env = process.env): string {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  const fill = (name: 'DATABASE_USER' | 'DATABASE_PASSWORD') => {
    if (!env[name]) throw new Error(`${name} is not set`);
    return encodeURIComponent(env[name]); // special characters in a password must be escaped in a URI
  };
  return env.MONGODB_URI.replace('<USER>', () => fill('DATABASE_USER')).replace('<PASSWORD>', () => fill('DATABASE_PASSWORD'));
}

let connection: Promise<MongoClient> | undefined; // reused between requests of a warm serverless instance
export const database = async () => {
  connection ??= new MongoClient(mongoUri()).connect();
  return (await connection).db(process.env.MONGODB_DB || 'elfi');
};
const users = async () => (await database()).collection<User>('users');

const dummy = hashPassword('no such user'); // checked for unknown names, so they take as long as a wrong password

// The user's display name, 'locked' after too many wrong passwords, or null (same answer for unknown name and wrong password).
export async function login(name: string, typed: string): Promise<string | 'locked' | null> {
  const password = normalizePassword(typed);
  const collection = await users();
  const user = await collection.findOne({ _id: userKey(name) });
  if (!user) { await verifyPassword(password, await dummy); return null; }
  if (user.lockedUntil > Date.now()) return 'locked';
  if (await verifyPassword(password, user.hash)) {
    if (user.failed) await collection.updateOne({ _id: user._id }, { $set: { failed: 0 } });
    return user.name;
  }
  const failed = user.failed + 1;
  await collection.updateOne({ _id: user._id }, { $set: failed >= MAX_FAILS ? { failed: 0, lockedUntil: Date.now() + LOCK_MS } : { failed } });
  return null;
}

// Creates the user, or sets a new password for an existing one (which also lifts a lock).
export async function saveUser(name: string, password: string): Promise<void> {
  const hash = await hashPassword(normalizePassword(password));
  await (await users()).updateOne({ _id: userKey(name) }, { $set: { name: displayName(name), hash, failed: 0, lockedUntil: 0 } }, { upsert: true });
}

export const closeUsers = async () => { if (connection) await (await connection).close(); };
