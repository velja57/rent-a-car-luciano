import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXTRAS, WHATSAPP_NUMBER } from '../data/rental';
import { dictionaries, useI18n } from '../i18n';
import { discountPercent, formatEur, formatRsd, quote, rentalDays } from '../lib/pricing';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

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

function formatExtraPrice(extra, t, lang) {
  if (!extra.price) return t.reservation.free;
  return extra.per === 'day' ? `${formatEur(extra.price, lang)} ${t.common.perDay}` : formatEur(extra.price, lang);
}

// Kratak opis cene ("7 dana × 45€ (−15%) = 315€ · Dečije sedište 21€ · Ukupno …")
// na traženom jeziku — za mejl kupcu, napomenu vlasniku i WhatsApp poruku.
function priceLine(t, lang, q) {
  return t.reservation.priceLine({
    days: q.days,
    daysWord: t.days(q.days),
    rate: formatEur(q.rate, lang),
    discount: discountPercent(q.tier),
    rental: formatEur(q.rental, lang),
    extras: q.extras.map((e) => `${t.extras[e.id]} ${e.cost ? formatEur(e.cost, lang) : t.reservation.free}`),
    total: formatEur(q.total, lang),
    rsd: formatRsd(q.total, lang),
  });
}

// initialPickup/initialReturn: datumi već izabrani na stranici vozila/flote.
export default function ReservationModal({ car, onClose, triggerRef, initialPickup = '', initialReturn = '' }) {
  const { lang, t } = useI18n();
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
    location: t.reservation.defaultLocation,
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

  const validate = () => {
    const e = t.reservation.errors;
    const next = {};
    if (!form.name.trim()) next.name = e.name;
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = e.email;
    if (!/^[0-9+\s/()-]{6,}$/.test(form.phone)) next.phone = e.phone;

    if (!form.dob) {
      next.dob = e.dob;
    } else {
      const age = calculateAge(form.dob);
      if (age === null) next.dob = e.dobInvalid;
      else if (age < car.minAge) next.dob = e.minAge(car.minAge);
    }

    if (!form.pickupDate) next.pickupDate = e.pickup;
    else if (form.pickupDate < todayISO()) next.pickupDate = e.pickupPast;

    if (!form.returnDate) next.returnDate = e.return;
    else if (form.pickupDate && form.returnDate <= form.pickupDate) {
      next.returnDate = e.returnOrder;
    }

    if (!form.location.trim()) next.location = e.location;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openWhatsApp = () => {
    const w = t.reservation.whatsapp;
    const lines = [
      w.greeting,
      '',
      `${w.car}: ${car.name}`,
      `${w.name}: ${form.name.trim()}`,
      `${w.email}: ${form.email.trim()}`,
      `${w.phone}: ${form.phone.trim()}`,
      `${w.dob}: ${form.dob}`,
      `${w.pickup}: ${form.pickupDate}`,
      `${w.return}: ${form.returnDate}`,
      `${w.location}: ${form.location.trim()}`,
    ];
    if (priceQuote) lines.push(`${w.price}: ${priceLine(t, lang, priceQuote)}`);
    if (form.note.trim()) lines.push(`${w.note}: ${form.note.trim()}`);

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
      setErrors((prev) => ({ ...prev, returnDate: t.reservation.errors.unavailable }));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Napomena za vlasnika (admin panel, mejl vlasniku) je uvek na srpskom.
    const sr = dictionaries.sr;
    const ownerNote = [
      form.note.trim(),
      priceQuote && `Procenjena cena: ${priceLine(sr, 'sr', priceQuote)}`,
      lang !== 'sr' && 'Jezik kupca: engleski',
    ]
      .filter(Boolean)
      .join(' | ');

    const params = {
      p_car_id: car.id,
      p_car_name: car.name,
      p_customer_name: form.name.trim(),
      p_email: form.email.trim(),
      p_phone: form.phone.trim(),
      p_dob: form.dob,
      p_pickup: form.pickupDate,
      p_return: form.returnDate,
      p_location: form.location.trim(),
      p_note: ownerNote,
    };
    // Jezik i opis cene idu u mejl potvrde kupcu (na njegovom jeziku).
    let { data, error } = await supabase.rpc('create_reservation', {
      ...params,
      p_language: lang,
      p_price_summary: priceQuote ? priceLine(t, lang, priceQuote) : null,
    });
    // Ako SQL izmena iz supabase/schema.sql još nije pokrenuta, funkcija ne zna
    // za nova polja (PGRST202) — rezervacija ide po starom, bez njih.
    if (error?.code === 'PGRST202') {
      ({ data, error } = await supabase.rpc('create_reservation', params));
    }

    setSubmitting(false);

    if (error) {
      setSubmitError(t.reservation.errors.submit);
      return;
    }

    if (!data?.success) {
      if (data?.reason === 'unavailable') {
        setAvailability('unavailable');
        setErrors((prev) => ({ ...prev, returnDate: t.reservation.errors.unavailable }));
      } else {
        setSubmitError(t.reservation.errors.submit);
      }
      return;
    }

    setSent(true);
  };

  const [successBefore, successAfter] = isSupabaseConfigured
    ? t.reservation.successText
    : t.reservation.successTextWhatsapp;

  // Portal u <body>: roditelj .car-form ima backdrop-filter/transform, što bi
  // fixed overlay zarobilo unutar kartice forme umesto preko celog ekrana.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
        <button
          type="button"
          className="modal__close"
          aria-label={t.common.close}
          onClick={onClose}
          ref={closeButtonRef}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        {sent ? (
          <div className="reservation-success">
            <h2 className="modal__title" id="reservation-title">
              {isSupabaseConfigured ? t.reservation.successTitle : t.reservation.successTitleWhatsapp}
            </h2>
            <p className="modal__description">
              {successBefore}
              <strong>{car.name}</strong>
              {successAfter}
            </p>
            <div className="reservation-success__actions">
              {isSupabaseConfigured && (
                <button type="button" className="car-form__more" onClick={openWhatsApp}>
                  {t.reservation.alsoWhatsapp}
                </button>
              )}
              <button type="button" className="car-form__cta" onClick={onClose}>
                {t.common.close}
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="modal__eyebrow">{t.reservation.eyebrow}</span>
            <h2 className="modal__title" id="reservation-title">
              {car.name}
            </h2>
            <p className="modal__description">
              {isSupabaseConfigured ? t.reservation.intro : t.reservation.introWhatsapp}
            </p>

            <form className="reservation-form" onSubmit={handleSubmit} noValidate>
              <label className="reservation-form__field">
                <span>{t.reservation.name}</span>
                <input ref={firstFieldRef} type="text" value={form.name} onChange={setField('name')} />
                {errors.name && <em className="reservation-form__error">{errors.name}</em>}
              </label>

              <div className="reservation-form__row">
                <label className="reservation-form__field">
                  <span>{t.reservation.email}</span>
                  <input type="email" value={form.email} onChange={setField('email')} />
                  {errors.email && <em className="reservation-form__error">{errors.email}</em>}
                </label>
                <label className="reservation-form__field">
                  <span>{t.reservation.phone}</span>
                  <input type="tel" value={form.phone} onChange={setField('phone')} />
                  {errors.phone && <em className="reservation-form__error">{errors.phone}</em>}
                </label>
              </div>

              <label className="reservation-form__field">
                <span>{t.reservation.dob}</span>
                <input type="date" value={form.dob} onChange={setField('dob')} max={todayISO()} />
                {errors.dob && <em className="reservation-form__error">{errors.dob}</em>}
              </label>

              <label className="reservation-form__field">
                <span>{t.reservation.location}</span>
                <input type="text" value={form.location} onChange={setField('location')} />
                {errors.location && <em className="reservation-form__error">{errors.location}</em>}
              </label>

              <div className="reservation-form__row">
                <label className="reservation-form__field">
                  <span>{t.reservation.pickupDate}</span>
                  <input type="date" value={form.pickupDate} onChange={setField('pickupDate')} min={todayISO()} />
                  {errors.pickupDate && <em className="reservation-form__error">{errors.pickupDate}</em>}
                </label>
                <label className="reservation-form__field">
                  <span>{t.reservation.returnDate}</span>
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
                  {t.reservation.availability[availability]}
                </p>
              )}

              <fieldset className="reservation-extras">
                <legend>{t.reservation.extras}</legend>
                {EXTRAS.map((extra) => (
                  <label className="reservation-extras__item" key={extra.id}>
                    <input
                      type="checkbox"
                      checked={extraIds.includes(extra.id)}
                      onChange={() => toggleExtra(extra.id)}
                    />
                    <span className="reservation-extras__label">{t.extras[extra.id]}</span>
                    <span className="reservation-extras__price">{formatExtraPrice(extra, t, lang)}</span>
                  </label>
                ))}
              </fieldset>

              {priceQuote && (
                <div className="reservation-summary" aria-live="polite">
                  <div className="reservation-summary__row">
                    <span>
                      {t.reservation.summaryRental(days, t.days(days), formatEur(priceQuote.rate, lang))}
                      {priceQuote.tier.discount > 0 && (
                        <em className="reservation-summary__discount">−{discountPercent(priceQuote.tier)}%</em>
                      )}
                    </span>
                    <span>{formatEur(priceQuote.rental, lang)}</span>
                  </div>
                  {priceQuote.extras.map((extra) => (
                    <div className="reservation-summary__row" key={extra.id}>
                      <span>
                        {t.extras[extra.id]}
                        {extra.per === 'day' && extra.price > 0 && ` (${days} × ${formatEur(extra.price, lang)})`}
                      </span>
                      <span>{extra.cost ? formatEur(extra.cost, lang) : t.reservation.free}</span>
                    </div>
                  ))}
                  <div className="reservation-summary__total">
                    <span>{t.reservation.summaryTotal}</span>
                    <span>
                      <strong>{formatEur(priceQuote.total, lang)}</strong>
                      <small>≈ {formatRsd(priceQuote.total, lang)}</small>
                    </span>
                  </div>
                  {priceQuote.savings > 0 && (
                    <p className="reservation-summary__note reservation-summary__note--save">
                      {t.reservation.summarySavings(formatEur(priceQuote.savings, lang))}
                    </p>
                  )}
                  <p className="reservation-summary__note">
                    {t.reservation.summaryDeposit(car.deposit ? formatEur(car.deposit, lang) : t.common.noDeposit)}
                  </p>
                </div>
              )}

              <label className="reservation-form__field">
                <span>{t.reservation.note}</span>
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
                    ? t.reservation.sending
                    : t.common.reserveNow
                  : t.reservation.sendWhatsapp}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
