import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabaseClient';

// Isto kašnjenje kao u ReservationModal — ne šaljemo upit na svaki klik u kalendaru.
const AVAILABILITY_DEBOUNCE_MS = 450;

// Proverava dostupnost više vozila za isti period (ista RPC funkcija kao forma
// za rezervaciju). status: idle | checking | ready | error; byId: { [id]: true/false }.
// Sa vremenima (Hero) provera je tačna po terminu; bez njih samo po datumima.
// version: promena vrednosti ponavlja proveru (npr. posle nove rezervacije).
export function useAvailability(carIds, pickup, ret, pickupTime = '', returnTime = '', version = 0) {
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
      const checkCar = async (id) => {
        const dates = { p_car_id: id, p_pickup: pickup, p_return: ret };
        if (!pickupTime || !returnTime) return supabase.rpc('is_car_available', dates);
        const result = await supabase.rpc('is_car_available', { ...dates, p_pickup_time: pickupTime, p_return_time: returnTime });
        // Baza još bez provere po vremenu (schema.sql nije pokrenut) — samo datumi.
        return result.error?.code === 'PGRST202' ? supabase.rpc('is_car_available', dates) : result;
      };
      const results = await Promise.all(ids.map(checkCar));
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
  }, [idsKey, pickup, ret, pickupTime, returnTime, version]);

  return state;
}
