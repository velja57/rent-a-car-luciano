import { Link } from 'react-router';
import { usePageMeta } from '../lib/usePageMeta';
import '../components/Fleet.css';

export default function NotFoundPage() {
  usePageMeta('Stranica nije pronađena — Luciano Rent a Car');

  return (
    <div className="fleet not-found">
      <div className="fleet__bg" aria-hidden="true" />
      <div className="container fleet__inner not-found__inner">
        <span className="fleet__eyebrow">
          <span className="fleet__pulse" />
          Greška 404
        </span>
        <h1 className="fleet__title">
          Ova stranica <span>ne postoji</span>
        </h1>
        <p className="fleet__subtitle">Možda je vozilo uklonjeno iz ponude ili je adresa pogrešno upisana.</p>
        <div className="not-found__actions">
          <Link className="car-form__cta" to="/vozila">
            Pogledaj sva vozila
          </Link>
          <Link className="car-form__more" to="/">
            Početna strana
          </Link>
        </div>
      </div>
    </div>
  );
}
