import type { Lang } from './settings.js';

const dict = {
  nl: {
    options: 'Opties',
    back: 'Terug',
    close: 'Sluiten',
    newGame: 'Nieuw spel',
    language: 'Taal',
    range: 'Getallenbereik',
    custom: 'Zelf kiezen',
    from: 'Van',
    to: 'Tot',
    rangeError: 'Kies hele getallen, van ≥ 0 tot ≤ 1.000.000, met minstens 3 verschil.',
    answer: 'Antwoord',
    operations: 'Toegestane bewerkingen',
    opsError: 'Kies minstens één bewerking.',
    maxChildren: 'Max. aantal afhankelijke knooppunten per knooppunt (2–5)',
    childrenError: 'Kies een geheel getal van 2 tot 5.',
    maxNodes: 'Max. aantal knooppunten (10–100)',
    nodesError: 'Kies een geheel getal van 10 tot 100.',
    stats: 'Statistieken',
    operation: 'Bewerking',
    correct: 'Goed',
    failure: 'Fout',
    statsError: 'Statistieken konden niet geladen worden.',
    movie: 'Filmpje na een voltooid spel',
    logout: 'Stop',
    loginName: 'Naam',
    loginPassword: 'Wachtwoord',
    loginButton: 'Start',
    loginFailed: 'Verkeerde naam of wachtwoord.',
    loginLocked: 'Te vaak geprobeerd. Wacht een paar minuten.',
    loginError: 'Inloggen lukt nu niet.',
  },
  en: {
    options: 'Options',
    back: 'Back',
    close: 'Close',
    newGame: 'New game',
    language: 'Language',
    range: 'Number range',
    custom: 'Custom',
    from: 'From',
    to: 'To',
    rangeError: 'Use whole numbers, from ≥ 0 to ≤ 1,000,000, at least 3 apart.',
    answer: 'Answer',
    operations: 'Allowed operations',
    opsError: 'Choose at least one operation.',
    maxChildren: 'Max. child nodes per parent (2–5)',
    childrenError: 'Choose a whole number from 2 to 5.',
    maxNodes: 'Max. number of nodes (10–100)',
    nodesError: 'Choose a whole number from 10 to 100.',
    stats: 'Statistics',
    operation: 'Operation',
    correct: 'Correct',
    failure: 'Failure',
    statsError: 'Could not load the statistics.',
    movie: 'Play a movie when a game is finished',
    logout: 'Stop',
    loginName: 'Name',
    loginPassword: 'Password',
    loginButton: 'Start',
    loginFailed: 'Wrong name or password.',
    loginLocked: 'Too many tries. Wait a few minutes.',
    loginError: 'Logging in does not work right now.',
  },
};

export type Key = keyof typeof dict.nl;
export const t = (lang: Lang, key: Key): string => dict[lang][key];

// Fills every [data-i18n] element (text) and [data-i18n-label] element (aria-label + tooltip).
export function applyI18n(lang: Lang): void {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => (el.textContent = t(lang, el.dataset.i18n as Key)));
  document.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach(el => {
    el.ariaLabel = el.title = t(lang, el.dataset.i18nLabel as Key);
  });
  document.title = 'Elfi';
}
