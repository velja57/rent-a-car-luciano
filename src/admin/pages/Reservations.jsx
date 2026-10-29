import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatDateTime, formatMoney, formatTime, shortId } from '../lib/format';
import { STATUS_ORDER, STATUSES, VEHICLES } from '../lib/labels';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

// Kolone po kojima može da se sortira (isti spisak kao u admin_list_reservations).
const SORTABLE = ['created_at', 'customer_name', 'car_name', 'pickup_date', 'return_date', 'total_price', 'status'];

function SortHeader({ column, label, sort, desc, onSort }) {
  const active = sort === column;
  return (
    <th aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}>
      <button type="button" className={`admin-sort${active ? ' admin-sort--active' : ''}`} onClick={() => onSort(column)}>
        {label}
        <span aria-hidden="true">{active ? (desc ? '↓' : '↑') : '↕'}</span>
      </button>
    </th>
  );
}

export default function Reservations() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Filteri su u adresi stranice (#/rezervacije?status=...), pa "Nazad" iz
  // detalja vraća na isti prikaz.
  const q = params.get('q') ?? '';
  const statuses = (params.get('status') ?? '').split(',').filter((s) => STATUSES[s]);
  const carId = params.get('vozilo') ?? '';
  const from = params.get('od') ?? '';
  const to = params.get('do') ?? '';
  const sort = SORTABLE.includes(params.get('sort')) ? params.get('sort') : 'created_at';
  const desc = params.has('smer') ? params.get('smer') === 'opadajuce' : sort === 'created_at';
  const page = Math.max(1, Number(params.get('strana')) || 1);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === '' || value === undefined) next.delete(key);
      else next.set(key, value);
    });
    if (!('strana' in changes)) next.delete('strana');
    setParams(next, { replace: true });
  };

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return undefined;
    const timer = setTimeout(() => update({ q: search }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const statusKey = statuses.join(',');
  const { data, error, loading, reload } = useAdminData(
    () =>
      adminApi.listReservations({
        p_search: q.trim() || null,
        p_statuses: statuses.length ? statuses : null,
        p_car_id: carId || null,
        p_from: from || null,
        p_to: to || null,
        p_sort: sort,
        p_desc: desc,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      }),
    [q, statusKey, carId, from, to, sort, desc, page],
  );

  const toggleStatus = (status) => {
    const next = statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status];
    update({ status: next.join(',') });
  };

  const onSort = (column) => {
    if (column === sort) update({ smer: desc ? 'rastuce' : 'opadajuce' });
    else update({ sort: column, smer: column === 'created_at' ? 'opadajuce' : 'rastuce' });
  };

  const hasFilters = Boolean(q || statuses.length || carId || from || to);
  const badRange = from && to && to < from;
  const rows = data?.rows ?? [];

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Rezervacije</h1>
          {data && <p className="admin-muted">Ukupno: {data.total}</p>}
        </div>
        <Link to="/rezervacije/nova" className="admin-btn admin-btn--accent">
          + Nova rezervacija
        </Link>
      </div>

      <div className="admin-panel admin-filters">
        <label className="admin-field admin-filters__search">
          <span>Pretraga</span>
          <input
            type="search"
            placeholder="Ime, telefon, email, vozilo, registracija ili ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="admin-field">
          <span>Vozilo</span>
          <select value={carId} onChange={(e) => update({ vozilo: e.target.value })}>
            <option value="">Sva vozila</option>
            {VEHICLES.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Period od</span>
          <input type="date" value={from} onChange={(e) => update({ od: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>do</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => update({ do: e.target.value })} />
        </label>
        <div className="admin-filters__statuses" role="group" aria-label="Status">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              className={`admin-chip${statuses.includes(status) ? ' admin-chip--on' : ''}`}
              aria-pressed={statuses.includes(status)}
              onClick={() => toggleStatus(status)}
            >
              {STATUSES[status]}
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              className="admin-link"
              onClick={() => setParams(new URLSearchParams(sort === 'created_at' ? {} : { sort }), { replace: true })}
            >
              Poništi filtere
            </button>
          )}
        </div>
        {badRange && <p className="admin-error">Datum „do“ mora biti posle datuma „od“.</p>}
        <p className="admin-muted admin-hint">
          Period prikazuje rezervacije koje se bar jednim danom preklapaju sa izabranim periodom.
        </p>
      </div>

      {!data && loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && rows.length === 0 && data.total > 0 && (
        <EmptyState title="Na ovoj strani nema rezervacija.">
          <button type="button" className="admin-btn" onClick={() => update({ strana: null })}>
            Idi na prvu stranu
          </button>
        </EmptyState>
      )}

      {data && data.total === 0 && (
        <EmptyState
          title={hasFilters ? 'Nema rezervacija za izabrane filtere.' : 'Još nema rezervacija.'}
          text={hasFilters ? 'Promeni pretragu ili poništi filtere.' : 'Nove rezervacije sa sajta pojaviće se ovde.'}
        />
      )}

      {data && rows.length > 0 && (
        <>
          <div className={`admin-table-wrap${loading ? ' admin-table-wrap--loading' : ''}`}>
            <table className="admin-table admin-table--responsive">
              <thead>
                <tr>
                  <SortHeader column="created_at" label="Rezervacija" sort={sort} desc={desc} onSort={onSort} />
                  <SortHeader column="customer_name" label="Kupac" sort={sort} desc={desc} onSort={onSort} />
                  <SortHeader column="car_name" label="Vozilo" sort={sort} desc={desc} onSort={onSort} />
                  <SortHeader column="pickup_date" label="Termin" sort={sort} desc={desc} onSort={onSort} />
                  <SortHeader column="total_price" label="Iznos" sort={sort} desc={desc} onSort={onSort} />
                  <SortHeader column="status" label="Status" sort={sort} desc={desc} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`admin-row admin-row--${r.status}`}
                    onClick={() => navigate(`/rezervacije/${r.id}`)}
                  >
                    {/* Sadržaj ćelije je u jednom <div>-u — na telefonu red postaje kartica (oznaka | vrednost). */}
                    <td data-label="Rezervacija">
                      <div>
                        <Link to={`/rezervacije/${r.id}`} className="admin-id" onClick={(e) => e.stopPropagation()}>
                          #{shortId(r.id)}
                        </Link>
                        <div className="admin-muted admin-nowrap">{formatDateTime(r.created_at)}</div>
                      </div>
                    </td>
                    <td data-label="Kupac">
                      <div>
                        <strong>{r.customer_name}</strong>
                        <div className="admin-muted admin-nowrap">{r.phone}</div>
                        {r.email && <div className="admin-muted admin-ellipsis">{r.email}</div>}
                      </div>
                    </td>
                    <td data-label="Vozilo">
                      <div>
                        {r.car_name}
                        {r.registration && <div className="admin-muted admin-nowrap">{r.registration}</div>}
                      </div>
                    </td>
                    <td data-label="Termin">
                      <div>
                        <span className="admin-nowrap">
                          {formatDate(r.pickup_date)}
                          {r.pickup_time && ` ${formatTime(r.pickup_time)}`}
                        </span>{' '}
                        →{' '}
                        <span className="admin-nowrap">
                          {formatDate(r.return_date)}
                          {r.return_time && ` ${formatTime(r.return_time)}`}
                        </span>
                        <div className="admin-muted admin-ellipsis">
                          {r.days} {r.days === 1 ? 'dan' : 'dana'} · {r.pickup_location}
                        </div>
                        {r.return_location && (
                          <div className="admin-muted admin-ellipsis">Vraćanje: {r.return_location}</div>
                        )}
                      </div>
                    </td>
                    <td data-label="Iznos">
                      <div className="admin-nowrap" title={r.total_price === null ? 'Iznos nije unet' : undefined}>
                        {formatMoney(r.total_price)}
                      </div>
                    </td>
                    <td data-label="Status">
                      <div>
                        <StatusBadge status={r.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => update({ strana: p })} />
        </>
      )}
    </div>
  );
}
