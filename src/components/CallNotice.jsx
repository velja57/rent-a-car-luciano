import { useState } from 'react';
import { PHONE_DISPLAY } from '../data/rental';
import { useI18n } from '../i18n';

// Poruka koja se prikazuje umesto poziva kad se "Pozovi nas" klikne na uređaju
// bez dodirnog ekrana (vidi lib/useCallNotice) — nudi mejl i broj za kopiranje.
export default function CallNotice({ className = 'call-notice' }) {
  const { t } = useI18n();
  const c = t.common;
  const [copied, setCopied] = useState(false);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(PHONE_DISPLAY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API nedostupan/odbijen — broj je ipak vidljiv za ručno kopiranje.
    }
  };

  return (
    <div className={className} aria-live="polite">
      <p className="call-notice__text">{c.callDesktopNotice}</p>
      <a className="call-notice__item" href={`mailto:${c.callDesktopEmail}`}>
        {c.callDesktopEmail}
      </a>
      <div className="call-notice__item call-notice__phone">
        <span>{PHONE_DISPLAY}</span>
        <button type="button" className="call-notice__copy" onClick={copyPhone}>
          {copied ? c.callDesktopCopied : c.callDesktopCopy}
        </button>
      </div>
    </div>
  );
}
