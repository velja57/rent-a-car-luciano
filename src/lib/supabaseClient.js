import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Dok Supabase projekat nije podešen (vidi README_RESERVATIONS.md), ove
// env promenljive ne postoje — tada ostaje null i rezervacioni sistem
// pada na WhatsApp-only fallback umesto da obori ceo sajt.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nisu podešeni — online rezervacije (baza + provera dostupnosti + email) su isključene, forma koristi samo WhatsApp. Vidi README_RESERVATIONS.md.',
  );
}
