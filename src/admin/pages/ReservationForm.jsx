import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { quote, rentalDays } from '../../lib/pricing';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatMoney, shortId, todayBelgrade } from '../lib/format';
import { ACTIVE_STATUSES, DEFAULT_LOCATION, EXTRA_OPTIONS, LANGUAGES, VEHICLES, vehicleById } from '../lib/labels';

const AVAILABILITY_DEBOUNCE_MS = 400;

const EMPTY_FORM = {
  carId: '',
  pickupDate: '',
  returnDate: '',
  pickupTime: '',
  returnTime: '',
  pickupLocation: DEFAULT_LOCATION,
  returnLocation: '',
  customerName: '',
  phone: '',
  email: '',
  dob: '',
  language: 'sr',
  extras: [],
  totalPrice: '',
  note: '',
};

function formFromReservation(r) {
  return {
    carId: r.car_id,
    pickupDate: r.pickup_date,
    returnDate: r.return_date,
    pickupTime: r.pickup_time?.slice(0, 5) ?? '',
    returnTime: r.return_time?.slice(0, 5) ?? '',
    pickupLocation: r.pickup_location ?? '',
    returnLocation: r.return_location ?? '',
    customerName: r.customer_name ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    dob: r.date_of_birth ?? '',
    language: r.language ?? 'sr',
    extras: r.extras ?? [],
    totalPrice: r.total_price === null ? '' : String(r.total_price),
    note: r.note ?? '',
  };
}

// Iste provere kao reservation_input_error u bazi (baza ih ponavlja pri čuvanju).
function validate(f) {
  const e = {};
  if (!f.carId) e.carId = 'Izaberi vozilo.';
  if (!f.pickupDate) e.pickupDate = 'Izaberi datum preuzimanja.';
  if (!f.returnDate) e.returnDate = 'Izaberi datum vraćanja.';
  else if (f.pickupDate && f.returnDate <= f.pickupDate) e.returnDate = 'Vraćanje mora biti posle preuzimanja.';
  if (!f.pickupLocation.trim()) e.pickupLocation = 'Upiši lokaciju preuzimanja.';
  if (!f.customerName.trim()) e.customerName = 'Upiši ime i prezime kupca.';
  if (!/^[0-9+\s/()-]{6,}$/.test(f.phone.trim())) e.phone = 'Upiši ispravan broj telefona (najmanje 6 cifara).';
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Email adresa nije ispravna.';
  if (f.totalPrice !== '') {
    const price = Number(f.totalPrice);
    if (!Number.isFinite(price) || price < 0 || price > 100000) e.totalPrice = 'Iznos mora biti između 0 i 100.000 €.';
  }
  return e;
}

// Greška iz baze -> polje forme na koje se odnosi.
const REASON_FIELDS = {
  invalid_car: 'carId',
  invalid_dates: 'returnDate',
  invalid_location: 'pickupLocation',
  invalid_name: 'customerName',
  invalid_phone: 'phone',
  invalid_email: 'email',
  invalid_price: 'totalPrice',
  unavailable: 'returnDate',
};

