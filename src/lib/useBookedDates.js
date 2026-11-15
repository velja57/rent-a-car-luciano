import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabaseClient';

// Zauzeti termini jednog vozila ([{ pickup_date, return_date }], bez ličnih
// podataka) — za precrtavanje dana u kalendaru. Ako funkcija get_booked_dates
// još ne postoji u bazi (SQL iz supabase/schema.sql nije pokrenut), vraća
// praznu listu; zauzetost se i dalje proverava pri izboru datuma i slanju.
// version: promena vrednosti ponovo učitava termine (npr. posle nove rezervacije).
export function useBookedDates(carId, version = 0) {
  const [ranges, setRanges] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !carId) return undefined;
    let cancelled = false;
    supabase.rpc('get_booked_dates', { p_car_id: carId }).then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data)) setRanges(data);
    });
    return () => {
      cancelled = true;
    };
  }, [carId, version]);

  return ranges;
}
