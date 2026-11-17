import en from './en.js';

// UI language. Fixed per page load: switching saves the choice and reloads the page,
// so module-level constants that call t() stay consistent.
export const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

const STORAGE_KEY = 'admin-lang';
const DEFAULT_LANG = 'ko';

function readLang() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.value === saved) ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

const lang = readLang();

if (typeof document !== 'undefined') {
  document.documentElement.lang = lang;
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable: the choice just won't persist
  }
}

// t('Korean text {0}', value): the Korean text is the key. {0}, {1}... are filled by position.
export function t(key, ...args) {
  const text = lang === 'en' ? (en[key] ?? key) : key;
  if (args.length === 0) return text;
  return text.replace(/\{(\d+)\}/g, (match, n) => (n < args.length ? String(args[n]) : match));
}
