import express from 'express';
import path from 'node:path';
import { SESSION_DAYS, makeSession, readSession, userKey, validName } from './auth.js';
import { database, login } from './users.js';

try { process.loadEnvFile(); } catch { /* no .env file */ }

const root = path.join(import.meta.dirname, '..');
const OPS = ['+', '-', '*', '/'];
// Counts only (no player data), kept in MongoDB (collection 'elfi2_stats', one document per operation): Vercel has no writable disk.
const statsCollection = async () => (await database()).collection<{ _id: string; correct: number; failure: number }>('elfi2_stats');

const COOKIE = 'elfi2-session';
const cookieOf = (header: string | undefined) => header?.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);

const app = express();
app.set('trust proxy', 1); // behind Vercel's proxy: req.secure follows X-Forwarded-Proto
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
app.get('/login', (_req, res) => res.sendFile(path.join(root, 'static', 'login.html')));
app.use('/dist', express.static(path.join(root, 'dist')));
app.use(express.static(path.join(root, 'static'), { extensions: ['html'] })); // cleanUrls on Vercel redirects /options.html to /options
app.get('/admin', (_req, res) => res.sendFile(path.join(root, 'static', 'admin.html')));
app.get('/api/stats', async (_req, res) => {
  try {
    const rows = await (await statsCollection()).find().toArray();
    res.json(Object.fromEntries(OPS.map(o => [o, { correct: rows.find(r => r._id === o)?.correct ?? 0, failure: rows.find(r => r._id === o)?.failure ?? 0 }])));
  } catch { res.sendStatus(503); }
});
app.post('/api/stats', express.json(), async (req, res) => {
  const { op, correct } = req.body ?? {};
  if (!OPS.includes(op) || typeof correct !== 'boolean') return void res.sendStatus(400);
  try {
    await (await statsCollection()).updateOne({ _id: op }, { $inc: { [correct ? 'correct' : 'failure']: 1 } }, { upsert: true });
    res.sendStatus(204);
  } catch { res.sendStatus(503); }
});
export default app; // Vercel runs the exported app as a function
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`http://localhost:${port}`));
}
