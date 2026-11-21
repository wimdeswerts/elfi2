import { label } from './graph.js';
import { answer, answerSink, edgeBetween, newGame, type Game } from './game.js';
import { applyI18n, t } from './i18n.js';
import { load } from './settings.js';

const NS = 'http://www.w3.org/2000/svg';
const COL = 120, H = 440, R = 26, PAD = 40;

const settings = load();
let game: Game = newGame(settings);
let selected: number | null = null; // assigned parent whose arrows are shown
let editing: number | null = null; // child node with an open input
const notes = new Map<number, string>(); // sink variant with scratch notes: unvalidated numbers in intermediate nodes

const reward = document.querySelector<HTMLDialogElement>('#reward')!;
const movie = reward.querySelector('video')!;
reward.addEventListener('close', () => movie.pause());
reward.addEventListener('toggle', () => { if (reward.open) { movie.currentTime = 0; movie.play().catch(() => reward.close()); } }); // no movie file or autoplay blocked: skip the reward
movie.addEventListener('ended', () => reward.close());
movie.addEventListener('error', () => reward.close());
const dots = document.querySelector<HTMLElement>('#dots')!;
const board = document.querySelector<SVGSVGElement>('#board')!;
const dlg = document.querySelector<HTMLDialogElement>('#dlg')!;

const el = (name: string, attrs: Record<string, string | number> = {}, parent?: Element, text?: string) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent?.append(e);
  return e;
};

function pos(id: number) {
  const n = game.graph.nodes[id];
  const size = game.graph.layers[n.layer].length;
  // first and last node of a layer sit PAD from the edge (little empty space above and below the board)
  return { x: COL / 2 + n.layer * COL, y: size === 1 ? H / 2 : PAD + ((H - 2 * PAD) * n.row) / (size - 1) };
}

// New game: focus the first child of the source, so the player can type straight away.
function start() {
  game = newGame(settings);
  notes.clear();
  const first = game.graph.edges.find(e => e.from === game.graph.source);
  selected = sinkMode() ? null : first?.from ?? null;
  editing = sinkMode() ? game.graph.sink : first?.to ?? null;
}

const sinkMode = () => settings.mode === 'sink';

