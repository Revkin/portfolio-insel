import { useCallback } from 'react';
import { translate, type I18nKey } from '../content/i18n.ts';
import { useGame } from './store.ts';

export function useI18n() {
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const t = useCallback((key: I18nKey) => translate(lang, key), [lang]);
  return { lang, setLang, t };
}
