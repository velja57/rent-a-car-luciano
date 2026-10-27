import { useEffect } from 'react';

// Naslov taba i meta opis za svaku stranicu (sajt je jedna HTML stranica,
// pa se ovo menja pri promeni rute).
export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}
