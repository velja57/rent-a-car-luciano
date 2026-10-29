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
  invalid_price: 'Iznos mora biti između 0 i 100.000 €.',
  invalid_range: 'Neispravan period.',
};

const NETWORK_ERROR = 'Veza sa bazom nije uspela. Proveri internet i pokušaj ponovo.';

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
    p_total_price: f.totalPrice === '' ? null : Number(f.totalPrice),
    p_extras: f.extras.length ? f.extras : null,
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
  listReservations: (params) => call('admin_list_reservations', params),
  getReservation: (id) => call('admin_get_reservation', { p_id: id }),
  checkAvailability: (carId, pickup, ret, excludeId) =>
    call('admin_check_availability', {
      p_car_id: carId,
      p_pickup: pickup,
      p_return: ret,
      p_exclude_id: excludeId ?? null,
    }),
  createReservation: (fields) => call('admin_create_reservation', reservationParams(fields)),
  updateReservation: (id, fields) => call('admin_update_reservation', { p_id: id, ...reservationParams(fields) }),
  setStatus: (id, status) => call('admin_set_status', { p_id: id, p_status: status }),
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
