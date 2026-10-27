import { useSearchParams } from 'react-router';
import { rentalDays } from './pricing';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readDate(params, key) {
  const value = params.get(key) ?? '';
  return ISO_DATE.test(value) ? value : '';
}

// Izabrani datumi najma žive u URL-u (?od=…&do=…), pa ostaju sačuvani pri
// prelasku sa liste vozila na stranicu vozila i nazad, i mogu da se podele.
export function useRentalDates() {
  const [params, setParams] = useSearchParams();
  const pickup = readDate(params, 'od');
  const ret = readDate(params, 'do');

  const setDates = (next) => {
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        if (next.pickup) updated.set('od', next.pickup);
        else updated.delete('od');
        if (next.ret) updated.set('do', next.ret);
        else updated.delete('do');
        return updated;
      },
      { replace: true },
    );
  };

  return { pickup, ret, days: rentalDays(pickup, ret), setDates };
}

export function datesQuery(pickup, ret) {
  if (!pickup || !ret) return '';
  return `?${new URLSearchParams({ od: pickup, do: ret })}`;
}
