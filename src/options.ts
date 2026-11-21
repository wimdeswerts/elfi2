import { ALL_OPS } from './graph.js';
import { applyI18n, t, type Key } from './i18n.js';
import { load, save, validChildren, validNodes, validRange, type Lang } from './settings.js';

// inside the popup of the main page the dialog provides the close button
if (self !== top) document.body.classList.add('embed');

const PRESETS = ['0-10', '0-50', '0-100', '0-1000'];
const settings = load();

const langSel = document.querySelector<HTMLSelectElement>('#lang')!;
const rangeSel = document.querySelector<HTMLSelectElement>('#range')!;
const custom = document.querySelector<HTMLElement>('#custom')!;
const minIn = document.querySelector<HTMLInputElement>('#min')!;
const maxIn = document.querySelector<HTMLInputElement>('#max')!;
const childIn = document.querySelector<HTMLInputElement>('#children')!;
const nodesIn = document.querySelector<HTMLInputElement>('#nodes')!;
const movieIn = document.querySelector<HTMLInputElement>('#movie')!;
const scratchIn = document.querySelector<HTMLInputElement>('#scratch')!;
const modeSel = document.querySelector<HTMLInputElement>('#mode')!;
const opBoxes = ALL_OPS.map(op => document.querySelector<HTMLInputElement>(`#op-${ALL_OPS.indexOf(op)}`)!);
const error = document.querySelector<HTMLElement>('#error')!;

// Valid parts are saved; invalid parts keep their previous value and show an error.
function update() {
  const errors: Key[] = [];
  const isCustom = rangeSel.value === 'custom';
  custom.hidden = !isCustom;
  const [min, max] = isCustom ? [minIn.valueAsNumber, maxIn.valueAsNumber] : rangeSel.value.split('-').map(Number);
  if (validRange(min, max)) { settings.min = min; settings.max = max; } else errors.push('rangeError');

  const ops = ALL_OPS.filter((_, i) => opBoxes[i].checked);
  if (ops.length) settings.ops = ops; else errors.push('opsError');

  if (validChildren(childIn.valueAsNumber)) settings.maxChildren = childIn.valueAsNumber; else errors.push('childrenError');

  if (validNodes(nodesIn.valueAsNumber)) settings.maxNodes = nodesIn.valueAsNumber; else errors.push('nodesError');

  settings.movie = movieIn.checked;
  settings.mode = modeSel.checked ? 'sink' : 'steps';
  settings.scratch = scratchIn.checked;
  settings.lang = langSel.value as Lang;
  save(settings);
  applyI18n(settings.lang);
  error.textContent = errors.map(k => t(settings.lang, k)).join(' ');
}

langSel.value = settings.lang;
const key = `${settings.min}-${settings.max}`;
rangeSel.value = PRESETS.includes(key) ? key : 'custom';
minIn.valueAsNumber = settings.min;
maxIn.valueAsNumber = settings.max;
childIn.valueAsNumber = settings.maxChildren;
nodesIn.valueAsNumber = settings.maxNodes;
movieIn.checked = settings.movie;
modeSel.checked = settings.mode === 'sink';
scratchIn.checked = settings.scratch;
opBoxes.forEach((box, i) => (box.checked = settings.ops.includes(ALL_OPS[i])));
[langSel, rangeSel, minIn, maxIn, childIn, nodesIn, movieIn, modeSel, scratchIn, ...opBoxes].forEach(e => e.addEventListener('input', update));

applyI18n(settings.lang);
custom.hidden = rangeSel.value !== 'custom';
