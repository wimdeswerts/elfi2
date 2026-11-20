import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { SESSION_DAYS, makeSession, readSession, userKey, validName } from './auth.js';
import { login } from './users.js';

try { process.loadEnvFile(); } catch { /* no .env file */ }

const root = path.join(import.meta.dirname, '..');
const OPS = ['+', '-', '*', '/'];
const FILE = path.join(root, 'data', 'stats.json');

// Counts only (no player data). Kept in memory and mirrored to data/stats.json.
const stats: Record<string, { correct: number; failure: number }> = Object.fromEntries(OPS.map(o => [o, { correct: 0, failure: 0 }]));
try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  for (const o of OPS) Object.assign(stats[o], { correct: saved[o].correct | 0, failure: saved[o].failure | 0 });
} catch { /* first run or unreadable file: start from zero */ }

const COOKIE = 'elfi2-session';
const cookieOf = (header: string | undefined) => header?.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);

const app = express();
app.post('/api/login', express.json({ limit: '1kb' }), async (req, res) => {
  const { name, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || typeof password !== 'string' || !validName(name) || password.length > 200) return void res.sendStatus(401);
  try {
    const result = await login(name, password);
    if (result === 'locked') return void res.sendStatus(429);
    if (result === null || !process.env.SESSION_SECRET) return void res.sendStatus(result === null ? 401 : 503);
    res.cookie(COOKIE, makeSession(userKey(name), process.env.SESSION_SECRET), { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: SESSION_DAYS * 86_400_000 });
    res.json({ name: result });
  } catch (error) {
    console.error('login failed:', error instanceof Error ? error.message : error);
    res.sendStatus(503); // no database: nobody gets in
  }
});
app.post('/api/logout', (_req, res) => void res.clearCookie(COOKIE).sendStatus(204));

// Everything else needs a valid session. Without SESSION_SECRET nobody is let in.
const OPEN = new Set(['/login', '/login.html', '/style.css', '/favicon.svg', '/dist/login.js', '/dist/i18n.js', '/dist/settings.js', '/dist/graph.js']);
app.use((req, res, next) => {
  if (OPEN.has(req.path) || readSession(cookieOf(req.headers.cookie), process.env.SESSION_SECRET)) return next();
  if (req.path.startsWith('/api/')) return void res.sendStatus(401);
  res.redirect('/login');
});
app.get('/login', (_req, res) => res.sendFile(path.join(root, 'public', 'login.html')));
app.use('/dist', express.static(path.join(root, 'dist')));
app.use(express.static(path.join(root, 'public')));
app.get('/admin', (_req, res) => res.sendFile(path.join(root, 'public', 'admin.html')));
app.get('/api/stats', (_req, res) => res.json(stats));
app.post('/api/stats', express.json(), (req, res) => {
  const { op, correct } = req.body ?? {};
  if (!OPS.includes(op) || typeof correct !== 'boolean') return void res.sendStatus(400);
  stats[op][correct ? 'correct' : 'failure']++;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(stats));
  res.sendStatus(204);
});
app.listen(Number(process.env.PORT) || 3000, () => console.log('http://localhost:3000'));
