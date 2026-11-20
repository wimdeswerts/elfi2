import { ALL_OPS, label } from './graph.js';
import { applyI18n, t } from './i18n.js';
import { load } from './settings.js';

const { lang } = load();
applyI18n(lang);

const body = document.querySelector<HTMLTableSectionElement>('#rows')!;
try {
  const stats: Record<string, { correct: number; failure: number }> = await (await fetch('/api/stats')).json();
  for (const op of ALL_OPS) {
    const tr = body.insertRow();
    tr.insertCell().textContent = label({ op, n: 0 }).slice(0, 1);
    tr.insertCell().textContent = String(stats[op].correct);
    tr.insertCell().textContent = String(stats[op].failure);
  }
} catch {
  document.querySelector('#error')!.textContent = t(lang, 'statsError');
}
