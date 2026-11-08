import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './en.json';
import he from './he.json';

export type Locale = 'he' | 'en';

type Messages = Record<string, string>;
const CATALOGS: Record<Locale, Messages> = { en, he };
const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['he']);
const STORAGE_KEY = 'crm.locale';

interface I18nValue {
  readonly locale: Locale;
  readonly dir: 'rtl' | 'ltr';
  setLocale(locale: Locale): void;
  /** Translate a key; falls back to the key itself if missing. */
  t(key: string): string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): Locale {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return stored === 'en' || stored === 'he' ? stored : 'he';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / blocked storage: a non-persisted locale is fine.
    }
  }, []);

  const t = useCallback((key: string): string => CATALOGS[locale][key] ?? key, [locale]);

  const value = useMemo<I18nValue>(() => ({ locale, dir, setLocale, t }), [locale, dir, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
