import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE, translate } from './dictionary.js';

const STORAGE_KEY = 'bbdu_lang';

const readStoredLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : FALLBACK_LANGUAGE;
  } catch {
    // Private mode or blocked storage: the app must still work in the default language
    return FALLBACK_LANGUAGE;
  }
};

const LanguageContext = createContext(null);

/**
 * Holds the chosen language (English or Hindi) and exposes t(). The choice is
 * remembered on the device. No translation library: see DEC-027.
 */
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (!SUPPORTED_LANGUAGES.includes(next)) return;
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* choice lasts for this visit only */
    }
  }, []);

  const t = useCallback((key, params) => translate(language, key, params), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
