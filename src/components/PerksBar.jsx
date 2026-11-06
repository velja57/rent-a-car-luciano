import { Link } from 'react-router';
import { useI18n } from '../i18n';
import { perkFacts } from '../lib/perks';
import PerkIcon from './PerkIcon';
import './HomeSections.css';

// Četiri glavne pogodnosti odmah ispod hero-a; "Sve pogodnosti" vodi na "Zašto Luciano".
export default function PerksBar() {
  const { t, paths } = useI18n();
  const items = t.perks.bar(perkFacts());

  return (
    <section className="perks-bar" aria-label={t.perks.label}>
      <div className="container perks-bar__inner">
        <ul className="perks-bar__list">
          {items.map((item) => (
            <li key={item.id}>
              <PerkIcon name={item.id} className="perks-bar__icon" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <Link className="perks-bar__more" to={{ pathname: paths.home, hash: '#zasto-mi' }}>
          {t.perks.all} →
        </Link>
      </div>
    </section>
  );
}
