import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { dictionaries, I18nContext } from './index';
import { localizeCar } from './localizeCar';
import { langFromPath, PATHS } from './routes';

// Jezik se određuje iz adrese (/en/... = engleski), pa svaka stranica ima
// svoju adresu na oba jezika.
export default function I18nProvider({ children }) {
  const { pathname } = useLocation();
  const lang = langFromPath(pathname);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(
    () => ({ lang, t: dictionaries[lang], paths: PATHS[lang], localize: (car) => localizeCar(car, lang) }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
