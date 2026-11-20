export type Op = '+' | '-' | '*' | '/';
export const ALL_OPS: Op[] = ['+', '-', '*', '/'];
export interface Range { min: number; max: number }
export interface Options extends Range { ops: Op[]; maxChildren: number; maxNodes: number }
export interface Edge { from: number; to: number; op: Op; n: number }
// value is the hidden solution; the UI never shows it.
export interface GNode { id: number; layer: number; row: number; value: number }
export interface Graph { nodes: GNode[]; edges: Edge[]; layers: number[][]; source: number; sink: number }
type Step = { op: Op; n: number };

export const apply = (op: Op, a: number, n: number): number =>
  op === '+' ? a + n : op === '-' ? a - n : op === '*' ? a * n : a / n;

export const label = (e: Step): string => `${{ '+': '+', '-': '−', '*': '×', '/': ':' }[e.op]} ${e.n}`;

export const rnd = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));

// All allowed steps that map p to c. Equal values get a trivial step (+0, -0, x1, :1).
function steps(p: number, c: number, ops: Op[]): Step[] {
  const o: Step[] = [];
  if (c > p && ops.includes('+')) o.push({ op: '+', n: c - p });
  if (c < p && ops.includes('-')) o.push({ op: '-', n: p - c });
  if (p > 0 && c % p === 0 && c / p >= 2 && ops.includes('*')) o.push({ op: '*', n: c / p });
  if (c > 0 && p % c === 0 && p / c >= 2 && ops.includes('/')) o.push({ op: '/', n: p / c });
  if (c === p) o.push({ op: ops[0], n: ops[0] === '*' || ops[0] === '/' ? 1 : 0 });
  return o;
}

// Largest "small" +/- operand. One-directional sets (e.g. only +) must spread their steps over the ~10 layers.
const smallStep = (r: Range, ops: Op[]): number =>
  Math.max(1, ops.includes('+') && ops.includes('-') ? Math.round(r.max / 4) : Math.round((r.max - r.min) / 15));

// Prefer small operands (kid-friendly); any step is fine if none is small.
function choose(p: number, c: number, r: Range, ops: Op[]): Step {
  const all = steps(p, c, ops);
  const cap = (s: Step) => (s.op === '+' || s.op === '-' ? smallStep(r, ops) : 12);
  const small = all.filter(s => s.n <= cap(s));
  const pool = small.length ? small : all;
  return pool[rnd(0, pool.length - 1)];
}

function randomTarget(p: number, r: Range, ops: Op[]): number | null {
  for (let i = 0; i < 30; i++) {
    const op = ops[rnd(0, ops.length - 1)];
    const n = op === '+' || op === '-' ? rnd(1, smallStep(r, ops)) : rnd(2, Math.min(r.max, 12));
    const c = apply(op, p, n);
    if (Number.isInteger(c) && c >= r.min && c <= r.max && c !== p) return c;
  }
  return null;
}

// A value reachable from every parent with an allowed step, or null if there is none.
function pickValue(ps: number[], r: Range, ops: Op[]): number | null {
  const ok = (c: number) => ps.every(p => steps(p, c, ops).length > 0);
  for (let i = 0; i < 30; i++) {
    const c = randomTarget(ps[0], r, ops);
    if (c === null) break;
    if (ok(c)) return c;
  }
  const span = r.max - r.min + 1;
  const cands = span <= 2000 ? Array.from({ length: span }, (_, i) => r.min + i) : Array.from({ length: 2000 }, () => rnd(r.min, r.max));
  const good = cands.filter(c => c !== ps[0] && ok(c));
  if (good.length) return good[rnd(0, good.length - 1)];
  return ok(ps[0]) ? ps[0] : null;
}

function structure(k: number, total: number) {
  // 1 source, 2, then layers of 3-4 until the budget is used (the last may be smaller), 1 sink => exactly `total` nodes
  const sizes = [1, 2];
  for (let left = total - 4; left > 0; ) {
    const s = Math.min(rnd(3, 4), left);
    sizes.push(s);
    left -= s;
  }
  sizes.push(1);
  let id = 0;
  const layers = sizes.map(s => Array.from({ length: s }, () => id++));
  const nodes: GNode[] = layers.flatMap((ids, layer) => ids.map((id, row) => ({ id, layer, row, value: 0 })));
  const edges: Edge[] = [];
  const link = (from: number, to: number) => {
    if (!edges.some(e => e.from === from && e.to === to)) edges.push({ from, to, op: '+', n: 0 });
  };

  for (let l = 0; l < layers.length - 1; l++) {
    const A = layers[l], B = layers[l + 1], n = A.length, m = B.length;
    B.forEach((b, j) => link(A[Math.floor(j * n / m)], b)); // every node gets a parent (<= 2 children each)
    A.forEach((a, i) => { // every node gets a child
      if (!edges.some(e => e.from === a)) link(a, B[n > 1 ? Math.round(i * (m - 1) / (n - 1)) : 0]);
    });
    A.forEach(a => { // extra children, up to a random target <= k, preferring targets next to the first child (fewer crossings)
      const target = Math.min(rnd(1, k), m);
      const first = B.indexOf(edges.find(e => e.from === a)!.to);
      const dist = (b: number) => Math.abs(B.indexOf(b) - first) + Math.random() * 0.5;
      while (edges.filter(e => e.from === a).length < target) {
        const free = B.filter(b => !edges.some(e => e.from === a && e.to === b));
        link(a, free.reduce((x, y) => (dist(y) < dist(x) ? y : x)));
      }
    });
  }
  return { nodes, edges, layers };
}

