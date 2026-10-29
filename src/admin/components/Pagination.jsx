// "Prikazano 26–50 od 132" + prethodna / sledeća strana.
export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="admin-pagination" aria-label="Strane">
      <span className="admin-muted">
        Prikazano {from}–{to} od {total}
      </span>
      {pages > 1 && (
        <div className="admin-pagination__buttons">
          <button type="button" className="admin-btn admin-btn--small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            ← Prethodna
          </button>
          <span className="admin-pagination__page">
            {page} / {pages}
          </span>
          <button type="button" className="admin-btn admin-btn--small" disabled={page >= pages} onClick={() => onChange(page + 1)}>
            Sledeća →
          </button>
        </div>
      )}
    </nav>
  );
}
