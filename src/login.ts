import { applyI18n, t, type Key } from './i18n.js';
import { load } from './settings.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const lang = load().lang;
applyI18n(lang);
document.title = 'Elfi';

$('login').onsubmit = async (e) => {
  e.preventDefault();
  const button = $<HTMLButtonElement>('loginButton');
  button.disabled = true;
  const show = (key: Key | '') => ($('loginMsg').textContent = key && t(lang, key));
  show('');
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $<HTMLInputElement>('name').value, password: $<HTMLInputElement>('password').value }),
    });
    if (response.ok) {
      localStorage.setItem('elfi2-name', ((await response.json()) as { name: string }).name);
      location.assign('/');
      return;
    }
    show(response.status === 401 ? 'loginFailed' : response.status === 429 ? 'loginLocked' : 'loginError');
  } catch {
    show('loginError');
  }
  button.disabled = false;
};

// Eye = the password is readable; eye with a backslash = hidden.
const EYE = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>';
const draw = (hidden: boolean) => {
  $('showPw').innerHTML = `<svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EYE}${hidden ? '<path d="M3 3l18 18"/>' : ''}</svg>`;
};
draw(true);
$('showPw').onclick = () => {
  const field = $<HTMLInputElement>('password');
  field.type = field.type === 'password' ? 'text' : 'password';
  draw(field.type === 'password');
};
