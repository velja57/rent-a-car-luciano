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
    if (state?.keepScroll) return;

    if (navigationType === 'POP' && positions.has(key)) {
      window.scrollTo({ top: positions.get(key), behavior: 'instant' });
    } else if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else if (pathChanged) {
      // 'instant' — globalni smooth scroll bi animirao skok na vrh nove stranice.
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [key, pathname, hash, navigationType, state]);

  return null;
}
