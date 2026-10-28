import { useI18n } from '../i18n';
import { isWorkingNow } from '../lib/contact';
import './HomeSections.css';

// "Prosečno vreme odgovora: manje od 3 minuta" — samo u radno vreme, kada to i važi.
export default function ResponseTime({ className = '' }) {
  const { t } = useI18n();
  if (!isWorkingNow()) return null;

  return (
    <p className={`response-time ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" strokeLinejoin="round" />
      </svg>
      {t.common.responseTime}
    </p>
  );
}
