import { DISCOUNT_TIERS } from '../data/rental';
import { useI18n } from '../i18n';
import { dailyRate, discountPercent, formatEur, tierFor, tierLabel } from '../lib/pricing';

// Popusti po dužini najma; aktivni stepen se ističe kad su izabrani datumi.
// Sa car prop-om prikazuje i dnevnu cenu tog vozila za svaki stepen.
export default function DiscountLadder({ days, car }) {
  const { lang, t } = useI18n();
  const active = days > 0 ? tierFor(days) : null;

  return (
    <ol className="discount-ladder">
      {DISCOUNT_TIERS.map((tier, i) => (
        <li
          key={tier.minDays}
          className={`discount-ladder__step${tier === active ? ' discount-ladder__step--active' : ''}`}
          style={{ '--level': i }}
        >
          <span className="discount-ladder__days">{tierLabel(i, t.days)}</span>
          <span className="discount-ladder__value">{tier.discount ? `−${discountPercent(tier)}%` : t.ladder.base}</span>
          {car && (
            <span className="discount-ladder__price">
              {formatEur(dailyRate(car, tier.minDays), lang)} {t.common.perDay}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
