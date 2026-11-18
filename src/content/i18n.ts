import type { Lang, Localized } from './types.ts';

/** All UI strings. Every key must exist in both languages (enforced by type). */
const de = {
  'app.loading': 'Insel wird geladen …',
  'hud.language': 'Sprache',
  'hud.clickToLook': 'Ins Bild klicken, um dich mit der Maus umzusehen',
  'hud.controls':
    'WASD bewegen · Shift sprinten · Leertaste springen, in der Luft gleiten · gegen Felswand laufen: klettern · E öffnen · Esc Maus freigeben',
  'hud.stamina': 'Ausdauer',
  'portal.open': 'Öffnen',
  'overlay.close': 'Schließen',
  'overlay.closeHint': 'Esc',
  'overlay.role': 'Meine Rolle',
  'overlay.tags': 'Technologien',
  'overlay.period': 'Zeitraum',
  'overlay.github': 'GitHub',
  'overlay.demo': 'Live-Demo',
  'overlay.mediaPlaceholder': 'Bild oder Video folgt',
} as const;

type Key = keyof typeof de;

const en: Record<Key, string> = {
  'app.loading': 'Loading the island …',
  'hud.language': 'Language',
  'hud.clickToLook': 'Click into the scene to look around with the mouse',
  'hud.controls':
    'WASD move · Shift sprint · Space jump, in mid-air glide · run into a rock wall: climb · E open · Esc release mouse',
  'hud.stamina': 'Stamina',
  'portal.open': 'Open',
  'overlay.close': 'Close',
  'overlay.closeHint': 'Esc',
  'overlay.role': 'My role',
  'overlay.tags': 'Technologies',
  'overlay.period': 'Period',
  'overlay.github': 'GitHub',
  'overlay.demo': 'Live demo',
  'overlay.mediaPlaceholder': 'Image or video coming soon',
};

export type I18nKey = Key;

export const STRINGS: Record<Lang, Record<Key, string>> = { de, en };

export const LANGS: Lang[] = ['de', 'en'];

export function translate(lang: Lang, key: Key): string {
  return STRINGS[lang][key];
}

export function pick(text: Localized, lang: Lang): string {
  return text[lang];
}

export function detectInitialLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'de' || fromUrl === 'en') return fromUrl;
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}
