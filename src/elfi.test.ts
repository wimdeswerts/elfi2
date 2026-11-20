import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answer, newGame, won } from './game.js';
import { ALL_OPS, apply, generate, type Op, type Options, type Range } from './graph.js';

const ranges: Range[] = [{ min: 0, max: 10 }, { min: 0, max: 50 }, { min: 0, max: 100 }, { min: 0, max: 1000 }, { min: 40, max: 44 }];
const subsets = Array.from({ length: 15 }, (_, i) => ALL_OPS.filter((_, b) => (i + 1) & (1 << b)));
const opts = (r: Range, ops: Op[] = ALL_OPS, maxChildren = 2, maxNodes = 30): Options => ({ ...r, ops, maxChildren, maxNodes });

test('generated graphs are valid', () => {
  for (const r of ranges) for (const ops of subsets) for (const k of [2, 3, 5]) for (const total of [10, 11, 25, 30, 61, 100]) {
    const g = generate(opts(r, ops, k, total));
    assert.equal(g.nodes.length, total);
    const sinks = g.nodes.filter(n => !g.edges.some(e => e.from === n.id));
    assert.deepEqual(sinks.map(n => n.id), [g.sink]);
    for (const e of g.edges) assert.ok(ops.includes(e.op), `op ${e.op} not in ${ops}`);
    g.layers.forEach(ids => assert.deepEqual(ids.map(id => g.nodes[id].row), ids.map((_, i) => i))); // rows follow the layer order
    for (const n of g.nodes) {
      assert.ok(g.edges.filter(e => e.from === n.id).length <= k);
      assert.ok(n.value >= r.min && n.value <= r.max);
      if (n.id !== g.source) assert.ok(g.edges.some(e => e.to === n.id));
    }
    for (const e of g.edges) assert.equal(apply(e.op, g.nodes[e.from].value, e.n), g.nodes[e.to].value);
  }
});

test('answers: wrong is retryable, right is stored, sink wins', () => {
  const game = newGame(opts({ min: 0, max: 100 }));
  const g = game.graph;
  const e = g.edges.find(e => e.from === g.source)!;
  const right = g.nodes[e.to].value;
  assert.equal(answer(game, e.from, e.to, right + 1), false);
  assert.equal(game.values[e.to], null);
  assert.ok(game.wrong.has(e.to));
  assert.equal(answer(game, e.from, e.to, right), true);
  assert.equal(game.values[e.to], right);
  assert.ok(!game.wrong.has(e.to));
  // an unreachable node cannot be answered
  assert.equal(answer(game, g.source, g.sink, g.nodes[g.sink].value), false);
  // walk to the sink
  let cur = e.to;
  while (cur !== g.sink) {
    const next = g.edges.find(x => x.from === cur)!;
    assert.ok(answer(game, cur, next.to, g.nodes[next.to].value));
    cur = next.to;
  }
  assert.ok(won(game));
});
