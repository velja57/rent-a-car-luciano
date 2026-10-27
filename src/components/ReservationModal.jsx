import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXTRAS, WHATSAPP_NUMBER } from '../data/rental';
import { depositLabel, formatDays, formatRsd, quote, rentalDays } from '../lib/pricing';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const DEFAULT_LOCATION = 'Kralja Mihaila Zetskog 44, Batajnica, Beograd';

// Koliko čekamo nakon poslednjeg unosa datuma pre nego što proverimo
// dostupnost u bazi (da ne pucamo zahtev na svaki pritisak tastera).
const AVAILABILITY_DEBOUNCE_MS = 450;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatExtraPrice(extra) {
  if (!extra.price) return 'Besplatno';
  return extra.per === 'day' ? `${extra.price}€ / dan` : `${extra.price}€`;
}

// initialPickup/initialReturn: datumi već izabrani na stranici vozila/flote.
export default function ReservationModal({ car, onClose, triggerRef, initialPickup = '', initialReturn = '' }) {
  const closeButtonRef = useRef(null);
  const firstFieldRef = useRef(null);
  const startDatesValid = initialPickup >= todayISO() && rentalDays(initialPickup, initialReturn) > 0;
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    pickupDate: startDatesValid ? initialPickup : '',
    returnDate: startDatesValid ? initialReturn : '',
    location: DEFAULT_LOCATION,
    note: '',
  });
  const [extraIds, setExtraIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [availability, setAvailability] = useState('idle'); // idle | checking | available | unavailable | error
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    (sent ? closeButtonRef : firstFieldRef).current?.focus();
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      triggerRef?.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (sent) closeButtonRef.current?.focus();
  }, [sent]);

  // Provera dostupnosti vozila za izabrani period — radi samo kad je
  // Supabase podešen i kad su oba datuma popunjena i u ispravnom redosledu.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { pickupDate, returnDate } = form;
    if (!pickupDate || !returnDate || returnDate <= pickupDate) {
      setAvailability('idle');
      return;
    }

    let cancelled = false;
    setAvailability('checking');
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_car_available', {
        p_car_id: car.id,
        p_pickup: pickupDate,
        p_return: returnDate,
      });
      if (cancelled) return;
      if (error) {
        setAvailability('error');
        return;
      }
      setAvailability(data ? 'available' : 'unavailable');
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.pickupDate, form.returnDate, car.id]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleExtra = (id) =>
    setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const days = rentalDays(form.pickupDate, form.returnDate);
  const priceQuote = days > 0 ? quote(car, days, extraIds) : null;

  // Dodaci i procenjena cena idu uz napomenu kupca (baza, admin, email vlasniku, WhatsApp).
  const summaryLines = priceQuote
    ? [
        priceQuote.extras.length > 0 && `Dodaci: ${priceQuote.extras.map((e) => e.label).join(', ')}`,
        `Procenjena cena: ${priceQuote.total}€ (${days} ${formatDays(days)} × ${priceQuote.rate}€${
          priceQuote.extrasTotal ? ` + dodaci ${priceQuote.extrasTotal}€` : ''
        })`,
      ].filter(Boolean)
    : [];

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Unesi ime i prezime.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Unesi ispravan email.';
    if (!/^[0-9+\s/()-]{6,}$/.test(form.phone)) next.phone = 'Unesi ispravan broj telefona.';

    if (!form.dob) {
      next.dob = 'Unesi datum rođenja.';
    } else {
      const age = calculateAge(form.dob);
      if (age === null) next.dob = 'Neispravan datum.';
      else if (age < car.minAge) next.dob = `Za ovo vozilo potreban je minimum ${car.minAge} godina.`;
    }

    if (!form.pickupDate) next.pickupDate = 'Izaberi datum preuzimanja.';
    else if (form.pickupDate < todayISO()) next.pickupDate = 'Datum ne može biti u prošlosti.';

    if (!form.returnDate) next.returnDate = 'Izaberi datum vraćanja.';
    else if (form.pickupDate && form.returnDate <= form.pickupDate) {
      next.returnDate = 'Datum vraćanja mora biti posle datuma preuzimanja.';
    }

    if (!form.location.trim()) next.location = 'Unesi lokaciju preuzimanja.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openWhatsApp = () => {
    const lines = [
      'Zdravo! Želim da rezervišem vozilo.',
      '',
      `Vozilo: ${car.name}`,
      `Ime i prezime: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      `Telefon: ${form.phone.trim()}`,
      `Datum rođenja: ${form.dob}`,
      `Preuzimanje: ${form.pickupDate}`,
      `Vraćanje: ${form.returnDate}`,
      `Lokacija preuzimanja: ${form.location.trim()}`,
    ];
    lines.push(...summaryLines);
    if (form.note.trim()) lines.push(`Napomena: ${form.note.trim()}`);

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Supabase nije podešen (vidi README_RESERVATIONS.md) — stari,
    // WhatsApp-only tok, bez baze/provere dostupnosti/email potvrde.
    if (!isSupabaseConfigured) {
      openWhatsApp();
      setSent(true);
      return;
    }

    if (availability === 'unavailable') {
      setErrors((prev) => ({
        ...prev,
        returnDate: 'Vozilo nije dostupno u izabranom periodu. Izaberi druge datume.',
      }));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase.rpc('create_reservation', {
      p_car_id: car.id,
      p_car_name: car.name,
      p_customer_name: form.name.trim(),
      p_email: form.email.trim(),
      p_phone: form.phone.trim(),
      p_dob: form.dob,
      p_pickup: form.pickupDate,
      p_return: form.returnDate,
      p_location: form.location.trim(),
      p_note: [form.note.trim(), ...summaryLines].filter(Boolean).join(' | '),
    });

    setSubmitting(false);

    if (error) {
      setSubmitError('Došlo je do greške prilikom slanja rezervacije. Pokušaj ponovo ili nas pozovi telefonom.');
      return;
    }

    if (!data?.success) {
      if (data?.reason === 'unavailable') {
        setAvailability('unavailable');
        setErrors((prev) => ({
          ...prev,
          returnDate: 'Vozilo nije dostupno u izabranom periodu. Izaberi druge datume.',
        }));
      } else {
        setSubmitError('Došlo je do greške prilikom slanja rezervacije. Pokušaj ponovo ili nas pozovi telefonom.');
      }
      return;
    }

    setSent(true);
  };

  // Portal u <body>: roditelj .car-form ima backdrop-filter/transform, što bi
  // fixed overlay zarobilo unutar kartice forme umesto preko celog ekrana.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
        <button type="button" className="modal__close" aria-label="Zatvori" onClick={onClose} ref={closeButtonRef}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        {sent ? (
          <div className="reservation-success">
            <h2 className="modal__title" id="reservation-title">
              {isSupabaseConfigured ? 'Rezervacija je poslata!' : 'Skoro gotovo!'}
            </h2>
            <p className="modal__description">
              {isSupabaseConfigured ? (
                <>
                  Rezervacija za vozilo <strong>{car.name}</strong> je zabeležena. Potvrda stiže na tvoj email, a
                  javićemo ti se uskoro i telefonom da potvrdimo sve detalje.
                </>
              ) : (
                <>
                  Otvorili smo WhatsApp sa popunjenom porukom za rezervaciju vozila <strong>{car.name}</strong>. Samo
                  je pošalji, i javićemo ti se u najkraćem roku da potvrdimo rezervaciju.
                </>
              )}
            </p>
            <div className="reservation-success__actions">
              {isSupabaseConfigured && (
                <button type="button" className="car-form__more" onClick={openWhatsApp}>
                  Pošalji i WhatsApp poruku
                </button>
              )}
              <button type="button" className="car-form__cta" onClick={onClose}>
                Zatvori
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="modal__eyebrow">Rezervacija</span>
            <h2 className="modal__title" id="reservation-title">
              {car.name}
            </h2>
            <p className="modal__description">
              {isSupabaseConfigured
                ? 'Popuni svoje podatke — proverićemo dostupnost vozila i odmah ti potvrditi rezervaciju.'
                : 'Popuni svoje podatke — poruka sa svim detaljima otvoriće se u WhatsAppu, spremna za slanje.'}
            </p>

            <form className="reservation-form" onSubmit={handleSubmit} noValidate>
              <label className="reservation-form__field">
                <span>Ime i prezime</span>
                <input ref={firstFieldRef} type="text" value={form.name} onChange={setField('name')} />
                {errors.name && <em className="reservation-form__error">{errors.name}</em>}
              </label>

              <div className="reservation-form__row">
                <label className="reservation-form__field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={setField('email')} />
                  {errors.email && <em className="reservation-form__error">{errors.email}</em>}
                </label>
                <label className="reservation-form__field">
                  <span>Broj telefona</span>
                  <input type="tel" value={form.phone} onChange={setField('phone')} />
                  {errors.phone && <em className="reservation-form__error">{errors.phone}</em>}
                </label>
              </div>

              <label className="reservation-form__field">
                <span>Datum rođenja</span>
                <input type="date" value={form.dob} onChange={setField('dob')} max={todayISO()} />
                {errors.dob && <em className="reservation-form__error">{errors.dob}</em>}
              </label>

              <label className="reservation-form__field">
                <span>Lokacija preuzimanja</span>
                <input type="text" value={form.location} onChange={setField('location')} />
                {errors.location && <em className="reservation-form__error">{errors.location}</em>}
              </label>

              <div className="reservation-form__row">
                <label className="reservation-form__field">
                  <span>Datum preuzimanja</span>
                  <input type="date" value={form.pickupDate} onChange={setField('pickupDate')} min={todayISO()} />
                  {errors.pickupDate && <em className="reservation-form__error">{errors.pickupDate}</em>}
                </label>
                <label className="reservation-form__field">
                  <span>Datum vraćanja</span>
                  <input
                    type="date"
                    value={form.returnDate}
                    onChange={setField('returnDate')}
                    min={form.pickupDate || todayISO()}
                  />
                  {errors.returnDate && <em className="reservation-form__error">{errors.returnDate}</em>}
                </label>
              </div>

              {isSupabaseConfigured && availability !== 'idle' && (
                <p
                  className={`reservation-form__availability reservation-form__availability--${availability}`}
                  aria-live="polite"
                >
                  {availability === 'checking' && 'Proveravamo dostupnost vozila…'}
                  {availability === 'available' && 'Vozilo je dostupno u izabranom periodu.'}
                  {availability === 'unavailable' && 'Vozilo nije dostupno u izabranom periodu. Izaberi druge datume.'}
                  {availability === 'error' && 'Ne možemo trenutno da proverimo dostupnost. Pokušaj ponovo malo kasnije.'}
                </p>
              )}

              <fieldset className="reservation-extras">
                <legend>Dodatne usluge (opciono)</legend>
                {EXTRAS.map((extra) => (
                  <label className="reservation-extras__item" key={extra.id}>
                    <input
                      type="checkbox"
                      checked={extraIds.includes(extra.id)}
                      onChange={() => toggleExtra(extra.id)}
                    />
                    <span className="reservation-extras__label">{extra.label}</span>
                    <span className="reservation-extras__price">{formatExtraPrice(extra)}</span>
                  </label>
                ))}
              </fieldset>

              {priceQuote && (
                <div className="reservation-summary" aria-live="polite">
                  <div className="reservation-summary__row">
                    <span>
                      Najam: {days} {formatDays(days)} × {priceQuote.rate}€
                      {priceQuote.tier.discount > 0 && (
                        <em className="reservation-summary__discount">
                          −{Math.round(priceQuote.tier.discount * 100)}%
                        </em>
                      )}
                    </span>
                    <span>{priceQuote.rental}€</span>
                  </div>
                  {priceQuote.extras.map((extra) => (
                    <div className="reservation-summary__row" key={extra.id}>
                      <span>
                        {extra.label}
                        {extra.per === 'day' && extra.price > 0 && ` (${days} × ${extra.price}€)`}
                      </span>
                      <span>{extra.cost ? `${extra.cost}€` : 'Besplatno'}</span>
                    </div>
                  ))}
                  <div className="reservation-summary__total">
                    <span>Ukupno</span>
                    <span>
                      <strong>{priceQuote.total}€</strong>
                      <small>≈ {formatRsd(priceQuote.total)}</small>
                    </span>
                  </div>
                  {priceQuote.savings > 0 && (
                    <p className="reservation-summary__note reservation-summary__note--save">
                      Ušteda zbog dužeg najma: {priceQuote.savings}€
                    </p>
                  )}
                  <p className="reservation-summary__note">Depozit: {depositLabel(car.deposit)}</p>
                </div>
              )}

              <label className="reservation-form__field">
                <span>Napomena (opciono)</span>
                <textarea rows={3} value={form.note} onChange={setField('note')} />
              </label>

              {submitError && <p className="reservation-form__error reservation-form__error--block">{submitError}</p>}

              <button
                type="submit"
                className="car-form__cta reservation-form__submit"
                disabled={isSupabaseConfigured && (submitting || availability === 'checking')}
              >
                {isSupabaseConfigured
                  ? submitting
                    ? 'Šaljem rezervaciju…'
                    : 'Rezerviši odmah'
                  : 'Pošalji rezervaciju preko WhatsAppa'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
