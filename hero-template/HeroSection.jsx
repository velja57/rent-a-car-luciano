import { useCallback, useEffect, useMemo, useState } from 'react';
import Hero from './components/Hero';
import SiteHeader from './components/SiteHeader';
import { DEFAULT_LANGUAGE, PATHS } from './hero.config';
import { dictionaries, I18nContext } from './i18n';
import { localizeCar } from './i18n/localizeCar';
import { usePriceList } from './lib/priceList';
import { connectSupabase } from './lib/supabaseClient';
import './hero.css';

// Kompletna Hero sekcija sa zaglavljem (logo, meni, jezik, poziv). Nijedan prop nije obavezan.
// - showHeader: false ako sajt već ima svoje zaglavlje
// - supabase: klijent iz createClient(); bez njega rezervacija ide preko WhatsApp-a
// - language / onLanguageChange: ako jezik određuje sajt (npr. po adresi)
// - renderLink: ({ href, ...props }) => element, za navigaciju bez ponovnog učitavanja strane
export default function HeroSection({ showHeader = true, supabase = null, language, onLanguageChange, renderLink }) {
  connectSupabase(supabase);
  // Cene iz baze (ako je povezana) — kad stignu, sekcija se ponovo iscrta.
  usePriceList();

  const [ownLanguage, setOwnLanguage] = useState(DEFAULT_LANGUAGE);
  const lang = language ?? ownLanguage;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (next) => {
      setOwnLanguage(next);
      onLanguageChange?.(next);
    },
    [onLanguageChange],
  );

  const value = useMemo(
    () => ({
      lang,
      t: dictionaries[lang],
      paths: PATHS[lang],
      localize: (car) => localizeCar(car, lang),
      setLang,
      renderLink,
    }),
    [lang, setLang, renderLink],
  );

  return (
    <I18nContext.Provider value={value}>
      <div className="hero-tpl">
        {showHeader && <SiteHeader />}
        <Hero />
      </div>
    </I18nContext.Provider>
  );
}
