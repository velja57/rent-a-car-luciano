import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { MAX_POWER } from '../data/fleet';
import { useI18n } from '../i18n';
import {
  discountPercent,
  formatEur,
  formatNumber,
  formatRsd,
  lowestRate,
  MAX_DISCOUNT_PERCENT,
  quote,
  tierLabel,
} from '../lib/pricing';
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

// car: originalni podaci (prevodi se ovde, za prikaz). availability: true/false
// kad je provera gotova, undefined kad nema datuma ili provera još traje (checking = true).
export default function FleetCard({ car: rawCar, index, total, dates, availability, checking, onReserve }) {
  const { lang, t, paths, localize } = useI18n();
  const car = localize(rawCar);
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
  const detailsHref = `${paths.vehicle(car.id)}${datesQuery(dates?.pickup, dates?.ret)}`;
  const [cover, hoverImage] = car.images;
  const specs = [
    { key: 'transmission', label: t.specs.transmission, value: car.transmission },
    { key: 'fuel', label: t.specs.fuel, value: car.fuel.split(' (')[0] },
    { key: 'seats', label: t.specs.seatsShort, value: car.seats },
    { key: 'trunk', label: t.specs.trunk, value: `${formatNumber(car.trunk, lang)} L` },
  ];

  return (
    <li
      ref={cardRef}
      className={`fleet-card${visible ? ' fleet-card--visible' : ''}${unavailable ? ' fleet-card--unavailable' : ''}`}
      style={{ '--delay': `${(index % 4) * 90}ms` }}
      onPointerMove={onPointerMove}
    >
      <Link className="fleet-card__media" to={detailsHref} aria-label={t.card.mediaLabel(car.name)}>
        <img
          className="fleet-card__img"
          src={cover.thumb}
          alt={`${car.name} — ${t.views[cover.view]}`}
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
        {car.recommended && <span className="fleet-card__ribbon">{t.common.recommended}</span>}
        {days > 0 && (checking || availability !== undefined) && (
          <span
            className={`fleet-card__status fleet-card__status--${checking ? 'checking' : unavailable ? 'busy' : 'free'}`}
          >
            {checking ? t.card.checking : unavailable ? t.card.busy : t.card.free}
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
          {car.engine} · {car.power} {t.powerUnit} · {t.year(car.year)}
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
          <span>{t.card.power}</span>
          <span className="fleet-card__meter-track" aria-hidden="true">
            <span
              className="fleet-card__meter-fill"
              style={{ '--fill': `${Math.round((car.power / MAX_POWER) * 100)}%` }}
            />
          </span>
          <span className="fleet-card__meter-value">
            {car.power} {t.powerUnit}
          </span>
        </div>

        <div className="fleet-card__footer">
          {period ? (
            <div className="fleet-card__price">
              <span className="fleet-card__price-label">
                {t.card.total(days, t.days(days))}
                {period.tier.discount > 0 && <span className="fleet-card__discount">−{discountPercent(period.tier)}%</span>}
              </span>
              <span className="fleet-card__price-main">
                <span className="fleet-card__price-value">{formatEur(period.total, lang)}</span>
                {period.savings > 0 && (
                  <s className="fleet-card__price-old">{formatEur(car.pricePerDay * days, lang)}</s>
                )}
              </span>
              <span className="fleet-card__price-sub">
                {formatEur(period.rate, lang)} {t.common.perDay} · ≈ {formatRsd(period.total, lang)}
              </span>
            </div>
          ) : (
            <div className="fleet-card__price">
              <span className="fleet-card__price-label">
                {t.card.from}
                <span className="fleet-card__discount">{t.card.upTo(MAX_DISCOUNT_PERCENT)}</span>
              </span>
              <span className="fleet-card__price-main">
                <span className="fleet-card__price-value">{formatEur(lowestRate(car), lang)}</span>
                <span className="fleet-card__price-unit">{t.common.perDay}</span>
              </span>
              <span className="fleet-card__price-sub">
                {t.card.baseFor(formatEur(car.pricePerDay, lang), tierLabel(0, t.days))} · ≈{' '}
                {formatRsd(car.pricePerDay, lang)}
              </span>
            </div>
          )}

          <p className={`fleet-card__deposit${car.deposit ? '' : ' fleet-card__deposit--none'}`}>
            {car.deposit ? t.common.deposit(formatEur(car.deposit, lang)) : `✓ ${t.common.noDeposit}`}
          </p>

          <div className="fleet-card__actions">
            <Link className="fleet-card__btn" to={detailsHref}>
              {t.card.details}
            </Link>
            <button
              type="button"
              className="fleet-card__btn fleet-card__btn--primary"
              disabled={unavailable}
              onClick={(e) => onReserve(rawCar, e.currentTarget)}
            >
              {unavailable ? t.card.busyButton : t.card.reserve}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
