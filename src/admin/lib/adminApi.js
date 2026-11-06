import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Svi pozivi baze iz admin panela. Funkcije su u supabase/schema.sql i same
// proveravaju da li je prijavljeni korisnik admin — ovde se samo pozivaju.

// Razlozi koje vraćaju funkcije u bazi ({ success: false, reason }).
const REASONS = {
  forbidden: 'Ovaj nalog nema pristup admin panelu.',
  not_found: 'Rezervacija nije pronađena.',
  unavailable: 'Vozilo je zauzeto u izabranom periodu.',
  invalid_transition: 'Ova promena statusa nije dozvoljena.',
  invalid_dates: 'Datum vraćanja mora biti posle datuma preuzimanja.',
  invalid_car: 'Izaberi vozilo.',
  invalid_name: 'Upiši ime i prezime kupca.',
  invalid_phone: 'Upiši ispravan broj telefona (najmanje 6 cifara).',
  invalid_email: 'Email adresa nije ispravna.',
  invalid_location: 'Upiši lokaciju preuzimanja.',
  invalid_price: 'Neispravan iznos (cena po danu do 10.000 €, ukupno do 100.000 €).',
  invalid_range: 'Neispravan period.',
  invalid_discount: 'Popust mora biti između 0 i 90%.',
  invalid_kind: 'Izaberi vrstu uplate.',
  invalid_amount: 'Iznos mora biti veći od 0 (najviše 100.000 €).',
  invalid_method: 'Izaberi način plaćanja.',
  no_price: 'Rezervacija nema cenu — upiši je preko „Izmeni“, pa označi preuzimanje.',
};

const NETWORK_ERROR = 'Veza sa bazom nije uspela. Proveri internet i pokušaj ponovo.';
const OUTDATED_DB = 'Baza još nije ažurirana: pokreni najnoviji supabase/schema.sql u Supabase SQL Editoru.';

export class AdminError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

async function call(fn, params) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) {
    console.error(`[admin] ${fn}`, error);
    // Funkcija ne postoji u bazi — schema.sql nije pokrenut posle izmene koda.
    if (error.code === 'PGRST202') throw new AdminError('outdated_db', OUTDATED_DB);
    throw new AdminError('network', NETWORK_ERROR);
  }
  if (data?.success === false) {
    throw new AdminError(data.reason, REASONS[data.reason] ?? 'Akcija nije uspela. Pokušaj ponovo.');
  }
  return data;
}

// Polja forme -> parametri funkcija admin_create/update_reservation.
function reservationParams(f) {
  return {
    p_car_id: f.carId,
    p_car_name: f.carName,
    p_customer_name: f.customerName,
    p_phone: f.phone,
    p_pickup: f.pickupDate,
    p_return: f.returnDate,
    p_location: f.pickupLocation,
    p_email: f.email || null,
    p_dob: f.dob || null,
    p_pickup_time: f.pickupTime || null,
    p_return_time: f.returnTime || null,
    p_return_location: f.returnLocation || null,
    p_note: f.note || null,
    p_language: f.language,
    // Najam i ukupno računa baza: cena po danu × broj dana + dodaci.
    p_daily_rate: f.dailyRate === '' ? null : Number(f.dailyRate),
    p_extras_total: f.extrasTotal === '' ? null : Number(f.extrasTotal),
    p_extras: f.extras.length ? f.extras : null,
  };
}

// Vreme preuzimanja/vraćanja za proveru zauzetosti i cenu (dan = 24 h od preuzimanja).
function timeParams(pickupTime, returnTime) {
  return {
    ...(pickupTime ? { p_pickup_time: pickupTime } : {}),
    ...(returnTime ? { p_return_time: returnTime } : {}),
  };
}

