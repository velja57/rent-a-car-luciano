// Prikazi za učitavanje, praznu listu i grešku — isti izgled na svim stranicama.

export function LoadingState({ text = 'Učitavanje…' }) {
  return (
    <div className="admin-state" role="status">
      <span className="admin-spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export function EmptyState({ title, text, children }) {
  return (
    <div className="admin-state">
      <p className="admin-state__title">{title}</p>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="admin-state admin-state--error" role="alert">
      <p className="admin-state__title">Nešto nije u redu</p>
      <p>{error?.message ?? 'Učitavanje nije uspelo.'}</p>
      {onRetry && (
        <button type="button" className="admin-btn" onClick={onRetry}>
          Pokušaj ponovo
        </button>
      )}
    </div>
  );
}
