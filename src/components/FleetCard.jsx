import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fuelKind, MAX_POWER } from '../data/fleet';
import { depositLabel, formatDays, formatRsd, lowestRate, MAX_DISCOUNT_PERCENT, quote } from '../lib/pricing';
import { datesQuery } from '../lib/useRentalDates';

const SPEC_ICONS = {
  transmission: <path d="M6 5v14M12 5v14M18 5v7H6" strokeLinecap="round" strokeLinejoin="round" />,
  fuel: (
    <path
      d="M4 20V5a1 1 0 011-1h8a1 1 0 011 1v15M3 20h12M14 9h2.5a1.5 1.5 0 011.5 1.5V16a1.5 1.5 0 003 0V8l-3-3M7 8h4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  seats: (
    <path
      d="M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.87M16 4.13a3 3 0 010 5.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  trunk: <path d="M5 8h14v11H5zM9 8V5h6v3M9 12v3M15 12v3" strokeLinecap="round" strokeLinejoin="round" />,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

// availability: true/false kad je provera gotova, undefined kad nema datuma
// ili provera još traje (checking = true).
export default function FleetCard({ car, index, total, dates, availability, checking, onReserve }) {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pozicija "reflektora" koji prati kursor preko kartice (CSS --mx/--my),
  // bez re-rendera.
  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const days = dates?.days ?? 0;
  const period = days > 0 ? quote(car, days) : null;
  const unavailable = availability === false;
  const detailsHref = `/vozila/${car.id}${datesQuery(dates?.pickup, dates?.ret)}`;
  const [cover, hoverImage] = car.images;
  const specs = [
    { key: 'transmission', label: 'Menjač', value: car.transmission },
    { key: 'fuel', label: 'Gorivo', value: fuelKind(car) },
    { key: 'seats', label: 'Sedišta', value: car.seats },
    { key: 'trunk', label: 'Prtljažnik', value: `${car.trunk.toLocaleString('sr-RS')} L` },
  ];

  return (
    <li
      ref={cardRef}
      className={`fleet-card${visible ? ' fleet-card--visible' : ''}${unavailable ? ' fleet-card--unavailable' : ''}`}
      style={{ '--delay': `${(index % 4) * 90}ms` }}
      onPointerMove={onPointerMove}
    >
      <Link className="fleet-card__media" to={detailsHref} aria-label={`${car.name} — fotografije i detalji`}>
        <img
          className="fleet-card__img"
          src={cover.thumb}
          alt={cover.alt}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: cover.focus }}
        />
        {hoverImage && (
          <img
            className="fleet-card__img fleet-card__img--alt"
            src={hoverImage.thumb}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ objectPosition: hoverImage.focus }}
          />
        )}
        <span className="fleet-card__category">{car.category}</span>
        {car.recommended && <span className="fleet-card__ribbon">★ Preporuka</span>}
        {days > 0 && (checking || availability !== undefined) && (
          <span
            className={`fleet-card__status fleet-card__status--${checking ? 'checking' : unavailable ? 'busy' : 'free'}`}
          >
            {checking ? 'Proveravamo…' : unavailable ? 'Zauzeto u tom periodu' : 'Slobodno za tvoje datume'}
          </span>
        )}
        <span className="fleet-card__photos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" strokeLinejoin="round" />
          </svg>
          {car.images.length}
        </span>
      </Link>

      <div className="fleet-card__body">
        <span className="fleet-card__index">
          {pad(index + 1)} / {pad(total)}
        </span>
        <h3 className="fleet-card__name">
          <Link to={detailsHref}>{car.name}</Link>
        </h3>
        <p className="fleet-card__engine">
          {car.engine} · {car.power} KS · {car.year}.
        </p>

        <ul className="fleet-card__specs">
          {specs.map((spec) => (
            <li className="fleet-card__spec" key={spec.key}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                {SPEC_ICONS[spec.key]}
              </svg>
              <span className="fleet-card__spec-text">
                <span className="fleet-card__spec-label">{spec.label}</span>
                <span className="fleet-card__spec-value">{spec.value}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="fleet-card__meter">
          <span>Snaga</span>
          <span className="fleet-card__meter-track" aria-hidden="true">
            <span
              className="fleet-card__meter-fill"
              style={{ '--fill': `${Math.round((car.power / MAX_POWER) * 100)}%` }}
            />
          </span>
          <span className="fleet-card__meter-value">{car.power} KS</span>
        </div>

        <div className="fleet-card__footer">
          {period ? (
            <div className="fleet-card__price">
              <span className="fleet-card__price-label">
                Ukupno · {days} {formatDays(days)}
                {period.tier.discount > 0 && (
                  <span className="fleet-card__discount">−{Math.round(period.tier.discount * 100)}%</span>
                )}
              </span>
              <span className="fleet-card__price-main">
                <span className="fleet-card__price-value">{period.total}€</span>
                {period.savings > 0 && <s className="fleet-card__price-old">{car.pricePerDay * days}€</s>}
              </span>
              <span className="fleet-card__price-sub">
                {period.rate}€ / dan · ≈ {formatRsd(period.total)}
              </span>
            </div>
          ) : (
            <div className="fleet-card__price">
              <span className="fleet-card__price-label">
                Već od
                <span className="fleet-card__discount">do −{MAX_DISCOUNT_PERCENT}%</span>
              </span>
              <span className="fleet-card__price-main">
                <span className="fleet-card__price-value">{lowestRate(car)}€</span>
                <span className="fleet-card__price-unit">/ dan</span>
              </span>
              <span className="fleet-card__price-sub">
                {car.pricePerDay}€ za 1–2 dana · ≈ {formatRsd(car.pricePerDay)}
              </span>
            </div>
          )}

          <p className={`fleet-card__deposit${car.deposit ? '' : ' fleet-card__deposit--none'}`}>
            {car.deposit ? `Depozit ${depositLabel(car.deposit)}` : '✓ Bez depozita'}
          </p>

          <div className="fleet-card__actions">
            <Link className="fleet-card__btn" to={detailsHref}>
              Detalji
            </Link>
            <button
              type="button"
              className="fleet-card__btn fleet-card__btn--primary"
              disabled={unavailable}
              onClick={(e) => onReserve(car, e.currentTarget)}
            >
              {unavailable ? 'Zauzeto' : 'Rezerviši'}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