export const adminApi = {
  async isAdmin() {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('[admin] is_admin', error);
      throw new AdminError('network', NETWORK_ERROR);
    }
    return data === true;
  },
  overview: () => call('admin_overview'),
  // Vozni park: status vozila (izdato / dostupno), najmovi i prihod po vozilu.
  fleet: () => call('admin_fleet'),
  listReservations: (params) => call('admin_list_reservations', params),
  getReservation: (id) => call('admin_get_reservation', { p_id: id }),
  // Vreme se šalje samo kad je upisano (bez vremena rezervacija zauzima cele dane).
  checkAvailability: (carId, pickup, ret, excludeId, pickupTime, returnTime) =>
    call('admin_check_availability', {
      p_car_id: carId,
      p_pickup: pickup,
      p_return: ret,
      p_exclude_id: excludeId ?? null,
      ...timeParams(pickupTime, returnTime),
    }),
  createReservation: (fields) => call('admin_create_reservation', reservationParams(fields)),
  updateReservation: (id, fields) => call('admin_update_reservation', { p_id: id, ...reservationParams(fields) }),
  setStatus: (id, status) => call('admin_set_status', { p_id: id, p_status: status }),
  // Vozilo preuzeto = kupac je platio ceo iznos: status + uplata u jednom koraku.
  pickup: (id, method) => call('admin_pickup', { p_id: id, p_method: method ?? null }),
  // Greškom kliknuto "Vozilo preuzeto": nazad u potvrđenu, naplata se poništava.
  undoPickup: (id) => call('admin_undo_pickup', { p_id: id }),
  // Vozilo vraćeno: završena rezervacija; raniji povraćaj oslobađa preostale dane.
  returnCar: (id) => call('admin_return', { p_id: id }),
  calendar: (from, to) => call('admin_calendar', { p_from: from, p_to: to }),
  // Registarske oznake i beleške (tabela vehicle_registry — čita je samo admin, RLS).
  async listVehicles() {
    const { data, error } = await supabase.from('vehicle_registry').select('car_id, registration, notes');
    if (error) {
      console.error('[admin] vehicle_registry', error);
      throw new AdminError('network', NETWORK_ERROR);
    }
    return data ?? [];
  },
  saveVehicle: (carId, registration, notes) =>
    call('admin_upsert_vehicle', { p_car_id: carId, p_registration: registration || null, p_notes: notes || null }),
  // Predlog cene po trenutnom cenovniku (null ako vozilo nije u cenovniku).
  quote: async (carId, pickup, ret, extras, pickupTime, returnTime) =>
    (
      await call('admin_quote', {
        p_car_id: carId,
        p_pickup: pickup,
        p_return: ret,
        p_extras: extras.length ? extras : null,
        ...timeParams(pickupTime, returnTime),
      })
    ).quote,
  async priceList() {
    const { data, error } = await supabase.rpc('get_price_list');
    if (error) {
      console.error('[admin] get_price_list', error);
      throw new AdminError('network', NETWORK_ERROR);
    }
    return data;
  },
  setCarPrice: (carId, price) => call('admin_set_car_price', { p_car_id: carId, p_price_per_day: price }),
  setDiscount: (minDays, percent) => call('admin_set_discount', { p_min_days: minDays, p_discount_percent: percent }),
  setExtraPrice: (id, price) => call('admin_set_extra_price', { p_id: id, p_price: price }),
  addPayment: ({ reservationId, kind, amount, method, paidAt, note }) =>
    call('admin_add_payment', {
      p_reservation_id: reservationId,
      p_kind: kind,
      p_amount: amount,
      p_method: method,
      p_paid_at: paidAt || null,
      p_note: note || null,
    }),
  voidPayment: (id, reason) => call('admin_void_payment', { p_payment_id: id, p_reason: reason || null }),
  // Analitika prihoda: naplaćeno pri preuzimanju (danas, nedelja, mesec, godina, ukupno i izabrani period).
  income: ({ from, to }) => call('admin_income', { p_from: from, p_to: to }),
  // Uplate i povraćaji u periodu — stavke iza zbira "Naplaćeno u periodu".
  listPayments: ({ from, to, carId }) => call('admin_list_payments', { p_from: from, p_to: to, p_car_id: carId || null }),
};

// Učitavanje podataka za stranicu: { data, error, loading, reload }.
// Pri ponovnom učitavanju stari podaci ostaju prikazani dok ne stignu novi.
export function useAdminData(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, error: null, loading: true }));
    run()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState((s) => ({ ...s, error, loading: false })));
    return () => {
      cancelled = true;
    };
  }, [run, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
