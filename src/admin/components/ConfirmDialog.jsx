import { useEffect, useRef } from 'react';

// Prozor za potvrdu pre važne akcije (otkazivanje, promena statusa).
export default function ConfirmDialog({ title, text, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="admin-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <h2 id="admin-dialog-title">{title}</h2>
        {text && <p>{text}</p>}
        <div className="admin-dialog__actions">
          <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
            Odustani
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`admin-btn ${danger ? 'admin-btn--danger-solid' : 'admin-btn--accent'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Sačekaj…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
