import { label } from './graph.js';
import { answer, edgeBetween, newGame, type Game } from './game.js';
import { applyI18n, t } from './i18n.js';
import { load } from './settings.js';

const NS = 'http://www.w3.org/2000/svg';
const COL = 120, H = 440, R = 26;

const settings = load();
let game: Game = newGame(settings);
let selected: number | null = null; // assigned parent whose arrows are shown
let editing: number | null = null; // child node with an open input

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
  return { x: COL / 2 + n.layer * COL, y: (H * (n.row + 1)) / (size + 1) };
}

// New game: focus the first child of the source, so the player can type straight away.
function start() {
  game = newGame(settings);
  const first = game.graph.edges.find(e => e.from === game.graph.source);
  selected = first?.from ?? null;
  editing = first?.to ?? null;
}

function submit(child: number, text: string) {
  const n = Number(text);
  if (text.trim() === '' || !Number.isInteger(n)) return;
  editing = null;
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
  if (game.values[id] !== null) {
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
  const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', fill: 'context-stroke' }, marker);

  const labels: [Element, number, number, string][] = [];
  for (const e of g.edges) {
    const a = pos(e.from), b = pos(e.to);
    const active = e.from === selected;
    // straight: arrows only join adjacent layers, so they never run through another node
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    el('line', {
      x1: a.x + ux * R, y1: a.y + uy * R, x2: b.x - ux * (R + 2), y2: b.y - uy * (R + 2),
      class: active ? 'edge active' : 'edge', 'marker-end': 'url(#arrow)',
    }, board);
    if (active) {
      // beside the arrow, on its upper side: the label box (about 44 x 22) is pushed out along the normal until it clears the line
      const side = ux < 0 ? -1 : 1; // normal (uy, -ux), flipped to point up
      const nx = uy * side, ny = -ux * side;
      const off = Math.abs(nx) * 24 + Math.abs(ny) * 13;
      labels.push([board, (a.x + b.x) / 2 + nx * off, (a.y + b.y) / 2 + ny * off, label(e)]);
    }
  }

  for (const n of g.nodes) {
    const { x, y } = pos(n.id);
    const v = game.values[n.id];
    const reachable = g.edges.some(e => e.to === n.id && game.values[e.from] !== null);
    const cls = ['node', v !== null ? 'assigned' : game.wrong.has(n.id) ? 'wrong' : reachable ? 'available' : 'locked'];
    if (n.id === g.sink) cls.push('sink');
    if (n.id === selected) cls.push('selected');
    if (n.id === editing) cls.push('editing');
    const grp = el('g', { class: cls.join(' ') }, board);
    grp.addEventListener('click', () => click(n.id));
    el('circle', { cx: x, cy: y, r: R }, grp);
    el('text', { x, y: y + 6, 'text-anchor': 'middle' }, grp, v !== null ? String(v) : '');
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
    const child = editing;
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') submit(child, input.value);
      if (ev.key === 'Escape') { editing = null; render(); }
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
frame.addEventListener('load', fitFrame);
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
