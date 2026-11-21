import { ALL_OPS, type Op, type Options } from './graph.js';

export type Lang = 'nl' | 'en';
export type Mode = 'steps' | 'sink'; // steps: answer every node; sink: all arrows shown, answer only the sink
export interface Settings extends Options { lang: Lang; movie: boolean; mode: Mode; scratch: boolean }

const KEY = 'elfi2';
export const MAX_CHILDREN_LIMIT = 5;
export const DEFAULTS: Settings = { lang: 'nl', min: 0, max: 100, ops: [...ALL_OPS], maxChildren: 2, maxNodes: 15, movie: true, mode: 'steps', scratch: false };

// 10 is the smallest graph the layered generator builds sensibly
export const validNodes = (n: number): boolean => Number.isInteger(n) && n >= 10 && n <= 100;

// span >= 3 so the generator always has room to move
export const validRange = (min: number, max: number): boolean =>
  Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max <= 1_000_000 && max - min >= 3;

// at least 2: every node needs room for the layer below it to be reachable
export const validChildren = (n: number): boolean => Number.isInteger(n) && n >= 2 && n <= MAX_CHILDREN_LIMIT;

export function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const range = validRange(s.min, s.max);
    const ops: Op[] = Array.isArray(s.ops) ? ALL_OPS.filter(o => s.ops.includes(o)) : [];
    return {
      lang: s.lang === 'en' ? 'en' : 'nl',
      min: range ? s.min : DEFAULTS.min,
      max: range ? s.max : DEFAULTS.max,
      ops: ops.length ? ops : [...ALL_OPS],
      maxChildren: validChildren(s.maxChildren) ? s.maxChildren : DEFAULTS.maxChildren,
      maxNodes: validNodes(s.maxNodes) ? s.maxNodes : DEFAULTS.maxNodes,
      movie: s.movie !== false,
      mode: s.mode === 'sink' ? 'sink' : 'steps',
      scratch: s.scratch === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const save = (s: Settings): void => localStorage.setItem(KEY, JSON.stringify(s));
