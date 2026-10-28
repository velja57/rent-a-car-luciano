import { reviews } from '../data/reviews';
import { useI18n } from '../i18n';
import './HomeSections.css';

// Utisci klijenata. compact: bez velikog naslova (npr. na stranici vozila).
export default function Reviews({ compact = false }) {
  const { lang, t } = useI18n();
  const r = t.reviews;

  return (
    <section className={`reviews${compact ? ' reviews--compact' : ''}`} aria-labelledby="reviews-title">
      <div className={compact ? '' : 'container'}>
        <header className="reviews__head">
          {!compact && (
            <span className="fleet__eyebrow">
              <span className="fleet__pulse" />
              {r.eyebrow}
            </span>
          )}
          <h2 className={compact ? 'vehicle-section__title' : 'fleet__title'} id="reviews-title">
            {r.title[0]}
            <span>{r.title[1]}</span>
          </h2>
        </header>

        <ul className="reviews__grid">
          {reviews.map((review) => (
            <li className="review-card" key={review.name}>
              <svg className="review-card__quote" viewBox="0 0 32 32" aria-hidden="true">
                <path
                  d="M13 8C7.5 9.5 5 13.5 5 19v5h8v-8H9c0-3 1.5-5.2 4.5-6.2L13 8zm14 0c-5.5 1.5-8 5.5-8 11v5h8v-8h-4c0-3 1.5-5.2 4.5-6.2L27 8z"
                  fill="currentColor"
                />
              </svg>
              <blockquote className="review-card__text" lang={review.text[lang] ? lang : 'sr'}>
                {review.text[lang] ?? review.text.sr}
              </blockquote>
              <div className="review-card__author">
                <span className="review-card__avatar" aria-hidden="true">
                  {review.name[0]}
                </span>
                <span className="review-card__who">
                  <strong>{review.name}</strong>
                  <small>{review.city[lang] ?? review.city.sr}</small>
                </span>
              </div>
            </li>
          ))}
        </ul>

        {r.translatedNote && <p className="reviews__note">{r.translatedNote}</p>}
      </div>
    </section>
  );
}