type Structure = ReturnType<typeof structure>;

// Reorders the nodes inside each layer (node.row) to minimise crossing arrows:
// barycenter sweeps from several random starting orders, keeping the best result.
function minimizeCrossings({ nodes, edges, layers }: Structure): void {
  const ins = nodes.map(n => edges.filter(e => e.to === n.id).map(e => e.from));
  const outs = nodes.map(n => edges.filter(e => e.from === n.id).map(e => e.to));
  const between = layers.map((_, l) => edges.filter(e => nodes[e.from].layer === l));
  const row: number[] = [];
  const place = (order: number[][]) => order.forEach(ids => ids.forEach((id, i) => (row[id] = i)));
  const crossings = () => between.reduce((sum, es) => {
    let c = 0;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      if ((row[es[i].from] - row[es[j].from]) * (row[es[i].to] - row[es[j].to]) < 0) c++;
    }
    return sum + c;
  }, 0);
  const sweep = (order: number[][], down: boolean) => {
    const nb = down ? ins : outs;
    const idx = [...order.keys()];
    const ls = down ? idx.slice(1) : idx.slice(0, -1).reverse();
    for (const l of ls) {
      const key = new Map(order[l].map(id => [id, nb[id].reduce((s, n) => s + row[n], 0) / nb[id].length]));
      order[l].sort((a, b) => key.get(a)! - key.get(b)!);
      place(order);
    }
  };

  let best = layers.map(ids => [...ids]);
  place(best);
  let bestCount = crossings();
  for (let r = 0; r < 20 && bestCount > 0; r++) {
    const order = layers.map(ids => (r === 0 ? [...ids] : [...ids].sort(() => Math.random() - 0.5)));
    place(order);
    for (let i = 0; i < 8; i++) {
      sweep(order, true);
      sweep(order, false);
      const c = crossings();
      if (c < bestCount) { bestCount = c; best = order.map(ids => [...ids]); }
    }
  }
  best.forEach((ids, l) => { layers[l] = ids; ids.forEach((id, i) => (nodes[id].row = i)); });
}

function fill({ nodes, edges }: Structure, r: Range, ops: Op[]): boolean {
  // one-directional sets start at the end that leaves room to move
  const up = ops.some(o => o === '+' || o === '*'), down = ops.some(o => o === '-' || o === '/');
  const edge = Math.round((r.max - r.min) / 5);
  const lo = ops.includes('+') ? r.min : Math.max(r.min, 1);
  nodes[0].value = up && !down ? rnd(lo, lo + edge) : down && !up ? rnd(r.max - edge, r.max) : rnd(r.min, r.max);
  for (const node of nodes.slice(1)) {
    const incoming = edges.filter(e => e.to === node.id);
    const c = pickValue(incoming.map(e => nodes[e.from].value), r, ops);
    if (c === null) return false;
    node.value = c;
    for (const e of incoming) Object.assign(e, choose(nodes[e.from].value, c, r, ops));
  }
  return true;
}

export function generate(o: Options): Graph {
  let s = structure(o.maxChildren, o.maxNodes);
  let ok = fill(s, o, o.ops);
  for (let i = 0; i < 49 && !ok; i++) {
    s = structure(o.maxChildren, o.maxNodes);
    ok = fill(s, o, o.ops);
  }
  if (!ok) { // shortcut: some operation sets (e.g. only x on a small range) can't form a varied graph; use trivial arrows (x1, :1, +0, -0), upgrade if that matters
    const v = rnd(o.min, o.max);
    s.nodes.forEach(n => (n.value = v));
    s.edges.forEach(e => Object.assign(e, steps(v, v, o.ops)[0]));
  }
  minimizeCrossings(s);
  return { ...s, source: 0, sink: s.nodes.length - 1 };
}
