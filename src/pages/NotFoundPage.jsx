import { Link } from 'react-router';
import { useI18n } from '../i18n';
import { usePageMeta } from '../lib/usePageMeta';
import '../components/Fleet.css';

export default function NotFoundPage() {
  const { t, paths } = useI18n();
  usePageMeta(t.meta.notFoundTitle, t.meta.homeDescription);

  return (
    <div className="fleet not-found">
      <div className="fleet__bg" aria-hidden="true" />
      <div className="container fleet__inner not-found__inner">
        <span className="fleet__eyebrow">
          <span className="fleet__pulse" />
          {t.notFound.eyebrow}
        </span>
        <h1 className="fleet__title">
          {t.notFound.title[0]}
          <span>{t.notFound.title[1]}</span>
        </h1>
        <p className="fleet__subtitle">{t.notFound.text}</p>
        <div className="not-found__actions">
          <Link className="car-form__cta" to={paths.fleet}>
            {t.notFound.allCars}
          </Link>
          <Link className="car-form__more" to={paths.home}>
            {t.notFound.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
