# Elfi2

Web app for children to practice elementary math by walking through a labyrinth (a layered directed graph). Requirements and decisions are in `project-brief.md`; keep that file up to date when you change behaviour.

## Commands

pnpm only (not npm).

- `pnpm start`: compile with `tsc` and run the server at http://localhost:3000 (`/` game, `/options.html`, `/admin` statistics)
- `pnpm test`: compile and run `node --test` on `dist/**/*.test.js`

## Layout

- `src/` is TypeScript 6, no framework, compiled by `tsc` to `dist/` (ES modules, imports need the `.js` extension). Do not edit `dist/`.
- `src/graph.ts` generates the graph. Node values are chosen first and each arrow's calculation is derived from them, so every answer is a whole number in the range. Nodes in a layer are reordered to minimise crossings.
- `src/game.ts` holds the rules and has no DOM access. `graph.ts` and `game.ts` must stay DOM-free so the tests can import them.
- `src/settings.ts` stores the options in `localStorage`. Validation lives there (`validRange`, `validChildren`, `validNodes`). `src/i18n.ts` holds all NL/EN texts: add a key to both languages.
- `src/server.ts` serves `public/` and `dist/` and keeps per-operation statistics in `data/stats.json` (generated, not committed).
- `public/` holds the three HTML pages and `style.css`. The options page has `<body class="opts">`; its look (outlined cards, Baloo 2 / Nunito fonts, operation tiles) is scoped to `.opts` / `.options` in `style.css` so the other pages are unaffected. The four operation checkboxes need `class="op"` (they are styled as tiles).

## Conventions

- Dutch is the default language. User-visible text goes through `i18n.ts` (`data-i18n` / `data-i18n-label` in the HTML).
- Dutch wording: "knooppunt" (not "knoop"), "afhankelijke knooppunten".
- A wrong answer is shown only by the node colour, with no error text. Options validation errors are fine.
- The node being answered has an invisible input (no rectangle or outline); the node gets the `editing` class and an orange border instead.
- The server compiles only at start: after editing `src/`, run `pnpm exec tsc` (or restart) before testing in the browser.
- Before using a library API, check it with Context7 (a hook enforces this before code edits).

## Login

- `src/auth.ts` (scrypt hashing, HMAC session cookie), `src/users.ts` (MongoDB users, lockout), `src/add-user.ts` (`pnpm add-user <name>`) are copies of Elfi1's. `src/server.ts` has `/api/login`, `/api/logout` and a session guard; the open paths are the `OPEN` set (login page plus the four `dist` modules it imports: add one there if `login.ts` gets a new import). `public/login.html` is `<body class="opts">`; its CSS (`#login`, `.pw`) is at the end of `style.css`. `PORT` env overrides 3000.

- Reward movie: `#reward` dialog in `index.html` plays `public/firework.mp4`; `main.ts` `submit()` opens it when all `game.values` are set.
