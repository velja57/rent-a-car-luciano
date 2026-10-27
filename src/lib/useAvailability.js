import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabaseClient';

// Isto kašnjenje kao u ReservationModal — ne šaljemo upit na svaki klik u kalendaru.
const AVAILABILITY_DEBOUNCE_MS = 450;

// Proverava dostupnost više vozila za isti period (ista RPC funkcija kao forma
// za rezervaciju). status: idle | checking | ready | error; byId: { [id]: true/false }.
export function useAvailability(carIds, pickup, ret) {
  const [state, setState] = useState({ status: 'idle', byId: {} });
  const idsKey = carIds.join(',');

  useEffect(() => {
    if (!isSupabaseConfigured || !idsKey || !pickup || !ret || ret <= pickup) {
      setState({ status: 'idle', byId: {} });
      return undefined;
    }

    let cancelled = false;
    setState((s) => ({ ...s, status: 'checking' }));
    const timer = setTimeout(async () => {
      const ids = idsKey.split(',');
      const results = await Promise.all(
        ids.map((id) => supabase.rpc('is_car_available', { p_car_id: id, p_pickup: pickup, p_return: ret })),
      );
      if (cancelled) return;
      if (results.some((r) => r.error)) {
        setState({ status: 'error', byId: {} });
        return;
      }
      setState({ status: 'ready', byId: Object.fromEntries(ids.map((id, i) => [id, Boolean(results[i].data)])) });
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idsKey, pickup, ret]);

  return state;
}
