// Admin tool: `pnpm add-user <name>` creates a user or resets the password. Asks for the password without echo
// (or reads FUNCALC_PASSWORD, for scripts). Needs MONGODB_URI in .env or in the environment.
import { closeUsers, saveUser } from './users.js';
import { validName } from './auth.js';

try { process.loadEnvFile(); } catch { /* no .env file */ }

function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const stdin = process.stdin;
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  let typed = '';
  return new Promise((resolve) => {
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { stdin.setRawMode?.(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(typed); }
        if (c === '\u0003') process.exit(1); // Ctrl+C
        typed = c === '\u007f' || c === '\b' ? typed.slice(0, -1) : typed + c;
      }
    };
    stdin.on('data', onData);
  });
}

const name = process.argv[2] ?? '';
if (!validName(name)) { console.error('Usage: pnpm add-user <name>   (2-30 letters, digits, _ . -)'); process.exit(1); }
let password = process.env.FUNCALC_PASSWORD;
if (password === undefined) {
  password = await ask(`Password for ${name}: `);
  if (password !== await ask('Again: ')) { console.error('The passwords differ.'); process.exit(1); }
}
if (password.length < 6) { console.error('Use at least 6 characters.'); process.exit(1); }
await saveUser(name, password);
await closeUsers();
console.log(`User "${name}" saved.`);
