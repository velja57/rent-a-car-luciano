import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXTRAS, PHONE_DISPLAY, PHONE_HREF } from '../data/rental';
import { dictionaries, useI18n } from '../i18n';
import { bookingMessage, priceLine, questionMessage, whatsappUrl } from '../lib/contact';
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

function openInNewTab(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

const ICONS = {
  online: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" strokeLinejoin="round" />,
  direct: (
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

// Dva kanala rezervacije: "online" (forma -> baza + mejl potvrda) i "direct"
// (bez forme: gotova WhatsApp poruka ili poziv). initialPickup/initialReturn:
// datumi već izabrani na stranici vozila/flote.
export default function ReservationModal({ car, onClose, triggerRef, initialPickup = '', initialReturn = '' }) {
  const { lang, t } = useI18n();
  const r = t.reservation;
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
    location: r.defaultLocation,
    note: '',
  });
  // Bez Supabase-a online rezervacija ne može da se sačuva — ostaje samo WhatsApp/poziv.
  const [channel, setChannel] = useState(isSupabaseConfigured ? 'online' : 'direct');
  const [editingLocation, setEditingLocation] = useState(false);
  const [extraIds, setExtraIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [availability, setAvailability] = useState('idle'); // idle | checking | available | unavailable | error
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    (firstFieldRef.current ?? closeButtonRef.current)?.focus();
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
    const e = r.errors;
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

    if (!form.location.trim()) {
      next.location = e.location;
      setEditingLocation(true);
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Kanal "WhatsApp ili poziv": kratka gotova poruka, bez forme.
  const openBookingWhatsApp = () => {
    openInNewTab(
      whatsappUrl(bookingMessage({ t, lang, car, pickup: form.pickupDate, ret: form.returnDate, extraIds })),
    );
    setWhatsappOpened(true);
  };

  // Pun opis online rezervacije — posle uspešnog slanja ili ako slanje ne uspe.
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !validate()) return;

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

  const summary = priceQuote && (
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
  );

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

            {isSupabaseConfigured && (
              <div className="booking-channels" role="tablist" aria-label={r.channelsLabel}>
                {['online', 'direct'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`booking-tab-${id}`}
                    aria-selected={channel === id}
                    aria-controls={`booking-panel-${id}`}
                    className={`booking-channel${channel === id ? ' booking-channel--active' : ''}`}
                    onClick={() => setChannel(id)}
                  >
                    <Icon name={id} />
                    <span className="booking-channel__text">
                      <span className="booking-channel__title">{r.channels[id]}</span>
                      <span className="booking-channel__hint">{r.channels[`${id}Hint`]}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="modal__description">{channel === 'online' ? r.onlineIntro : r.directIntro}</p>

            <div
              className="booking-panel"
              role={isSupabaseConfigured ? 'tabpanel' : undefined}
              id={`booking-panel-${channel}`}
              aria-labelledby={isSupabaseConfigured ? `booking-tab-${channel}` : undefined}
            >
              {channel === 'direct' && <p className="booking-hint">{r.datesOptional}</p>}
              <div className="reservation-form__row booking-dates">
                <label className="reservation-form__field">
                  <span>{r.pickupDate}</span>
                  <input type="date" value={form.pickupDate} onChange={setField('pickupDate')} min={todayISO()} />
                  {errors.pickupDate && <em className="reservation-form__error">{errors.pickupDate}</em>}
                </label>
                <label className="reservation-form__field">
                  <span>{r.returnDate}</span>
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
                  {r.availability[availability]}
                </p>
              )}

              {channel === 'online' ? (
                <form className="reservation-form booking-form" onSubmit={handleSubmit} noValidate>
                  <label className="reservation-form__field">
                    <span>{r.name}</span>
                    <input
                      ref={firstFieldRef}
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={setField('name')}
                    />
                    {errors.name && <em className="reservation-form__error">{errors.name}</em>}
                  </label>

                  <div className="reservation-form__row">
                    <label className="reservation-form__field">
                      <span>{r.phone}</span>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={setField('phone')}
                      />
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
                    <input
                      type="date"
                      autoComplete="bday"
                      value={form.dob}
                      onChange={setField('dob')}
                      max={todayISO()}
                    />
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

                  {summary}

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
                    {submitting
                      ? r.sending
                      : priceQuote
                        ? r.submitWithTotal(formatEur(priceQuote.total, lang))
                        : r.submit}
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
              ) : (
                <div className="booking-direct">
                  {summary}

                  <button
                    type="button"
                    className="booking-direct__btn booking-direct__btn--whatsapp"
                    onClick={openBookingWhatsApp}
                  >
                    <Icon name="direct" />
                    <span>
                      <strong>{r.whatsappBook}</strong>
                      <small>{r.whatsappBookHint}</small>
                    </span>
                  </button>
                  <a className="booking-direct__btn booking-direct__btn--call" href={PHONE_HREF}>
                    <Icon name="phone" />
                    <span>
                      <strong>{t.common.call(PHONE_DISPLAY)}</strong>
                      <small>{r.callHint}</small>
                    </span>
                  </a>

                  {whatsappOpened && (
                    <p className="booking-direct__notice" aria-live="polite">
                      {r.whatsappOpened}
                    </p>
                  )}

                  <button
                    type="button"
                    className="booking-link booking-direct__question"
                    onClick={() => openInNewTab(whatsappUrl(questionMessage(t, car)))}
                  >
                    {r.askQuestion}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