function submit(child: number, text: string) {
  if (sinkMode() && child !== game.graph.sink) { // scratch note: never checked
    const v = text.trim();
    if (v !== '' && !Number.isInteger(Number(v))) return;
    if (v) notes.set(child, v); else notes.delete(child);
    editing = null;
    render();
    return;
  }
  const n = Number(text);
  if (text.trim() === '' || !Number.isInteger(n)) return;
  editing = null;
  if (sinkMode()) { // no per-operation statistics: the answer covers a whole route
    const correct = answerSink(game, n);
    editing = correct ? null : child;
    render();
    if (correct && settings.movie) setTimeout(() => reward.showModal(), 1500);
    return;
  }
  const op = edgeBetween(game, selected!, child)!.op;
  const correct = answer(game, selected!, child, n);
  // fire-and-forget: statistics must never block or break the game
  fetch('/api/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, correct }) }).catch(() => {});
  if (correct) {
    selected = child;
    // focus an open child of the new parent, so continuing from it needs no extra click;
    // if it has none (e.g. the sink), any open node with an answered parent; none left: no focus
    const open = (from: number) => game.graph.edges.find(e => e.from === from && game.values[e.to] === null);
    const next = open(child) ?? game.graph.edges.find(e => game.values[e.from] !== null && game.values[e.to] === null);
    editing = next?.to ?? null;
    if (next) selected = next.from;
  } else editing = child; // wrong: focus stays on this node for another try
  render();
  if (correct && settings.movie && game.values.every(v => v !== null)) setTimeout(() => reward.showModal(), 1500); // let the sink animation be seen first
}

function click(id: number) {
  if (sinkMode()) {
    if (game.values[id] !== null || (id !== game.graph.sink && !(settings.scratch && id !== game.graph.source))) return;
    editing = id;
  } else if (game.values[id] !== null) {
    selected = id;
    editing = null;
  } else {
    const parent = selected !== null && edgeBetween(game, selected, id)
      ? selected
      : game.graph.edges.find(e => e.to === id && game.values[e.from] !== null)?.from;
    if (parent === undefined) return; // not reachable yet
    selected = parent;
    editing = id;
  }
  render();
}

function render() {
  // one dot per node to answer (the source is given); filled left to right as nodes are answered
  const todo = game.graph.nodes.length - 1;
  const done = game.values.filter(v => v !== null).length - 1;
  dots.replaceChildren(...Array.from({ length: todo }, (_, i) => Object.assign(document.createElement('i'), { className: i < done ? 'full' : '' })));
  const g = game.graph;
  board.replaceChildren();
  board.setAttribute('viewBox', `0 0 ${g.layers.length * COL} ${H}`);
  const defs = el('defs', {}, board);
  const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', fill: 'context-stroke' }, marker);

  const labels: [Element, number, number, string][] = [];
  for (const e of g.edges) {
    const a = pos(e.from), b = pos(e.to);
    const active = sinkMode() || e.from === selected;
    // straight: arrows only join adjacent layers, so they never run through another node
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    el('line', {
      x1: a.x + ux * R, y1: a.y + uy * R, x2: b.x - ux * (R + 2), y2: b.y - uy * (R + 2),
      class: active ? 'edge active' : 'edge', 'marker-end': 'url(#arrow)',
    }, board);
    if (active) {
      // Beside the arrow, preferably on the side facing the nearest border (upper side in the middle), as near the head as possible.
      // The label box (44 x 22) must clear every node (and so every arrow head) and the labels already placed;
      // candidates: the preferred side from head to middle, then the other side. If none is free, take the one with the fewest clashes.
      const pref = (ux < 0 ? -1 : 1) * ((a.y + b.y) / 2 > H / 2 ? -1 : 1); // normal (uy, -ux) points up when pref is 1
      // arrow lines count too (other arrows entirely, this one only at its head, which is about 28 long)
      const hits = (x: number, y: number) => g.edges.filter(o => {
        const p = pos(o.from), q = pos(o.to), len = Math.hypot(q.x - p.x, q.y - p.y), vx = (q.x - p.x) / len, vy = (q.y - p.y) / len;
        for (let d = R; d <= len - R - 2; d += 4) {
          const head = d > len - R - 30;
          if (o === e && !head) continue;
          const m = head ? 12 : 4;
          if (Math.abs(p.x + vx * d - x) < 22 + m && Math.abs(p.y + vy * d - y) < 11 + m) return true;
        }
        return false;
      }).length;
      const clashes = (x: number, y: number) => hits(x, y) +
        g.nodes.filter(n => { // box-to-circle distance
          const c = pos(n.id);
          return Math.hypot(Math.max(Math.abs(c.x - x) - 22, 0), Math.max(Math.abs(c.y - y) - 11, 0)) < R + 5;
        }).length + labels.filter(l => Math.abs(l[1] - x) <= 46 && Math.abs(l[2] - y) <= 22).length;
      const spots = [pref, -pref].flatMap(side => [.7, .62, .54, .46, .38, .3].map(f => {
        const nx = uy * side, ny = -ux * side, off = Math.abs(nx) * 19 + Math.abs(ny) * 12;
        return [a.x + (b.x - a.x) * f + nx * off, a.y + (b.y - a.y) * f + ny * off];
      }));
      const [x, y] = spots.reduce((best, s) => (clashes(s[0], s[1]) < clashes(best[0], best[1]) ? s : best));
      labels.push([board, x, y, label(e)]);
    }
  }

  for (const n of g.nodes) {
    const { x, y } = pos(n.id);
    const v = game.values[n.id];
    const reachable = sinkMode() ? n.id === g.sink || (settings.scratch && n.id !== g.source) : g.edges.some(e => e.to === n.id && game.values[e.from] !== null);
    const cls = ['node', v !== null ? 'assigned' : game.wrong.has(n.id) ? 'wrong' : reachable ? 'available' : 'locked'];
    if (n.id === g.sink) cls.push('sink');
    if (n.id === selected) cls.push('selected');
    if (n.id === editing) cls.push('editing');
    const note = v === null && n.id !== editing ? notes.get(n.id) : undefined; // while editing, the input shows the note
    if (note) cls.push('note');
    const grp = el('g', { class: cls.join(' ') }, board);
    grp.addEventListener('click', () => click(n.id));
    el('circle', { cx: x, cy: y, r: R }, grp);
    el('text', { x, y: y + 6, 'text-anchor': 'middle' }, grp, v !== null ? String(v) : note ?? '');
  }
  // arrow labels last so they sit on top
  for (const [parent, x, y, text] of labels) {
    el('text', { x, y: y + 6, class: 'edge-label', 'text-anchor': 'middle' }, parent, text);
  }

  if (editing !== null) {
    const { x, y } = pos(editing);
    const fo = el('foreignObject', { x: x - 34, y: y - 16, width: 68, height: 32 }, board);
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', t(settings.lang, 'answer'));
    input.value = notes.get(editing) ?? '';
    const child = editing;
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') submit(child, input.value);
      if (ev.key === 'Escape') { editing = null; render(); }
    });
    // leaving the node keeps an unchecked note; no render here, it would swallow the click that caused the blur
    input.addEventListener('blur', () => {
      const v = input.value.trim();
      if (editing !== child || !sinkMode() || child === game.graph.sink || (v !== '' && !Number.isInteger(Number(v)))) return;
      if (v) notes.set(child, v); else notes.delete(child);
      editing = null;
    });
    fo.append(input);
    input.focus();
  }
  fitButton();
}

