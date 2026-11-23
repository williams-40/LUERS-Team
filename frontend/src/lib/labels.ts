import type { Action, Category } from '../types/domain';
import i18n from './i18n';

/**
 * Backed by i18next (locales/en/common.json's category/role/action keys)
 * behind a Proxy so every existing `CATEGORY_LABELS[x]` call site across
 * the app keeps working unchanged — this is the migration path for
 * already-centralized label maps, see docs note in lib/i18n.ts.
 *
 * Known limitation: components reading through this Proxy (rather than
 * calling `useTranslation()`'s `t()` directly) won't automatically
 * re-render on a language change, since they're not subscribed to i18next.
 * Invisible today (English is the only locale, no switcher exists yet) —
 * if a second language + switcher is ever added, migrate hot call sites to
 * `useTranslation()` directly instead of relying on this Proxy.
 */
function createLabelProxy<T extends string>(namespace: string): Record<T, string> {
  return new Proxy({} as Record<T, string>, {
    get(_target, key: string) {
      return i18n.t(`${namespace}.${key}`);
    },
  });
}

export const CATEGORY_LABELS: Record<Category, string> = createLabelProxy('category');
export const ACTION_LABELS: Record<Action, string> = createLabelProxy('action');
