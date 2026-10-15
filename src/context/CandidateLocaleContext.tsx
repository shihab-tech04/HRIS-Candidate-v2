import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CandidateLocale, CandidateTranslationValues, translateCandidateText } from '../lib/candidateLocale';

type CandidateLocaleContextValue = {
  locale: CandidateLocale;
  setLocale: (locale: CandidateLocale) => void;
  t: (text: string, values?: CandidateTranslationValues) => string;
};

function readStoredLocale(): CandidateLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem('synesis-candidate-locale-v1') === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

const CandidateLocaleContext = createContext<CandidateLocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: text => text,
});

export function CandidateLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<CandidateLocale>(readStoredLocale);
  const t = useCallback((text: string, values?: CandidateTranslationValues) =>
    translateCandidateText(text, locale, values), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem('synesis-candidate-locale-v1', locale);
    } catch {
      // Language switching still works for this session when storage is unavailable.
    }
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <CandidateLocaleContext.Provider value={value}>{children}</CandidateLocaleContext.Provider>;
}

export function useCandidateLocale() {
  return useContext(CandidateLocaleContext);
}

export function CandidateLocaleSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useCandidateLocale();
  const nextLocale: CandidateLocale = locale === 'en' ? 'bn' : 'en';
  const label = nextLocale === 'bn' ? t('Switch to Bengali') : t('Switch to English');

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      aria-label={label}
      title={label}
      className={`min-h-11 min-w-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#085587] hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#085587] ${className}`}
    >
      {nextLocale === 'bn' ? 'বাংলা' : 'EN'}
    </button>
  );
}
