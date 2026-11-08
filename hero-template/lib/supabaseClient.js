// Klijent prosleđuje sajt (prop "supabase" na HeroSection), pa template ne zavisi
// od paketa @supabase/supabase-js. Bez klijenta rezervacija ide preko WhatsApp-a.
export let supabase = null;
export let isSupabaseConfigured = false;

export function connectSupabase(client) {
  supabase = client ?? null;
  isSupabaseConfigured = Boolean(client);
}
