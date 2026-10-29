import { STATUSES } from '../lib/labels';

export default function StatusBadge({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{STATUSES[status] ?? status}</span>;
}