// Keep the new-game button as large as a node on screen (the SVG scales with the window).
function fitButton() {
  const scale = board.getBoundingClientRect().width / (game.graph.layers.length * COL);
  document.documentElement.style.setProperty('--node', `${2 * R * scale}px`);
}
new ResizeObserver(fitButton).observe(board);

document.querySelector('#logout')!.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
  localStorage.removeItem('elfi2-name');
  location.assign('/login');
});
document.querySelector('#opts')!.addEventListener('click', () => dlg.showModal());
document.querySelector('#close')!.addEventListener('click', () => dlg.close());
dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); }); // backdrop click
// Fit the iframe to the options page so neither scrollbar is needed (also when the content changes).
const frame = dlg.querySelector('iframe')!;
let fitting = false;
function fitFrame() {
  const body = frame.contentDocument?.body;
  if (fitting || !body?.classList.contains('embed')) return; // not loaded yet (about:blank) or already observing
  fitting = true;
  new (frame.contentWindow as typeof window).ResizeObserver(() => { // the iframe's own observer: reliable while the dialog is hidden
    const { width, height } = body.getBoundingClientRect();
    if (width) { frame.style.width = `${Math.ceil(width)}px`; frame.style.height = `${Math.ceil(height)}px`; }
    // scrollbars only when max-width/max-height clamp the popup (small screens)
    body.ownerDocument.documentElement.style.overflow = frame.offsetWidth < Math.ceil(width) || frame.offsetHeight < Math.ceil(height) ? 'auto' : 'hidden';
  }).observe(body);
}
frame.addEventListener('load', () => { fitting = false; fitFrame(); }); // a reload makes a new document: the old observer watches a dead body
fitFrame(); // the iframe may have finished loading before this script ran
// The options live in localStorage (written by the iframe): reload them and start a fresh game.
dlg.addEventListener('close', () => {
  Object.assign(settings, load());
  applyI18n(settings.lang);
  start();
  render();
});
document.querySelector('#new')!.addEventListener('click', () => {
  start();
  render();
});

applyI18n(settings.lang);
start();
render();
