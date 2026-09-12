import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import common from '../locales/en/common.json';

/**
 * Infrastructure-only for now: English is the sole real locale (see
 * docs/comments at the call sites migrated to `t()` for the pattern to
 * extend). Adding a second language later is a translation-file task, not
 * an engineering one — add `locales/<lng>/common.json` and register it in
 * `resources` below.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { common } },
    fallbackLng: 'en',
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'luers-language',
    },
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('lang', lng);
});

export default i18n;
