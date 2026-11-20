# Elfi2 - Project Brief

## 1. What are we actually building? (Scope)

A web app that allows children to practice elementary math.

The goal is to find a treasure by traversing a labyrinth. The labyrinth can be modelled as a directed graph: the entrance of the labyrinth is the source node, the treasure is the sink node. There is exactly 1 sink node in the graph. Each node can store a number. The source node gets a random number assigned by the app. Each arrow between nodes specifies the calculation to do, to progress from parent node to child node. If the player enters a correct result in the child node, the number is saved in the child node and the play can continue. The game ends once the sink has been reached.

## 2. What's the smallest simplest version worth shipping (MVP)?

The app renders a directed graph with at least 25 nodes (e.g. each node is a circle). The source node displays a number that was randomly assigned by the app. At the beginning of the game, the source node is the only node that has an assigned number. If the player clicks a node with an assigned number, each arrow from this parent node to a child node shows the calculation that should be performed to assign a number to that child node. Each parent node can have max 2 child nodes. The player can enter a number in a child node of a parent node that has an assigned number. The number is accepted and assigned to the child node if and only if it matches the calculation specified on the corresponding arrow.
Example: the parent node has number 24. The arrow to its child A specifies " : 4", the arrow to its child B specifies "+ 7". If the player clicks child A and enters the number 6, the node A gets 6 assigned because 24 : 4 = 6. If the player clicks child A and enters a number different from 6, the node A gets another color and no number is assigned. A player can only click on nodes / enter numbers that have a parent with an assigned number.
It is up to the player to choose a path in the graph towards the sink node.

### Decisions

- Options page (round gear button, top right of the main page, opens `options.html` as a modal popup in an iframe; closing it reloads the settings and starts a new game) holds the configuration, stored in localStorage.
- Number range: 0-10, 0-50, 0-100, 0-1000 or custom (whole numbers, 0 to 1,000,000, at least 3 apart). Default 0-100.
- Allowed operations: any non-empty selection of +, -, ×, :. Default: all four.
- Max child nodes per parent: 2 to 5. Default 2. (Replaces the fixed maximum of 2 in the MVP text.)
- Max number of nodes: 10 to 100, default 30. The graph has exactly this many nodes. (Replaces the "at least 25 nodes" in the MVP text.)
- No sound: nothing plays when the sink is reached (an optional tune was tried and removed).
- A wrong answer can be retried without limit. A wrong answer is shown only by the node's colour, there is no error text.
- Languages: Dutch (NL, default) and English (EN). Selectable on the Options page only.
- Statistics page at `/admin`: correct and failed answers per operation, counted over all players, stored on the server in `data/stats.json`. No login yet.
- Answer input: the node being answered shows no input rectangle or focus outline; its border turns orange and the typed digits appear inside the node.
- Options page look: same style as the Elfi1 project (cream background, thick dark outlines, Baloo 2 / Nunito fonts loaded from Google Fonts, operations as large toggle tiles that turn teal when selected).
- Main page: no text above the graph; the "new game" button is an icon-only refresh button in the bottom right corner of the graph, as large as a node (responsive); no "treasure found" message; the sink shows a trophy until reached.

### Accepted defaults

- Arrows are straight lines. Nodes are ordered within each layer to minimise crossing arrows.
- A node with several parents is answered via the arrow from the parent that is currently selected (the last assigned node clicked).
- Arrow calculations are generated so every answer is a whole number inside the chosen range. With only × or only : most arrows become trivial (× 1, : 1), because multiplying or dividing stays inside the range for only a few steps.

## 3. What are we building this with (tech stack)?

HTML, CSS and TypeScript 6 (no framework) for the frontend. Node + Express for the hosting

Current layout (compiled with `tsc` to `dist/`, ES modules):

- `src/`: `graph.ts` (graph generator), `game.ts` (rules), `settings.ts` and `i18n.ts` (options and NL/EN texts), `main.ts` / `options.ts` / `admin.ts` (the three pages), `server.ts` (Express), `elfi.test.ts` (tests, `node:test`).
- `public/`: `index.html`, `options.html`, `admin.html`, `style.css`.
- Package manager: pnpm (not npm). Commands: `pnpm install`, `pnpm start` (build and run, then open http://localhost:3000) and `pnpm test` (build and run the tests).

## 4. What's the long-term vision, beyond this MVP?

Not defined yet.

## Login

The whole app (pages, `/dist` except the login modules, and the API) requires a login, copied from Elfi1: `/login` (name + password, "Start", eye button to show the password). Name and password ignore case. Users are created by an admin only (`pnpm add-user <name>`) and live in MongoDB Atlas (db `elfi` or `MONGODB_DB`, collection `users`). Five wrong passwords lock a name for 5 minutes. A successful login sets a signed HttpOnly `elfi2-session` cookie (30 days); the game header has a Log out button. Settings go in the git-ignored `.env`: `MONGODB_URI` (may contain `<USER>`/`<PASSWORD>`, filled from `DATABASE_USER`/`DATABASE_PASSWORD`), `MONGODB_DB`, `SESSION_SECRET`. Without a database or secret nobody gets in.

## Reward movie

When every node of a game is correctly calculated, a modal plays `public/firework.mp4` (about 10 s, fireworks and festive music; supplied by the owner, stored in the repo and deployed with the app). Click or Esc closes it. The options page has a checkbox (default on) to switch it off. The game page has no title heading, and the browser tab title is "Elfi"; the favicon is a smiley on a blue background. If the file is missing or cannot play, the reward is silently skipped.
