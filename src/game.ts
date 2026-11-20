import { apply, generate, type Edge, type Graph, type Options } from './graph.js';

export interface Game { graph: Graph; values: (number | null)[]; wrong: Set<number> }

export function newGame(o: Options): Game {
  const graph = generate(o);
  const values = graph.nodes.map(() => null as number | null);
  values[graph.source] = graph.nodes[graph.source].value;
  return { graph, values, wrong: new Set() };
}

export const edgeBetween = (g: Game, from: number, to: number): Edge | undefined =>
  g.graph.edges.find(e => e.from === from && e.to === to);

// The player answers for `child` using the arrow from `parent`.
export function answer(g: Game, parent: number, child: number, n: number): boolean {
  const e = edgeBetween(g, parent, child);
  const p = g.values[parent];
  if (!e || p === null || g.values[child] !== null) return false;
  if (apply(e.op, p, e.n) !== n) {
    g.wrong.add(child);
    return false;
  }
  g.values[child] = n;
  g.wrong.delete(child);
  return true;
}

export const won = (g: Game): boolean => g.values[g.graph.sink] !== null;
