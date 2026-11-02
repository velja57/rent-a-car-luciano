import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXTRAS, PHONE_DISPLAY, PHONE_HREF } from '../data/rental';
import { dictionaries, useI18n } from '../i18n';
import { bookingMessage, isWorkingNow, priceLine, questionMessage, whatsappUrl } from '../lib/contact';
import { discountPercent, formatEur, formatRsd, quote, rentalDays } from '../lib/pricing';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { useBookedDates } from '../lib/useBookedDates';
import { useCallNotice } from '../lib/useCallNotice';
import CallNotice from './CallNotice';
import DateRangeFields from './DateRangeFields';

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

function openInNewTab(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

const ICONS = {
  whatsapp: (
    <path
      d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1120 12zM9 10.5h6M9 13.5h4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  phone: (
    <path
      d="M5 4h3.5l1.5 4-2 1.5a11 11 0 005.5 5.5l1.5-2 4 1.5V18a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"
      strokeLinejoin="round"
    />
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Tri načina rezervacije, po važnosti: (1) online forma -> baza + mejl vlasniku
// i potvrda kupcu, (2) gotova WhatsApp poruka, (3) poziv. initialPickup /
// initialReturn: datumi već izabrani na stranici vozila/flote.
export default function ReservationModal({ car, onClose, triggerRef, initialPickup = '', initialReturn = '' }) {
  const { lang, t } = useI18n();
  const r = t.reservation;
  const closeButtonRef = useRef(null);
  const firstFieldRef = useRef(null);
  const alternativesRef = useRef(null);
  const bookedRanges = useBookedDates(car.id);
  const startDatesValid = initialPickup >= todayISO() && rentalDays(initialPickup, initialReturn) > 0;
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    pickupDate: startDatesValid ? initialPickup : '',
    returnDate: startDatesValid ? initialReturn : '',
    location: r.defaultLocation,
    note: '',
  });
  const [editingLocation, setEditingLocation] = useState(false);
  const [extraIds, setExtraIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const { showCallNotice, handleCallClick, handleMouseLeave } = useCallNotice();
  const [availability, setAvailability] = useState('idle'); // idle | checking | available | unavailable | error
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const workingNow = isWorkingNow();

  useEffect(() => {
    firstFieldRef.current?.focus();
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

  const setDates = ({ pickup, ret }) => {
    setForm((f) => ({ ...f, pickupDate: pickup, returnDate: ret }));
    setErrors((prev) => ({ ...prev, pickupDate: undefined, returnDate: undefined }));
  };

  const toggleExtra = (id) =>
    setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const days = rentalDays(form.pickupDate, form.returnDate);
  const priceQuote = days > 0 ? quote(car, days, extraIds) : null;

  const validate = () => {
    const e = r.errors;
    const next = {};
    if (!form.name.trim()) next.name = e.name;
    if (!/^[0-9+\s/()-]{6,}$/.test(form.phone)) next.phone = e.phone;
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = e.email;

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

    if (!form.location.trim()) {
      next.location = e.location;
      setEditingLocation(true);
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // (2) WhatsApp: kratka gotova poruka sa vozilom, datumima i cenom.
  const openBookingWhatsApp = () => {
    openInNewTab(
      whatsappUrl(bookingMessage({ t, lang, car, pickup: form.pickupDate, ret: form.returnDate, extraIds })),
    );
    setWhatsappOpened(true);
  };

  // Pun opis rezervacije iz forme — posle slanja, ako slanje ne uspe, ili kad
  // sajt nije povezan sa bazom (tada forma ide preko WhatsApp-a).
  const openFullWhatsApp = () => {
    const w = r.whatsapp;
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
    openInNewTab(whatsappUrl(lines.join('\n')));
    setWhatsappOpened(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Sajt nije povezan sa bazom (npr. preview bez Supabase podešavanja) —
    // rezervacija iz forme ide preko WhatsApp-a, da kupac ne ostane bez odgovora.
    if (!isSupabaseConfigured) {
      openFullWhatsApp();
      return;
    }

    if (availability === 'unavailable') {
      setErrors((prev) => ({ ...prev, returnDate: r.errors.unavailable }));
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
    // Jezik i opis cene idu u mejl potvrde kupcu (na njegovom jeziku). Iznos koji
    // je kupac video u formi i izabrani dodaci se upisuju i kao podaci — admin
    // panel ih prikazuje i sabira u finansijama (admin ih može izmeniti).
    let { data, error } = await supabase.rpc('create_reservation', {
      ...params,
      p_language: lang,
      p_price_summary: priceQuote ? priceLine(t, lang, priceQuote) : null,
      p_total_price: priceQuote ? priceQuote.total : null,
      p_extras: extraIds.length > 0 ? extraIds : null,
    });
    // Ako SQL izmena iz supabase/schema.sql još nije pokrenuta, funkcija ne zna
    // za nova polja (PGRST202) — rezervacija ide po starom, bez njih.
    if (error?.code === 'PGRST202') {
      ({ data, error } = await supabase.rpc('create_reservation', params));
    }

    setSubmitting(false);

    if (error) {
      setSubmitError(r.errors.submit);
      return;
    }

    if (!data?.success) {
      if (data?.reason === 'unavailable') {
        setAvailability('unavailable');
        setErrors((prev) => ({ ...prev, returnDate: r.errors.unavailable }));
      } else {
        setSubmitError(r.errors.submit);
      }
      return;
    }

    setSent(true);
  };

  const submitLabel = !isSupabaseConfigured
    ? r.fallbackWhatsapp
    : submitting
      ? r.sending
      : priceQuote
        ? r.submitWithTotal(formatEur(priceQuote.total, lang))
        : r.submit;

  // Portal u <body>: roditelj .car-form ima backdrop-filter/transform, što bi
  // fixed overlay zarobilo unutar kartice forme umesto preko celog ekrana.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
        <button type="button" className="modal__close" aria-label={t.common.close} onClick={onClose} ref={closeButtonRef}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        {sent ? (
          <div className="reservation-success">
            <h2 className="modal__title" id="reservation-title">
              {r.successTitle}
            </h2>
            <p className="modal__description">
              {r.successText[0]}
              <strong>{car.name}</strong>
              {r.successText[1]}
            </p>
            <div className="reservation-success__actions">
              <button type="button" className="car-form__more" onClick={openFullWhatsApp}>
                {r.alsoWhatsapp}
              </button>
              <button type="button" className="car-form__cta" onClick={onClose}>
                {t.common.close}
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="modal__eyebrow">{r.eyebrow}</span>
            <h2 className="modal__title" id="reservation-title">
              {car.name}
            </h2>

            {/* (1) Glavna opcija: online rezervacija */}
            <div className="booking-main-head">
              <span className="booking-main-head__title">{r.onlineTitle}</span>
              <span className="booking-main-head__badge">{r.onlineBadge}</span>
            </div>
            <p className="modal__description booking-intro">{r.onlineIntro}</p>
            <button
              type="button"
              className="booking-link booking-jump"
              onClick={() => alternativesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {r.altJump} ↓
            </button>

            <form className="reservation-form booking-form" onSubmit={handleSubmit} noValidate>
              <div className="reservation-form__field">
                <DateRangeFields
                  pickup={form.pickupDate}
                  ret={form.returnDate}
                  onChange={setDates}
                  booked={bookedRanges}
                />
                {(errors.pickupDate || errors.returnDate) && (
                  <em className="reservation-form__error">{errors.pickupDate ?? errors.returnDate}</em>
                )}
              </div>

              {isSupabaseConfigured && availability !== 'idle' && (
                <p
                  className={`reservation-form__availability reservation-form__availability--${availability}`}
                  aria-live="polite"
                >
                  {r.availability[availability]}
                </p>
              )}

              <label className="reservation-form__field">
                <span>{r.name}</span>
                <input ref={firstFieldRef} type="text" autoComplete="name" value={form.name} onChange={setField('name')} />
                {errors.name && <em className="reservation-form__error">{errors.name}</em>}
              </label>

              <div className="reservation-form__row">
                <label className="reservation-form__field">
                  <span>{r.phone}</span>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={setField('phone')} />
                  {errors.phone && <em className="reservation-form__error">{errors.phone}</em>}
                </label>
                <label className="reservation-form__field">
                  <span>{r.email}</span>
                  <input type="email" autoComplete="email" value={form.email} onChange={setField('email')} />
                  {errors.email && <em className="reservation-form__error">{errors.email}</em>}
                </label>
              </div>

              <label className="reservation-form__field">
                <span>{r.dob}</span>
                <input type="date" autoComplete="bday" value={form.dob} onChange={setField('dob')} max={todayISO()} />
                {errors.dob && <em className="reservation-form__error">{errors.dob}</em>}
              </label>

              {editingLocation ? (
                <label className="reservation-form__field">
                  <span>{r.location}</span>
                  <input type="text" value={form.location} onChange={setField('location')} />
                  {errors.location && <em className="reservation-form__error">{errors.location}</em>}
                </label>
              ) : (
                <div className="booking-location">
                  <span className="booking-location__label">{r.location}</span>
                  <span className="booking-location__value">{form.location}</span>
                  <button type="button" className="booking-link" onClick={() => setEditingLocation(true)}>
                    {r.changeLocation}
                  </button>
                </div>
              )}

              <details className="booking-more">
                <summary>
                  {r.more}
                  {extraIds.length > 0 && <span className="booking-more__count">{extraIds.length}</span>}
                </summary>
                <fieldset className="reservation-extras">
                  <legend>{r.extras}</legend>
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
                <label className="reservation-form__field">
                  <span>{r.note}</span>
                  <textarea rows={3} value={form.note} onChange={setField('note')} />
                </label>
              </details>

              {priceQuote && (
                <div className="reservation-summary" aria-live="polite">
                  <div className="reservation-summary__row">
                    <span>
                      {r.summaryRental(days, t.days(days), formatEur(priceQuote.rate, lang))}
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
                      <span>{extra.cost ? formatEur(extra.cost, lang) : r.free}</span>
                    </div>
                  ))}
                  <div className="reservation-summary__total">
                    <span>{r.summaryTotal}</span>
                    <span>
                      <strong>{formatEur(priceQuote.total, lang)}</strong>
                      <small>≈ {formatRsd(priceQuote.total, lang)}</small>
                    </span>
                  </div>
                  {priceQuote.savings > 0 && (
                    <p className="reservation-summary__note reservation-summary__note--save">
                      {r.summarySavings(formatEur(priceQuote.savings, lang))}
                    </p>
                  )}
                  <p className="reservation-summary__note">
                    {r.summaryDeposit(car.deposit ? formatEur(car.deposit, lang) : t.common.noDeposit)}
                  </p>
                </div>
              )}

              {submitError && (
                <div className="booking-error">
                  <p className="reservation-form__error reservation-form__error--block">{submitError}</p>
                  <button type="button" className="car-form__more" onClick={openFullWhatsApp}>
                    {r.fallbackWhatsapp}
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="car-form__cta reservation-form__submit"
                disabled={submitting || availability === 'checking'}
              >
                {submitLabel}
              </button>

              <ul className="booking-trust">
                {r.trust.map((item) => (
                  <li key={item}>
                    <Icon name="check" />
                    {item}
                  </li>
                ))}
              </ul>
            </form>

            {/* (2) WhatsApp i (3) poziv */}
            <div className="booking-alt" ref={alternativesRef}>
              <div className="booking-alt__divider">
                <span>{r.altDivider}</span>
              </div>

              <button
                type="button"
                className="booking-direct__btn booking-direct__btn--whatsapp"
                onClick={openBookingWhatsApp}
              >
                <Icon name="whatsapp" />
                <span>
                  <strong>{r.whatsappBook}</strong>
                  <small>{r.whatsappBookHint}</small>
                </span>
              </button>

              {whatsappOpened && (
                <p className="booking-direct__notice" aria-live="polite">
                  {r.whatsappOpened}
                </p>
              )}

              <div className="booking-call-wrap" onMouseLeave={handleMouseLeave}>
                <a className="booking-call" href={PHONE_HREF} onClick={handleCallClick}>
                  <span className={`booking-call__status${workingNow ? ' booking-call__status--open' : ''}`}>
                    <i aria-hidden="true" />
                    {workingNow ? r.callOpen : r.callClosed}
                  </span>
                  <span className="booking-call__main">
                    <span className="booking-call__icon">
                      <Icon name="phone" />
                    </span>
                    <span className="booking-call__text">
                      <strong>{r.callTitle}</strong>
                      <span className="booking-call__number">{PHONE_DISPLAY}</span>
                    </span>
                  </span>
                  <small className="booking-call__hint">
                    {r.callText} {r.callHint}
                  </small>
                </a>

                {showCallNotice && <CallNotice />}
              </div>

              <button
                type="button"
                className="booking-link booking-direct__question"
                onClick={() => openInNewTab(whatsappUrl(questionMessage(t, car)))}
              >
                {r.askQuestion}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
