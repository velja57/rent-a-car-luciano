import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { extraPrice } from '../../lib/pricing';
import { billableDays, graceUntil } from '../../lib/rentalTimes';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatMoney, shortId, todayBelgrade } from '../lib/format';
import { ACTIVE_STATUSES, DEFAULT_LOCATION, extraOptions, LANGUAGES, VEHICLES, vehicleById } from '../lib/labels';

const AVAILABILITY_DEBOUNCE_MS = 400;

const toCents = (value) => Math.round(Number(value) * 100);

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
  dailyRate: '',
  extrasTotal: '',
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
    // Snimak cene iz trenutka rezervacije — ostaje dok ga admin ne promeni.
    dailyRate: r.daily_rate === null ? '' : String(Number(r.daily_rate)),
    extrasTotal: r.extras_total === null ? '' : String(Number(r.extras_total)),
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
  if (f.dailyRate !== '') {
    const rate = Number(f.dailyRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 10000) e.dailyRate = 'Cena po danu mora biti između 0 i 10.000 €.';
  } else if (f.extrasTotal !== '' && Number(f.extrasTotal) > 0) {
    e.dailyRate = 'Upiši cenu po danu (dodaci se računaju uz najam).';
  }
  if (f.extrasTotal !== '') {
    const extras = Number(f.extrasTotal);
    if (!Number.isFinite(extras) || extras < 0 || extras > 100000) e.extrasTotal = 'Iznos dodataka mora biti između 0 i 100.000 €.';
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
  invalid_price: 'dailyRate',
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
  // Kod nove rezervacije cena prati cenovnik dok je admin ne promeni ručno;
  // kod izmene ostaje cena iz trenutka rezervacije.
  const [priceTouched, setPriceTouched] = useState(editing);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState({ state: 'idle', conflicts: [] });
  const [suggestion, setSuggestion] = useState(null); // predlog po cenovniku iz baze (admin_quote)
  // Stanje predloga: dok stiže iz baze ne sme da piše "nije u cenovniku".
  const [quoteState, setQuoteState] = useState('idle'); // idle | loading | ready | error

  useEffect(() => {
    if (editing && original && !loaded) {
      setForm(formFromReservation(original));
      setLoaded(true);
    }
  }, [editing, original, loaded]);

  const vehicle = vehicleById(form.carId);
  // Dan najma = 24 h od preuzimanja (vraćanje do 59 min kasnije se ne računa);
  // bez upisanog vremena — razlika datuma, kao i ranije.
  const days = billableDays(form.pickupDate, form.pickupTime, form.returnDate, form.returnTime);
  const extrasKey = form.extras.join(',');

  // Predlog cene po trenutnom cenovniku (računa baza, isto kao za sajt).
  useEffect(() => {
    if (!loaded || !form.carId || days <= 0) {
      setSuggestion(null);
      setQuoteState('idle');
      return undefined;
    }
    let cancelled = false;
    setQuoteState('loading');
    const timer = setTimeout(() => {
      adminApi
        .quote(
          form.carId,
          form.pickupDate,
          form.returnDate,
          extrasKey ? extrasKey.split(',') : [],
          form.pickupTime,
          form.returnTime,
        )
        .then((q) => {
          if (cancelled) return;
          setSuggestion(q);
          setQuoteState('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestion(null);
          setQuoteState('error');
        });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loaded, form.carId, form.pickupDate, form.returnDate, form.pickupTime, form.returnTime, days, extrasKey]);

  useEffect(() => {
    if (priceTouched) return;
    setForm((f) => ({
      ...f,
      dailyRate: suggestion ? String(suggestion.daily_rate) : '',
      extrasTotal: suggestion ? String(suggestion.extras_total) : '',
    }));
  }, [priceTouched, suggestion]);

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
        .checkAvailability(form.carId, form.pickupDate, form.returnDate, id, form.pickupTime, form.returnTime)
        .then((res) => !cancelled && setAvailability({ state: res.available ? 'free' : 'busy', conflicts: res.conflicts }))
        .catch(() => !cancelled && setAvailability({ state: 'error', conflicts: [] }));
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loaded, form.carId, form.pickupDate, form.returnDate, form.pickupTime, form.returnTime, days, id]);

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

  // Obračun kao u bazi: najam = cena po danu × dani, ukupno = najam + dodaci.
  const setPrice = (field) => (e) => {
    setPriceTouched(true);
    set(field)(e);
  };
  const priced = form.dailyRate !== '' && Number.isFinite(Number(form.dailyRate)) && days > 0;
  const rentalCents = priced ? toCents(form.dailyRate) * days : 0;
  const extrasCents = form.extrasTotal === '' ? 0 : toCents(form.extrasTotal) || 0;
  const matchesSuggestion =
    suggestion && priced && toCents(form.dailyRate) === toCents(suggestion.daily_rate) && extrasCents === toCents(suggestion.extras_total);
  const unsplitTotal = editing && original && original.total_price !== null && original.daily_rate === null;

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
            <Field
              label="Vreme vraćanja (opciono)"
              hint={
                form.pickupTime && form.returnTime
                  ? `Do ${graceUntil(form.pickupTime)} bez dodatnog dana (dan najma = 24 h).`
                  : undefined
              }
            >
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
                    ? 'Vozilo je zauzeto u ovom terminu (posle vraćanja 2 h za pripremu; rezervacija bez vremena zauzima cele dane):'
                    : 'Termin je u međuvremenu zauzet. Ova rezervacija nije aktivna, pa izmenu možeš sačuvati, ali je ne možeš ponovo aktivirati dok je termin zauzet:'}
                  <ul>
                    {availability.conflicts.map((c) => (
                      <li key={c.id}>
                        <Link to={`/rezervacije/${c.id}`} target="_blank" rel="noopener noreferrer">
                          {c.customer_name}
                        </Link>{' '}
                        — {formatDate(c.pickup_date)}
                        {c.pickup_time ? ` ${c.pickup_time.slice(0, 5)}` : ''} do {formatDate(c.return_date)}
                        {c.return_time ? ` ${c.return_time.slice(0, 5)}` : ''}
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
            {extraOptions().map((extra) => {
              const price = extraPrice(extra, vehicle);
              return (
                <label key={extra.id} className="admin-check">
                  <input type="checkbox" checked={form.extras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                  <span>{extra.name}</span>
                  <span className="admin-muted">{price ? `${price}€${extra.per === 'day' ? '/dan' : ''}` : 'besplatno'}</span>
                </label>
              );
            })}
          </fieldset>
          <div className="admin-form__grid">
            <Field label="Cena po danu (€)" error={errors.dailyRate} hint="Prazno = cena nije dogovorena.">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="10000"
                step="0.01"
                value={form.dailyRate}
                onChange={setPrice('dailyRate')}
              />
            </Field>
            <Field label="Dodaci ukupno (€)" error={errors.extrasTotal}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100000"
                step="0.01"
                value={form.extrasTotal}
                onChange={setPrice('extrasTotal')}
              />
            </Field>
          </div>

          <div className="admin-price-calc" aria-live="polite">
            {priced ? (
              <>
                <span>
                  Najam {days} × {formatMoney(form.dailyRate)} = {formatMoney(rentalCents / 100)}
                  {extrasCents > 0 && ` · dodaci ${formatMoney(extrasCents / 100)}`}
                </span>
                <strong>Ukupno {formatMoney((rentalCents + extrasCents) / 100)}</strong>
              </>
            ) : (
              <span className="admin-muted">
                {days > 0 ? 'Upiši cenu po danu — ukupan iznos se računa sam.' : 'Izaberi datume — iznos se računa sam.'}
              </span>
            )}
          </div>
          {unsplitTotal && (
            <p className="admin-muted admin-hint">
              Ranije unet iznos {formatMoney(original.total_price)} nema raspodelu na najam i dodatke. Upiši cenu po
              danu da bi rezervacija ušla u analitiku prihoda.
            </p>
          )}

          <div className="admin-suggestion">
            {suggestion ? (
              <>
                <span className="admin-muted">Po cenovniku:</span>
                <strong>{formatMoney(suggestion.total)}</strong>
                <span className="admin-muted">
                  {suggestion.days} × {formatMoney(suggestion.daily_rate)}
                  {suggestion.discount_percent > 0 && ` (popust ${suggestion.discount_percent}%)`}
                  {suggestion.extras_total > 0 && ` + dodaci ${formatMoney(suggestion.extras_total)}`}
                </span>
                {!matchesSuggestion && (
                  <button
                    type="button"
                    className="admin-link"
                    onClick={() => {
                      // Nova rezervacija: cena ponovo prati cenovnik (menja se sa datumima i dodacima).
                      if (!editing) setPriceTouched(false);
                      setForm((f) => ({
                        ...f,
                        dailyRate: String(suggestion.daily_rate),
                        extrasTotal: String(suggestion.extras_total),
                      }));
                      setErrors((prev) => ({ ...prev, dailyRate: undefined, extrasTotal: undefined }));
                    }}
                  >
                    Primeni cenovnik
                  </button>
                )}
              </>
            ) : (
              <span className="admin-muted">
                {!form.carId || days <= 0
                  ? 'Izaberi vozilo i datume za predlog cene.'
                  : quoteState === 'error'
                    ? 'Predlog cene trenutno nije dostupan — cenu upiši ručno.'
                    : quoteState === 'ready'
                      ? 'Vozilo nije u cenovniku — cenu upiši ručno.'
                      : 'Učitavam predlog cene…'}
              </span>
            )}
          </div>
          {editing && original?.daily_rate !== null && !matchesSuggestion && suggestion && (
            <p className="admin-muted admin-hint">
              Rezervacija zadržava cenu iz trenutka rezervacije. „Primeni cenovnik“ je menja na današnju cenu.
            </p>
          )}
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
