import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { formatDate, todayISO } from '../lib/pricing';
import './DateRangeFields.css';

// Datumi su ISO stringovi (YYYY-MM-DD) — računamo u UTC da vremenska zona ne pomera dan.
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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

// Zauzeti termini -> skup zauzetih dana (preuzimanje i vraćanje uključeni, kao u bazi).
function bookedDaySet(ranges) {
  const days = new Set();
  ranges.forEach(({ pickup_date: from, return_date: to }) => {
    for (let day = from; day <= to; day = addDays(day, 1)) days.add(day);
  });
  return days;
}

// Kalendar za izbor perioda najma. booked: zauzeti termini vozila — ti dani su
// precrtani i ne mogu se izabrati, a period ne sme da "preskoči" zauzet dan.
export default function DateRangeFields({ pickup, ret, onChange, booked = [] }) {
  const { lang, t } = useI18n();
  const c = t.calendar;
  const today = todayISO();
  const bookedDays = useMemo(() => bookedDaySet(booked), [booked]);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState('start');
  const [month, setMonth] = useState((pickup || today).slice(0, 7));
  const [hover, setHover] = useState(null);
  const [message, setMessage] = useState('');

  // Prvi zauzet dan posle izabranog preuzimanja — vraćanje mora biti pre njega.
  const returnLimit = useMemo(() => {
    if (!pickup || selecting !== 'end') return null;
    return [...bookedDays].filter((day) => day > pickup).sort()[0] ?? null;
  }, [bookedDays, pickup, selecting]);

  const openFor = (which) => {
    const target = which === 'end' && pickup ? 'end' : 'start';
    setSelecting(target);
    setMonth(((target === 'end' && ret) || pickup || today).slice(0, 7));
    setMessage(target === 'end' ? c.pickReturn : c.pickPickup);
    setOpen((wasOpen) => !(wasOpen && selecting === target));
  };

  const choose = (day) => {
    if (bookedDays.has(day)) {
      setMessage(c.bookedDay(formatDate(day, lang)));
      return;
    }
    if (selecting === 'start' || !pickup || day <= pickup) {
      onChange({ pickup: day, ret: '' });
      setSelecting('end');
      setMessage(c.pickReturn);
      return;
    }
    if (returnLimit && day >= returnLimit) {
      setMessage(c.bookedInRange(formatDate(returnLimit, lang)));
      return;
    }
    onChange({ pickup, ret: day });
    setOpen(false);
    setMessage('');
  };

  const rangeEnd = ret || (selecting === 'end' && hover && hover > pickup ? hover : null);

  return (
    <div className="date-range">
      <div className="date-range__fields">
        {[
          ['start', t.common.pickup, pickup],
          ['end', t.common.return, ret],
        ].map(([which, label, value]) => (
          <button
            key={which}
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
        ))}
      </div>

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
              const past = day < today;
              const isBooked = bookedDays.has(day);
              const blocked = !isBooked && Boolean(returnLimit) && day >= returnLimit;
              const isStart = day === pickup;
              const isEnd = day === ret;
              const inRange = pickup && rangeEnd && day > pickup && day < rangeEnd;
              const classes = [
                'date-calendar__day',
                isBooked && 'date-calendar__day--booked',
                blocked && 'date-calendar__day--blocked',
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
                  aria-disabled={isBooked || blocked || undefined}
                  aria-pressed={isStart || isEnd}
                  aria-label={`${formatDate(day, lang)}${isBooked ? ` — ${c.bookedLabel}` : ''}`}
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
          </div>
        </div>
      )}

      {open && message && (
        <p className="date-range__message" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
