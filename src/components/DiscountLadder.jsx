import { DISCOUNT_TIERS } from '../data/rental';
import { dailyRate, tierFor } from '../lib/pricing';

// Popusti po dužini najma; aktivni stepen se ističe kad su izabrani datumi.
// Sa car prop-om prikazuje i dnevnu cenu tog vozila za svaki stepen.
export default function DiscountLadder({ days, car }) {
  const active = days > 0 ? tierFor(days) : null;

  return (
    <ol className="discount-ladder">
      {DISCOUNT_TIERS.map((tier, i) => (
        <li
          key={tier.minDays}
          className={`discount-ladder__step${tier === active ? ' discount-ladder__step--active' : ''}`}
          style={{ '--level': i }}
        >
          <span className="discount-ladder__days">{tier.label}</span>
          <span className="discount-ladder__value">
            {tier.discount ? `−${Math.round(tier.discount * 100)}%` : 'Osnovna cena'}
          </span>
          {car && <span className="discount-ladder__price">{dailyRate(car, tier.minDays)}€ / dan</span>}
        </li>
      ))}
    </ol>
  );
}
