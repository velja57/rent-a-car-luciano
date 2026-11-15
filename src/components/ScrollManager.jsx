import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

// Pozicija skrola po stavci istorije — dugme "nazad" vraća tačno tamo gde je
// korisnik bio (npr. na listu vozila posle stranice jednog vozila).
const positions = new Map();

export default function ScrollManager() {
  const { key, pathname, hash, state } = useLocation();
  const navigationType = useNavigationType();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    window.history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    const save = () => positions.set(key, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [key]);

  useEffect(() => {
    const pathChanged = lastPathname.current !== pathname;
    lastPathname.current = pathname;

    // Promena jezika (ista stranica na drugom jeziku) ostaje na istom mestu.
    if (state?.keepScroll) return undefined;

    let timer;
    if (navigationType === 'POP' && positions.has(key)) {
      window.scrollTo({ top: positions.get(key), behavior: 'instant' });
    } else if (hash) {
      // Sadržaj može stići kasnije (pravne stranice se učitavaju tek kad se
      // otvore) — ako odeljka još nema, sačekaj ga najviše 3 sekunde.
      let id = hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // neispravan %-zapis u adresi — traži se doslovno
      }
      let tries = 0;
      const scrollToTarget = () => {
        const target = document.getElementById(id);
        if (target) target.scrollIntoView();
        else if (tries++ < 60) timer = setTimeout(scrollToTarget, 50);
      };
      scrollToTarget();
    } else if (pathChanged) {
      // 'instant' — globalni smooth scroll bi animirao skok na vrh nove stranice.
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    return () => clearTimeout(timer);
  }, [key, pathname, hash, navigationType, state]);

  return null;
}
