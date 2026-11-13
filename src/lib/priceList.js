import { useEffect, useState } from 'react';
import { fleet } from '../data/fleet';
import { DISCOUNT_TIERS, EXTRAS } from '../data/rental';
import { refreshPricingConstants } from './pricing';
import { isSupabaseConfigured, supabase } from './supabaseClient';

// Cenovnik (cene vozila, popusti, dodaci) je u bazi — admin ga menja u admin
// panelu (Vozila), a iznos svake rezervacije računa baza po njemu. Vrednosti u
// src/data su početne: sajt ih prikazuje dok se cenovnik ne učita (ili ako
// baza nije dostupna), a zatim ih zamenjuje cenama iz baze, pa sajt uvek
// prikazuje iste cene koje baza naplaćuje.
export function applyPriceList(list) {
  fleet.forEach((car) => {
    const price = list.cars?.[car.id];
    if (Number.isFinite(price)) car.pricePerDay = price;
    const fullCover = list.full_cover?.[car.id];
    if (Number.isFinite(fullCover)) car.fullCoverPrice = fullCover;
  });
  (list.discounts ?? []).forEach(({ min_days: minDays, discount_percent: percent }) => {
    const tier = DISCOUNT_TIERS.find((t) => t.minDays === minDays);
    if (tier) tier.discount = percent / 100;
  });
  (list.extras ?? []).forEach(({ id, price }) => {
    const extra = EXTRAS.find((e) => e.id === id);
    if (extra) extra.price = price;
  });
  refreshPricingConstants();
}

let request = null;

// Učitava cenovnik jednom (true = cene iz baze su primenjene).
export function loadPriceList({ force = false } = {}) {
  if (!isSupabaseConfigured) return Promise.resolve(false);
  if (force) request = null;
  request ??= supabase.rpc('get_price_list').then(({ data, error }) => {
    if (error || !data) {
      request = null;
      return false;
    }
    applyPriceList(data);
    return true;
  });
  return request;
}

// Za korensku komponentu: kad stigne cenovnik iz baze, stranica se ponovo
// iscrta sa tim cenama.
export function usePriceList() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    loadPriceList().then((applied) => active && applied && setVersion((v) => v + 1));
    return () => {
      active = false;
    };
  }, []);
}
