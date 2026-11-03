-- Podsetnik kupcu dan pre preuzimanja vozila (funkcija send-pickup-reminders).
-- Pokreni JEDNOM u Supabase Dashboard -> SQL Editor, POSLE objave funkcije i
-- dodavanja secret-a CRON_SECRET (uputstvo: README_RESERVATIONS.md).
-- Pre pokretanja zameni OVDE-TVOJA-TAJNA istom vrednošću kao CRON_SECRET.

-- Beleži da je podsetnik poslat (da ne ode dva puta).
alter table reservations add column if not exists reminder_sent_at timestamptz;

-- Raspored (pg_cron). pg_net već postoji — koristi ga i webhook za potvrdu.
create extension if not exists pg_cron;

-- Svaki dan u 08:00 UTC (09:00 zimi / 10:00 leti po beogradskom vremenu).
select cron.schedule(
  'podsetnik-za-preuzimanje',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://bhfixevgyzcglkjzbiab.supabase.co/functions/v1/send-pickup-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'OVDE-TVOJA-TAJNA'),
    body := '{}'::jsonb
  );
  $$
);

-- Ako ikad treba da ugasiš podsetnike:
-- select cron.unschedule('podsetnik-za-preuzimanje');
