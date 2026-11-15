import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { formatDate, todayISO } from '../lib/pricing';
import { blockedDays, isWorkday, pickupSlots } from '../lib/rentalTimes';
import './DateRangeFields.css';

// Datumi su ISO stringovi (YYYY-MM-DD) — računamo u UTC da vremenska zona ne pomera dan.
function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// Dani meseca (YYYY-MM) za mrežu koja počinje ponedeljkom; null = prazno polje.
function monthGrid(month) {
  const [y, m] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
}

// Kalendar za izbor perioda najma. booked: zauzeti termini vozila (datumi i
// vreme). Precrtani su dani kada se zbog tuđih termina ne može preuzeti (pri
// izboru preuzimanja), odnosno vratiti vozilo (pri izboru vraćanja); period ne
// sme da "preskoči" tuđu rezervaciju. Vikendom se preko sajta ne preuzima i ne
// vraća (samo uz dogovor telefonom). times: { start, end } — polja koja stoje uz
// datume (vreme preuzimanja/vraćanja). popover: kalendar se otvara preko sadržaja
// i zatvara klikom van njega ili na Escape.
export default function DateRangeFields({ pickup, ret, onChange, booked = [], times, popover = false }) {
  const { lang, t } = useI18n();
  const c = t.calendar;
  const today = todayISO();
  // Danas posle poslednjeg termina (20 h) preko sajta više nema preuzimanja.
  const todayClosed = isWorkday(today) && pickupSlots(today, []).length === 0;
  const { noPickup, noReturn } = useMemo(() => blockedDays(booked), [booked]);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState('start');
  const [month, setMonth] = useState((pickup || today).slice(0, 7));
  const [hover, setHover] = useState(null);
  const [message, setMessage] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!popover || !open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover, open]);

  // Početak prve tuđe rezervacije posle izabranog preuzimanja — vraćanje
  // najkasnije tog dana (i samo ako ostaje vremena pre njenog preuzimanja).
  const returnLimit = useMemo(() => {
    if (!pickup || selecting !== 'end') return null;
    return booked.map((r) => r.pickup_date).filter((day) => day > pickup).sort()[0] ?? null;
  }, [booked, pickup, selecting]);
  const choosingReturn = selecting === 'end' && Boolean(pickup);
  const bookedDays = choosingReturn ? noReturn : noPickup;

  const openFor = (which) => {
    const target = which === 'end' && pickup ? 'end' : 'start';
    setSelecting(target);
    setMonth(((target === 'end' && ret) || pickup || today).slice(0, 7));
    setMessage(target === 'end' ? c.pickReturn : c.pickPickup);
    setOpen((wasOpen) => !(wasOpen && selecting === target));
  };

  const choose = (day) => {
    if (!isWorkday(day)) {
      setMessage(c.offDay(formatDate(day, lang)));
      return;
    }
    if (selecting === 'start' || !pickup || day <= pickup) {
      if (noPickup.has(day)) {
        setMessage(c.bookedDay(formatDate(day, lang)));
        return;
      }
      onChange({ pickup: day, ret: '' });
      setSelecting('end');
      setMessage(c.pickReturn);
      return;
    }
    if (returnLimit && (day > returnLimit || noReturn.has(day))) {
      setMessage(c.bookedInRange(formatDate(returnLimit, lang)));
      return;
    }
    if (noReturn.has(day)) {
      setMessage(c.bookedDay(formatDate(day, lang)));
      return;
    }
    onChange({ pickup, ret: day });
    setOpen(false);
    setMessage('');
  };

  const rangeEnd = ret || (selecting === 'end' && hover && hover > pickup ? hover : null);

  const calendar = (
    <>
      {open && (
        <div className="date-calendar">
          <div className="date-calendar__head">
            <button
              type="button"
              className="date-calendar__nav"
              aria-label={c.prev}
              disabled={month <= today.slice(0, 7)}
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="date-calendar__month" aria-live="polite">
              {c.months[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
            </span>
            <button
              type="button"
              className="date-calendar__nav"
              aria-label={c.next}
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="date-calendar__grid" onMouseLeave={() => setHover(null)}>
            {c.weekdays.map((d) => (
              <span key={d} className="date-calendar__weekday">
                {d}
              </span>
            ))}
            {monthGrid(month).map((day, i) => {
              if (!day) return <span key={`blank-${i}`} />;
              const past = day < today || (day === today && todayClosed);
              const offDay = !isWorkday(day);
              const isBooked = !offDay && bookedDays.has(day);
              const blocked = !isBooked && !offDay && Boolean(returnLimit) && day > returnLimit;
              const isStart = day === pickup;
              const isEnd = day === ret;
              const inRange = pickup && rangeEnd && day > pickup && day < rangeEnd;
              const classes = [
                'date-calendar__day',
                isBooked && 'date-calendar__day--booked',
                blocked && 'date-calendar__day--blocked',
                offDay && 'date-calendar__day--offday',
                (isStart || isEnd) && 'date-calendar__day--selected',
                inRange && 'date-calendar__day--in-range',
                day === today && 'date-calendar__day--today',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={day}
                  type="button"
                  className={classes}
                  disabled={past}
                  aria-disabled={isBooked || blocked || offDay || undefined}
                  aria-pressed={isStart || isEnd}
                  aria-label={`${formatDate(day, lang)}${isBooked ? ` — ${c.bookedLabel}` : offDay ? ` — ${c.offDayLabel}` : ''}`}
                  onClick={() => choose(day)}
                  onMouseEnter={() => setHover(day)}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="date-calendar__legend" aria-hidden="true">
            <span>
              <i className="date-calendar__swatch date-calendar__swatch--selected" />
              {c.legendSelected}
            </span>
            {bookedDays.size > 0 && (
              <span>
                <i className="date-calendar__swatch date-calendar__swatch--booked" />
                {c.legendBooked}
              </span>
            )}
            <span>
              <i className="date-calendar__swatch date-calendar__swatch--offday" />
              {c.legendOffDay}
            </span>
          </div>
        </div>
      )}

      {open && message && (
        <p className="date-range__message" aria-live="polite">
          {message}
        </p>
      )}
    </>
  );

  return (
    <div ref={rootRef} className={`date-range${popover ? ' date-range--popover' : ''}${times ? ' date-range--times' : ''}`}>
      <div className="date-range__fields">
        {[
          ['start', t.common.pickup, pickup],
          ['end', t.common.return, ret],
        ].map(([which, label, value]) => (
          <Fragment key={which}>
            <button
              type="button"
              className={`date-range__field${open && selecting === which ? ' date-range__field--active' : ''}`}
              aria-expanded={open}
              onClick={() => openFor(which)}
            >
              <span className="date-range__label">{label}</span>
              <span className={`date-range__value${value ? '' : ' date-range__value--empty'}`}>
                {value ? formatDate(value, lang) : c.choose}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4 7h16v13H4zM4 11h16M9 4v5M15 4v5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {times?.[which]}
          </Fragment>
        ))}
      </div>

      {popover ? <div className="date-range__popup">{calendar}</div> : calendar}
    </div>
  );
}