function Field({ label, error, hint, children, wide = false }) {
  return (
    <label className={`admin-field${wide ? ' admin-field--wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && !error && <small className="admin-muted">{hint}</small>}
      {error && <em className="admin-field__error">{error}</em>}
    </label>
  );
}

export default function ReservationForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const existing = useAdminData(() => (editing ? adminApi.getReservation(id) : Promise.resolve(null)), [id]);
  const original = existing.data?.reservation ?? null;

  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    // Prečica iz kalendara: #/rezervacije/nova?vozilo=golf&od=2026-11-10
    carId: vehicleById(params.get('vozilo')) ? params.get('vozilo') : '',
    pickupDate: params.get('od') ?? '',
  }));
  const [loaded, setLoaded] = useState(!editing);
  // Kod nove rezervacije iznos prati predlog po cenovniku dok ga admin ne promeni ručno.
  const [priceTouched, setPriceTouched] = useState(editing);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState({ state: 'idle', conflicts: [] });

  useEffect(() => {
    if (editing && original && !loaded) {
      setForm(formFromReservation(original));
      setLoaded(true);
    }
  }, [editing, original, loaded]);

  const vehicle = vehicleById(form.carId);
  const days = rentalDays(form.pickupDate, form.returnDate);
  const suggestion = vehicle && days > 0 ? quote(vehicle, days, form.extras) : null;

  useEffect(() => {
    if (!priceTouched) setForm((f) => ({ ...f, totalPrice: suggestion ? String(suggestion.total) : '' }));
  }, [priceTouched, suggestion?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zauzetost vozila za izabrani period (rezervacija koja se menja se ne računa).
  useEffect(() => {
    if (!loaded || !form.carId || days <= 0) {
      setAvailability({ state: 'idle', conflicts: [] });
      return undefined;
    }
    let cancelled = false;
    setAvailability({ state: 'checking', conflicts: [] });
    const timer = setTimeout(() => {
      adminApi
        .checkAvailability(form.carId, form.pickupDate, form.returnDate, id)
        .then((res) => !cancelled && setAvailability({ state: res.available ? 'free' : 'busy', conflicts: res.conflicts }))
        .catch(() => !cancelled && setAvailability({ state: 'error', conflicts: [] }));
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loaded, form.carId, form.pickupDate, form.returnDate, days, id]);

  if (editing && !original && existing.loading) return <LoadingState />;
  if (editing && !original && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;

  // Otkazana / "nije se pojavio" rezervacija ne zauzima termin — zauzetost tada ne smeta.
  const occupiesDates = !editing || ACTIVE_STATUSES.includes(original?.status);
  const blocked = occupiesDates && availability.state === 'busy';

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  };

  const toggleExtra = (extraId) =>
    setForm((f) => ({
      ...f,
      extras: f.extras.includes(extraId) ? f.extras.filter((x) => x !== extraId) : [...f.extras, extraId],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Proveri označena polja.');
      return;
    }
    if (blocked) {
      setFormError('Vozilo je zauzeto u izabranom periodu — promeni datume ili vozilo.');
      return;
    }

    const fields = { ...form, carName: vehicle?.name ?? original?.car_name ?? form.carId };
    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateReservation(id, fields);
        toast.success('Izmene su sačuvane.');
        navigate(`/rezervacije/${id}`, { replace: true });
      } else {
        const res = await adminApi.createReservation(fields);
        toast.success('Rezervacija je napravljena.');
        navigate(`/rezervacije/${res.id}`, { replace: true });
      }
    } catch (err) {
      const field = REASON_FIELDS[err.reason];
      if (field) setErrors((prev) => ({ ...prev, [field]: err.message }));
      if (err.reason === 'unavailable') setAvailability((a) => ({ ...a, state: 'busy' }));
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelHref = editing ? `/rezervacije/${id}` : '/rezervacije';
  const unknownCar = editing && original && !vehicleById(original.car_id);
  const pastPickup = !editing && form.pickupDate && form.pickupDate < todayBelgrade();

  return (
    <div className="admin-page">
      <Link to={cancelHref} className="admin-link admin-back">
        ← {editing ? 'Nazad na rezervaciju' : 'Rezervacije'}
      </Link>
      <div className="admin-page__header">
        <div>
          <h1>{editing ? `Izmena rezervacije #${shortId(id)}` : 'Nova rezervacija'}</h1>
          {!editing && (
            <p className="admin-muted">Za ručno unetu rezervaciju kupac ne dobija automatski mejl.</p>
          )}
        </div>
      </div>

      <form className="admin-form" onSubmit={handleSubmit} noValidate>
        <section className="admin-panel">
          <h2 className="admin-panel__title">Vozilo i termin</h2>
          <div className="admin-form__grid">
            <Field label="Vozilo" error={errors.carId} wide>
              <select value={form.carId} onChange={set('carId')}>
                <option value="">Izaberi vozilo…</option>
                {unknownCar && <option value={original.car_id}>{original.car_name} (nije u ponudi)</option>}
                {VEHICLES.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name} — {car.pricePerDay}€/dan
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Datum preuzimanja" error={errors.pickupDate} hint={pastPickup ? 'Datum je u prošlosti.' : undefined}>
              <input type="date" value={form.pickupDate} onChange={set('pickupDate')} />
            </Field>
            <Field label="Vreme preuzimanja (opciono)">
              <input type="time" value={form.pickupTime} onChange={set('pickupTime')} />
            </Field>
            <Field label="Datum vraćanja" error={errors.returnDate}>
              <input type="date" value={form.returnDate} min={form.pickupDate || undefined} onChange={set('returnDate')} />
            </Field>
            <Field label="Vreme vraćanja (opciono)">
              <input type="time" value={form.returnTime} onChange={set('returnTime')} />
            </Field>
            <Field label="Lokacija preuzimanja" error={errors.pickupLocation} wide>
              <input type="text" value={form.pickupLocation} onChange={set('pickupLocation')} />
            </Field>
            <Field label="Lokacija vraćanja (opciono)" hint="Prazno = ista kao preuzimanje." wide>
              <input type="text" value={form.returnLocation} onChange={set('returnLocation')} />
            </Field>
          </div>

          {availability.state !== 'idle' && (
            <div className={`admin-availability admin-availability--${blocked ? 'busy' : availability.state}`} aria-live="polite">
              {availability.state === 'checking' && 'Proveravam da li je vozilo slobodno…'}
              {availability.state === 'error' && 'Provera zauzetosti nije uspela — baza će je ponoviti pri čuvanju.'}
              {availability.state === 'free' && `Vozilo je slobodno (${days} ${days === 1 ? 'dan' : 'dana'}).`}
              {availability.state === 'busy' && (
                <>
                  {occupiesDates
                    ? 'Vozilo je zauzeto u ovom periodu (dan vraćanja se računa kao zauzet):'
                    : 'Termin je u međuvremenu zauzet. Ova rezervacija nije aktivna, pa izmenu možeš sačuvati, ali je ne možeš ponovo aktivirati dok je termin zauzet:'}
                  <ul>
                    {availability.conflicts.map((c) => (
                      <li key={c.id}>
                        <Link to={`/rezervacije/${c.id}`} target="_blank" rel="noopener noreferrer">
                          {c.customer_name}
                        </Link>{' '}
                        — {formatDate(c.pickup_date)} do {formatDate(c.return_date)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Kupac</h2>
          <div className="admin-form__grid">
            <Field label="Ime i prezime" error={errors.customerName} wide>
              <input type="text" autoComplete="off" value={form.customerName} onChange={set('customerName')} />
            </Field>
            <Field label="Telefon" error={errors.phone}>
              <input type="tel" autoComplete="off" value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email (opciono)" error={errors.email}>
              <input type="email" autoComplete="off" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Datum rođenja (opciono)">
              <input type="date" value={form.dob} max={todayBelgrade()} onChange={set('dob')} />
            </Field>
            <Field label="Jezik kupca" hint="Za podsetnik dan pre preuzimanja.">
              <select value={form.language} onChange={set('language')}>
                {Object.entries(LANGUAGES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Cena i dodaci</h2>
          <fieldset className="admin-extras">
            <legend className="admin-muted">Dodaci</legend>
            {EXTRA_OPTIONS.map((extra) => (
              <label key={extra.id} className="admin-check">
                <input type="checkbox" checked={form.extras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                <span>{extra.name}</span>
                <span className="admin-muted">
                  {extra.price ? `${extra.price}€${extra.per === 'day' ? '/dan' : ''}` : 'besplatno'}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="admin-form__grid">
            <Field label="Ukupan iznos (€)" error={errors.totalPrice} hint="Prazno = iznos nije dogovoren.">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100000"
                step="0.01"
                value={form.totalPrice}
                onChange={(e) => {
                  setPriceTouched(true);
                  set('totalPrice')(e);
                }}
              />
            </Field>
            <div className="admin-suggestion">
              {suggestion ? (
                <>
                  <span className="admin-muted">Po cenovniku sajta:</span>
                  <strong>{formatMoney(suggestion.total)}</strong>
                  <span className="admin-muted">
                    {days} × {formatMoney(suggestion.rate)}
                    {suggestion.tier.discount > 0 && ` (popust ${Math.round(suggestion.tier.discount * 100)}%)`}
                    {suggestion.extrasTotal > 0 && ` + dodaci ${formatMoney(suggestion.extrasTotal)}`}
                  </span>
                  {String(suggestion.total) !== form.totalPrice && (
                    <button
                      type="button"
                      className="admin-link"
                      onClick={() => {
                        // Nova rezervacija: iznos ponovo prati predlog (menja se sa datumima i dodacima).
                        if (!editing) setPriceTouched(false);
                        setForm((f) => ({ ...f, totalPrice: String(suggestion.total) }));
                        setErrors((prev) => ({ ...prev, totalPrice: undefined }));
                      }}
                    >
                      Primeni predlog
                    </button>
                  )}
                </>
              ) : (
                <span className="admin-muted">Izaberi vozilo i datume za predlog cene.</span>
              )}
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Napomena</h2>
          <Field label="Interna napomena (opciono)" wide>
            <textarea rows={3} value={form.note} onChange={set('note')} />
          </Field>
        </section>

        {formError && (
          <p className="admin-error admin-form__error" role="alert">
            {formError}
          </p>
        )}

        <div className="admin-form__actions">
          <Link to={cancelHref} className="admin-btn">
            Odustani
          </Link>
          <button type="submit" className="admin-btn admin-btn--accent" disabled={saving || availability.state === 'checking'}>
            {saving ? 'Čuvam…' : editing ? 'Sačuvaj izmene' : 'Napravi rezervaciju'}
          </button>
        </div>
      </form>
    </div>
  );
}
