import { useI18n } from '../i18n';

// Poruka koja se prikazuje umesto poziva kad se "Pozovi nas" klikne na uređaju
// bez dodirnog ekrana (vidi lib/useCallNotice).
export default function CallNotice({ className = 'call-notice' }) {
  const { t } = useI18n();
  const c = t.common;

  return (
    <p className={className} aria-live="polite">
      {c.callDesktopNotice[0]}
      <a href={`mailto:${c.callDesktopEmail}`}>{c.callDesktopEmail}</a>
      {c.callDesktopNotice[1]}
    </p>
  );
}
