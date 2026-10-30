-- Luciano Rent a Car — šema za rezervacije (Supabase/Postgres)
-- Pokreni OVO CELO u Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Bezbedno je pokrenuti ponovo (IF NOT EXISTS / OR REPLACE svuda).

-- Potrebno za GIST exclusion constraint ispod (sprečava preklapanje termina).
create extension if not exists btree_gist;

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  car_id text not null,
  car_name text not null,
  customer_name text not null,
  email text not null,
  phone text not null,
  date_of_birth date not null,
  pickup_date date not null,
  return_date date not null,
  pickup_location text not null,
  note text,
  status text not null default 'confirmed',
  date_range daterange generated always as (daterange(pickup_date, return_date, '[]')) stored,
  created_at timestamptz not null default now()
);

-- Za baze napravljene pre uvođenja statusa (otkazivanje) — bez efekta ako
-- kolona već postoji.
alter table reservations add column if not exists status text not null default 'confirmed';

-- Statusi (tok rezervacije, admin panel):
--   confirmed  potvrđena (svaka nova rezervacija sa sajta)
--   picked_up  preuzeta — vozilo je kod kupca
--   completed  završena — vozilo vraćeno
--   cancelled  otkazana
--   no_show    kupac se nije pojavio
-- confirmed/picked_up/completed zauzimaju termin, cancelled/no_show ga oslobađaju.
alter table reservations drop constraint if exists reservations_status_check;
alter table reservations
  add constraint reservations_status_check
  check (status in ('confirmed', 'picked_up', 'completed', 'cancelled', 'no_show'));

-- Jezik kupca (mejl potvrde ide na tom jeziku) i kratak opis procenjene cene
-- sa dodacima, koji kupac dobija u mejlu potvrde. Bez efekta ako kolone postoje.
alter table reservations add column if not exists language text not null default 'sr';
alter table reservations add column if not exists price_summary text;

-- Kada je kupcu poslat podsetnik dan pre preuzimanja (supabase/podsetnik-cron.sql).
alter table reservations add column if not exists reminder_sent_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_language_check') then
    alter table reservations
      add constraint reservations_language_check check (language in ('sr', 'en'));
  end if;
end $$;

-- Admin panel: iznos (EUR) i izabrani dodaci kao podaci, vreme i mesto
-- vraćanja, izvor rezervacije (sajt ili admin) i vreme poslednje izmene.
-- Postojeće rezervacije ostaju kakve jesu — nova polja su im prazna.
alter table reservations add column if not exists total_price numeric(10, 2);
alter table reservations add column if not exists extras text[];
alter table reservations add column if not exists pickup_time time;
alter table reservations add column if not exists return_time time;
alter table reservations add column if not exists return_location text;
alter table reservations add column if not exists source text not null default 'web';
alter table reservations add column if not exists updated_at timestamptz;

-- Rezervacija primljena telefonom (unosi je admin) ne mora imati email i datum
-- rođenja. Forma na sajtu ih i dalje traži — proverava i create_reservation ispod.
alter table reservations alter column email drop not null;
alter table reservations alter column date_of_birth drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_source_check') then
    alter table reservations
      add constraint reservations_source_check check (source in ('web', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_total_price_check') then
    alter table reservations
      add constraint reservations_total_price_check
      check (total_price is null or total_price between 0 and 100000);
  end if;
end $$;

-- Snimak cene u trenutku rezervacije (kasnija promena cenovnika ga ne menja):
--   list_price        cena po danu iz cenovnika (pre popusta)
--   discount_percent  popust za dužinu najma
--   daily_rate        cena po danu koja se naplaćuje
--   rental_days       broj dana (vraćanje − preuzimanje, isto kao na sajtu)
--   rental_total      najam = daily_rate × rental_days
--   extras_total      dodaci ukupno
--   total_price       najam + dodaci (kolona iznad)
--   price_source      price_list = izračunala baza po cenovniku, admin = cenu
--                     uneo admin, reconstructed = popunjeno iz sačuvanog teksta
--                     obračuna stare rezervacije
alter table reservations add column if not exists list_price numeric(10, 2);
alter table reservations add column if not exists discount_percent numeric(5, 2);
alter table reservations add column if not exists daily_rate numeric(10, 2);
alter table reservations add column if not exists rental_days integer;
alter table reservations add column if not exists rental_total numeric(10, 2);
alter table reservations add column if not exists extras_total numeric(10, 2);
alter table reservations add column if not exists price_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_price_source_check') then
    alter table reservations
      add constraint reservations_price_source_check
      check (price_source is null or price_source in ('price_list', 'admin', 'reconstructed'));
  end if;
  -- Ukupno je uvek tačno najam + dodaci (kad je raspodela poznata).
  if not exists (select 1 from pg_constraint where conname = 'reservations_price_parts_check') then
    alter table reservations
      add constraint reservations_price_parts_check
      check (rental_total is null or total_price = rental_total + coalesce(extras_total, 0));
  end if;
end $$;

-- Sprečava da dve AKTIVNE rezervacije (confirmed/picked_up/completed) za ISTO
-- vozilo imaju preklapajuće datume — provera se radi na nivou baze, pa je
-- sigurna i kad dva korisnika rezervišu u istom trenutku (race condition).
-- Dan preuzimanja i dan vraćanja su oba zauzeti ('[]'): vozilo vraćeno 12. se
-- ponovo izdaje najranije 13. Otkazane i "nije se pojavio" se ne računaju.
alter table reservations drop constraint if exists no_overlapping_reservations;
alter table reservations
  add constraint no_overlapping_reservations
  exclude using gist (car_id with =, date_range with &&)
  where (status in ('confirmed', 'picked_up', 'completed'));

-- RLS uključen, BEZ ikakvih policy-ja za anon role.
-- Posledica: niko sa anon ključem (frontend) ne može direktno da čita ili
-- piše u ovu tabelu. Sajt pristupa samo kroz funkcije ispod, koje su
-- SECURITY DEFINER (rade sa pravima vlasnika funkcije, zaobilaze RLS za
-- svoje interne upite) i izlažu samo ono što je potrebno:
-- - is_car_available: vraća samo true/false, nikad lične podatke
-- - get_booked_dates: samo datume zauzetosti, bez ličnih podataka
-- - create_reservation: upisuje rezervaciju, vraća samo id/status
alter table reservations enable row level security;

create or replace function is_car_available(
  p_car_id text,
  p_pickup date,
  p_return date
) returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from reservations
    where car_id = p_car_id
      and status in ('confirmed', 'picked_up', 'completed')
      and date_range && daterange(p_pickup, p_return, '[]')
  );
$$;

grant execute on function is_car_available(text, date, date) to anon;

-- Zauzeti termini jednog vozila (samo datumi, bez ličnih podataka) — sajt
-- ih precrtava u kalendaru. Vraća samo aktivne rezervacije koje nisu prošle.
create or replace function get_booked_dates(p_car_id text)
returns table (pickup_date date, return_date date)
language sql
stable
security definer
set search_path = public
as $$
  select r.pickup_date, r.return_date
  from reservations r
  where r.car_id = p_car_id
    and r.status in ('confirmed', 'picked_up', 'completed')
    and r.return_date >= current_date
  order by r.pickup_date;
$$;

grant execute on function get_booked_dates(text) to anon;

-- ============================================================================
-- CENOVNIK — cene vozila, popusti za duži najam i dodaci
-- ============================================================================
-- Menja se u admin panelu (Vozila). Sajt čita cene odavde (get_price_list),
-- a iznos svake rezervacije računa baza (price_quote). Početne vrednosti su
-- iste kao u src/data/fleet.js, cars.js i rental.js; ponovno pokretanje ovog
-- fajla NE vraća cene koje je admin promenio (on conflict do nothing).
-- Cene su u celim evrima, popusti u celim procentima (isti rezultat kao sajt).

create table if not exists price_list (
  car_id text primary key check (car_id ~ '^[a-z0-9-]{1,60}$'),
  price_per_day integer not null check (price_per_day between 1 and 10000),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table price_list enable row level security;

insert into price_list (car_id, price_per_day) values
  ('fiat-500', 21), ('renault-clio', 37), ('toyota-yaris-cross', 38), ('toyota-corolla', 43),
  ('skoda-octavia', 44), ('dacia-duster', 48), ('kia-sportage', 53), ('golf', 55),
  ('bmw-serija-3', 57), ('audi', 60), ('skoda-superb', 61), ('renault-trafic', 70)
on conflict (car_id) do nothing;

create table if not exists discount_tiers (
  min_days integer primary key check (min_days between 1 and 365),
  discount_percent integer not null check (discount_percent between 0 and 90)
);

alter table discount_tiers enable row level security;

insert into discount_tiers (min_days, discount_percent) values (1, 0), (3, 10), (7, 15), (14, 20), (30, 30)
on conflict (min_days) do nothing;

create table if not exists rental_extras (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  price integer not null check (price between 0 and 10000),
  per text not null check (per in ('day', 'rental')),
  sort integer not null default 0
);

alter table rental_extras enable row level security;

insert into rental_extras (id, price, per, sort) values
  ('additional-driver', 0, 'rental', 1), ('child-seat', 3, 'day', 2), ('full-cover', 8, 'day', 3),
  ('airport', 15, 'rental', 4), ('cross-border', 30, 'rental', 5)
on conflict (id) do nothing;

-- Cenovnik za sajt (javni podaci, bez ličnih podataka).
create or replace function get_price_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cars', coalesce((select jsonb_object_agg(car_id, price_per_day) from price_list), '{}'::jsonb),
    'discounts', coalesce(
      (select jsonb_agg(jsonb_build_object('min_days', min_days, 'discount_percent', discount_percent) order by min_days)
       from discount_tiers),
      '[]'::jsonb
    ),
    'extras', coalesce(
      (select jsonb_agg(jsonb_build_object('id', id, 'price', price, 'per', per) order by sort, id) from rental_extras),
      '[]'::jsonb
    )
  );
$$;

grant execute on function get_price_list() to anon, authenticated;

-- Iznos najma po cenovniku — ista pravila kao quote() na sajtu (src/lib/pricing.js):
-- broj dana = vraćanje − preuzimanje; popust po dužini najma; cena po danu se
-- zaokružuje na ceo evro; dodatak "po danu" × broj dana, "po najmu" jednom.
-- Vraća null ako vozilo nije u cenovniku ili datumi nisu ispravni.
create or replace function price_quote(p_car_id text, p_pickup date, p_return date, p_extras text[] default null)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  n_days integer := p_return - p_pickup;
  base_price integer;
  pct integer;
  rate numeric;
  extras_sum numeric;
  extra_ids text[];
begin
  if n_days is null or n_days <= 0 then
    return null;
  end if;
  select price_per_day into base_price from price_list where car_id = p_car_id;
  if base_price is null then
    return null;
  end if;
  pct := coalesce((select discount_percent from discount_tiers where min_days <= n_days order by min_days desc limit 1), 0);
  rate := round(base_price * (100 - pct) / 100.0);
  select coalesce(sum(case when per = 'day' then price * n_days else price end), 0), coalesce(array_agg(id order by sort, id), '{}')
  into extras_sum, extra_ids
  from rental_extras
  where id = any (coalesce(p_extras, '{}'));

  return jsonb_build_object(
    'list_price', base_price,
    'discount_percent', pct,
    'daily_rate', rate,
    'days', n_days,
    'rental_total', rate * n_days,
    'extras', to_jsonb(extra_ids),
    'extras_total', extras_sum,
    'total', rate * n_days + extras_sum
  );
end;
$$;

-- Starije verzije funkcije se brišu, inače bi postojalo više funkcija istog
-- imena i poziv sa sajta ne bi znao koju da izabere. Nova verzija prima i
-- iznos i dodatke (opciono — sajt koji ih ne šalje radi kao i pre).
drop function if exists create_reservation(text, text, text, text, text, date, date, date, text, text);
drop function if exists create_reservation(text, text, text, text, text, date, date, date, text, text, text, text);

create or replace function create_reservation(
  p_car_id text,
  p_car_name text,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_dob date,
  p_pickup date,
  p_return date,
  p_location text,
  p_note text,
  p_language text default 'sr',
  p_price_summary text default null,
  p_total_price numeric default null,
  p_extras text[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  q jsonb;
  warning text;
begin
  if p_pickup is null or p_return is null or p_return <= p_pickup then
    return jsonb_build_object('success', false, 'reason', 'invalid_dates');
  end if;

  -- Iznos računa baza po cenovniku. Iznos koji šalje sajt služi samo za proveru:
  -- ako se razlikuje (npr. stranica otvorena pre promene cene), rezervacija važi
  -- po cenovniku, a admin u napomeni vidi upozorenje.
  q := price_quote(p_car_id, p_pickup, p_return, p_extras);
  if q is null then
    warning := 'Iznos nije izračunat: vozilo nije u cenovniku'
      || case when p_total_price is not null then format(' (sajt je prikazao %s€)', trim_scale(round(p_total_price, 2))) else '' end || '.';
  elsif p_total_price is not null and round(p_total_price, 2) <> (q ->> 'total')::numeric then
    warning := format(
      'Upozorenje: kupac je na sajtu video %s€, a po cenovniku je %s€.',
      trim_scale(round(p_total_price, 2)),
      q ->> 'total'
    );
  end if;

  -- Ista obavezna polja kao u formi na sajtu (email i datum rođenja više nisu
  -- obavezni na nivou tabele, zbog telefonskih rezervacija iz admin panela).
  if coalesce(trim(p_car_id), '') = ''
    or coalesce(trim(p_car_name), '') = ''
    or coalesce(trim(p_customer_name), '') = ''
    or coalesce(trim(p_phone), '') = ''
    or coalesce(trim(p_location), '') = ''
    or coalesce(trim(p_email), '') !~ '^\S+@\S+\.\S+$'
    or p_dob is null
  then
    return jsonb_build_object('success', false, 'reason', 'invalid_input');
  end if;

  begin
    insert into reservations (
      car_id, car_name, customer_name, email, phone, date_of_birth,
      pickup_date, return_date, pickup_location, note, language, price_summary,
      extras, total_price, list_price, discount_percent, daily_rate, rental_days,
      rental_total, extras_total, price_source
    ) values (
      p_car_id, p_car_name, p_customer_name, trim(p_email), p_phone, p_dob,
      p_pickup, p_return, p_location,
      nullif(concat_ws(' | ', nullif(trim(p_note), ''), warning), ''),
      case when p_language = 'en' then 'en' else 'sr' end,
      left(nullif(trim(p_price_summary), ''), 600),
      case
        when q is not null then nullif(array(select jsonb_array_elements_text(q -> 'extras')), '{}')
        else (select array_agg(e) from (select e from unnest(p_extras) e where e ~ '^[a-z0-9-]{1,40}$' limit 10) x)
      end,
      (q ->> 'total')::numeric,
      (q ->> 'list_price')::numeric,
      (q ->> 'discount_percent')::numeric,
      (q ->> 'daily_rate')::numeric,
      (q ->> 'days')::integer,
      (q ->> 'rental_total')::numeric,
      (q ->> 'extras_total')::numeric,
      case when q is not null then 'price_list' end
    )
    returning id into new_id;
  exception when exclusion_violation then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end;

  return jsonb_build_object('success', true, 'id', new_id);
end;
$$;

grant execute on function create_reservation(text, text, text, text, text, date, date, date, text, text, text, text, numeric, text[]) to anon;

-- ============================================================================
-- ADMIN PANEL — pristup za prijavljenog vlasnika (Supabase Auth)
-- ============================================================================
-- Admin nalozi su u tabeli admin_users (samo email). Prvi admin je
-- marsenic57@gmail.com. Drugi admin se dodaje ovako (SQL Editor):
--   insert into admin_users (email) values ('nova@adresa.com');
-- VAŽNO:
-- 1. Admin korisnik mora postojati sa TOM istom adresom: Authentication ->
--    Users -> Add user (+ lozinka koju ćeš koristiti za prijavu na /admin).
-- 2. Obavezno: Authentication -> Providers -> Email -> isključi "Allow new
--    users to sign up" (ne želimo da bilo ko spolja napravi nalog). Detaljno
--    uputstvo: README_ADMIN.md.
--
-- Sve admin funkcije ispod su SECURITY DEFINER i PRVO proveravaju is_admin()
-- (email iz prijave, proverava ga Supabase server) — zaštita je u bazi, ne u
-- izgledu sajta. Anon ključ ih uopšte ne može pozvati (revoke na kraju fajla).

create table if not exists admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

insert into admin_users (email) values ('marsenic57@gmail.com') on conflict (email) do nothing;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Ko je napravio izmenu (za istoriju promena): email admina, "sajt" za
-- rezervacije sa sajta, "sistem" za automatske funkcije, "sql" za SQL Editor.
create or replace function current_actor()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    auth.jwt() ->> 'email',
    case auth.jwt() ->> 'role' when 'anon' then 'sajt' when 'service_role' then 'sistem' end,
    'sql'
  );
$$;

drop policy if exists admin_select_reservations on reservations;
create policy admin_select_reservations on reservations
  for select
  to authenticated
  using (is_admin());

-- Registarske oznake i interne beleške vozila. Sama vozila (nazivi, cene,
-- slike) su i dalje u src/data/fleet.js; car_id je isti kao tamo.
create table if not exists vehicle_registry (
  car_id text primary key,
  registration text,
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table vehicle_registry enable row level security;

drop policy if exists admin_select_vehicle_registry on vehicle_registry;
create policy admin_select_vehicle_registry on vehicle_registry
  for select
  to authenticated
  using (is_admin());

-- Ručno zabeležene uplate (nema online plaćanja). kind:
--   payment           uplata ili avans kupca
--   refund            povraćaj novca kupcu
--   deposit_received  primljena kaucija (NIJE prihod — vraća se kupcu)
--   deposit_returned  vraćena kaucija
-- Stavka se ne briše: greška se poništava (voided_at) i ostaje u istoriji.
-- source je uvek 'manual' (uneo admin); kolona postoji da bi se ručne uplate
-- jasno razlikovale ako se jednog dana uvede naplata preko servisa za plaćanje.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete restrict,
  kind text not null check (kind in ('payment', 'refund', 'deposit_received', 'deposit_returned')),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 100000),
  method text not null default 'cash' check (method in ('cash', 'card', 'bank', 'other')),
  paid_at date not null default current_date,
  note text,
  source text not null default 'manual' check (source = 'manual'),
  created_by text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text
);

create index if not exists payments_reservation_id_idx on payments (reservation_id);

alter table payments enable row level security;

drop policy if exists admin_select_payments on payments;
create policy admin_select_payments on payments
  for select
  to authenticated
  using (is_admin());

-- Istorija promena rezervacije (šta je promenjeno, ko i kada).
create table if not exists reservation_events (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references reservations (id) on delete cascade,
  action text not null,
  changes jsonb,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists reservation_events_reservation_id_idx
  on reservation_events (reservation_id, created_at);

alter table reservation_events enable row level security;

drop policy if exists admin_select_reservation_events on reservation_events;
create policy admin_select_reservation_events on reservation_events
  for select
  to authenticated
  using (is_admin());

-- Svaka nova rezervacija i svaka izmena se automatski upisuje u istoriju,
-- bez obzira odakle dolazi (sajt, admin panel, SQL Editor). Beleženje
-- poslatog podsetnika (reminder_sent_at) se ne upisuje.
create or replace function log_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  diff jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into reservation_events (reservation_id, action, changes, actor)
    values (new.id, 'created', jsonb_build_object('status', new.status, 'source', new.source), current_actor());
    return new;
  end if;

  old_row := to_jsonb(old) - array['date_range', 'updated_at', 'reminder_sent_at'];
  new_row := to_jsonb(new) - array['date_range', 'updated_at', 'reminder_sent_at'];
  for k in select jsonb_object_keys(new_row) loop
    if old_row -> k is distinct from new_row -> k then
      diff := diff || jsonb_build_object(k, jsonb_build_object('from', old_row -> k, 'to', new_row -> k));
    end if;
  end loop;

  if diff <> '{}'::jsonb then
    insert into reservation_events (reservation_id, action, changes, actor)
    values (new.id, case when diff ? 'status' then 'status_changed' else 'updated' end, diff, current_actor());
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_log_change on reservations;
create trigger reservations_log_change
  after insert or update on reservations
  for each row execute function log_reservation_change();

-- Zbir uplata jedne rezervacije (bez poništenih stavki). Jedino mesto gde se
-- to računa — koriste ga lista, detalj i finansije.
create or replace function payment_totals(p_reservation_id uuid)
returns table (paid numeric, refunded numeric, deposit_in numeric, deposit_out numeric)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where kind = 'payment'), 0),
    coalesce(sum(amount) filter (where kind = 'refund'), 0),
    coalesce(sum(amount) filter (where kind = 'deposit_received'), 0),
    coalesce(sum(amount) filter (where kind = 'deposit_returned'), 0)
  from payments
  where reservation_id = p_reservation_id
    and voided_at is null;
$$;

-- Rezervacija za admin panel: sve kolone + broj dana, registracija i novac.
--   net_paid     uplaćeno minus vraćeno (bez kaucije)
--   balance      preostalo za naplatu (samo aktivne rezervacije sa unetom
--                cenom; negativno = preplaćeno)
--   deposit_held kaucija koja je trenutno kod nas
create or replace function reservation_json(r reservations)
returns jsonb
language sql
stable
set search_path = public
as $$
  select (to_jsonb(r) - 'date_range') || jsonb_build_object(
    'days', r.return_date - r.pickup_date,
    'registration', (select v.registration from vehicle_registry v where v.car_id = r.car_id),
    'paid', t.paid,
    'refunded', t.refunded,
    'net_paid', t.paid - t.refunded,
    'deposit_held', t.deposit_in - t.deposit_out,
    'balance', case
      when r.status in ('confirmed', 'picked_up', 'completed') and r.total_price is not null
        then r.total_price - (t.paid - t.refunded)
    end
  )
  from payment_totals(r.id) t;
$$;

-- Provera unosa za rezervacije iz admin panela; vraća razlog greške ili null.
create or replace function reservation_input_error(
  p_car_id text,
  p_car_name text,
  p_customer_name text,
  p_phone text,
  p_email text,
  p_pickup date,
  p_return date,
  p_location text,
  p_total_price numeric
) returns text
language sql
immutable
as $$
  select case
    when coalesce(trim(p_car_id), '') = '' or coalesce(trim(p_car_name), '') = '' then 'invalid_car'
    when coalesce(trim(p_customer_name), '') = '' then 'invalid_name'
    when coalesce(trim(p_phone), '') !~ '^[0-9+\s/()-]{6,}$' then 'invalid_phone'
    when coalesce(trim(p_email), '') <> '' and trim(p_email) !~ '^\S+@\S+\.\S+$' then 'invalid_email'
    when p_pickup is null or p_return is null or p_return <= p_pickup then 'invalid_dates'
    when coalesce(trim(p_location), '') = '' then 'invalid_location'
    when p_total_price is not null and (p_total_price < 0 or p_total_price > 100000) then 'invalid_price'
  end;
$$;

-- Otkazivanje — zadržano zbog postojećeg admin panela; novi panel koristi
-- admin_set_status.
create or replace function cancel_reservation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  update reservations
  set status = 'cancelled', updated_at = now()
  where id = p_id and status = 'confirmed';

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- Lista rezervacija: pretraga (ime, email, telefon, vozilo, registracija,
-- početak ID-ja), filteri (statusi, vozilo, period koji se preklapa sa
-- rezervacijom), sortiranje i stranice. Vraća { success, total, rows }.
create or replace function admin_list_reservations(
  p_search text default null,
  p_statuses text[] default null,
  p_car_id text default null,
  p_from date default null,
  p_to date default null,
  p_sort text default 'pickup_date',
  p_desc boolean default false,
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- Samo kolone sa ovog spiska mogu ući u ORDER BY.
  sort_col text := case p_sort
    when 'return_date' then 'return_date'
    when 'created_at' then 'created_at'
    when 'customer_name' then 'customer_name'
    when 'car_name' then 'car_name'
    when 'total_price' then 'total_price'
    when 'status' then 'status'
    else 'pickup_date'
  end;
  result jsonb;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  execute format($sql$
    with filtered as (
      select r.*
      from reservations r
      left join vehicle_registry v on v.car_id = r.car_id
      where ($1::text is null
          or r.customer_name ilike '%%' || $1 || '%%'
          or r.email ilike '%%' || $1 || '%%'
          or r.phone ilike '%%' || $1 || '%%'
          or r.car_name ilike '%%' || $1 || '%%'
          or r.car_id ilike '%%' || $1 || '%%'
          or v.registration ilike '%%' || $1 || '%%'
          or r.id::text ilike $1 || '%%')
        and ($2::text[] is null or r.status = any ($2))
        and ($3::text is null or r.car_id = $3)
        and ($4::date is null or r.return_date >= $4)
        and ($5::date is null or r.pickup_date <= $5)
    ),
    page as (
      select f.id, row_number() over (order by f.%1$I %2$s nulls last, f.created_at desc, f.id) as pos
      from filtered f
      order by pos
      limit $6 offset $7
    )
    select jsonb_build_object(
      'success', true,
      'total', (select count(*) from filtered),
      'rows', coalesce(
        (select jsonb_agg(reservation_json(r) order by p.pos) from page p join reservations r on r.id = p.id),
        '[]'::jsonb
      )
    )
  $sql$, sort_col, case when p_desc then 'desc' else 'asc' end)
  into result
  using nullif(trim(p_search), ''),
    p_statuses,
    nullif(trim(p_car_id), ''),
    p_from,
    p_to,
    least(greatest(coalesce(p_limit, 25), 1), 200),
    greatest(coalesce(p_offset, 0), 0);

  return result;
end;
$$;

-- Jedna rezervacija sa uplatama i istorijom promena.
create or replace function admin_get_reservation(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r reservations;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  select * into r from reservations where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'success', true,
    'reservation', reservation_json(r),
    'payments', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.paid_at, p.created_at) from payments p where p.reservation_id = p_id),
      '[]'::jsonb
    ),
    'events', coalesce(
      (select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id desc) from reservation_events e where e.reservation_id = p_id),
      '[]'::jsonb
    )
  );
end;
$$;

-- Dostupnost vozila za admin formu. p_exclude_id: rezervacija koja se menja
-- (ne sudara se sama sa sobom). Vraća i rezervacije sa kojima se sudara.
create or replace function admin_check_availability(
  p_car_id text,
  p_pickup date,
  p_return date,
  p_exclude_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  conflicts jsonb;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_pickup is null or p_return is null or p_return <= p_pickup then
    return jsonb_build_object('success', false, 'reason', 'invalid_dates');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'customer_name', r.customer_name,
      'pickup_date', r.pickup_date,
      'return_date', r.return_date,
      'status', r.status
    ) order by r.pickup_date), '[]'::jsonb)
  into conflicts
  from reservations r
  where r.car_id = p_car_id
    and r.status in ('confirmed', 'picked_up', 'completed')
    and r.date_range && daterange(p_pickup, p_return, '[]')
    and (p_exclude_id is null or r.id <> p_exclude_id);

  return jsonb_build_object('success', true, 'available', conflicts = '[]'::jsonb, 'conflicts', conflicts);
end;
$$;

-- Cena rezervacije iz admin panela: admin zadaje cenu po danu i iznos dodataka
-- (forma ih predlaže po cenovniku), a najam i ukupno računa baza:
-- najam = cena po danu × broj dana, ukupno = najam + dodaci.
-- Vraća { priced: false } kad cena nije zadata, { error } kad je neispravna.
create or replace function reservation_price(
  p_car_id text,
  p_pickup date,
  p_return date,
  p_extras text[],
  p_daily_rate numeric,
  p_extras_total numeric
) returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  q jsonb := price_quote(p_car_id, p_pickup, p_return, p_extras);
  n_days integer := p_return - p_pickup;
  rate numeric;
  extras_sum numeric;
  rental numeric;
begin
  if p_daily_rate is null then
    return jsonb_build_object('priced', false);
  end if;
  if n_days is null or n_days <= 0 then
    return jsonb_build_object('error', 'invalid_dates');
  end if;
  rate := round(p_daily_rate, 2);
  extras_sum := round(coalesce(p_extras_total, 0), 2);
  rental := round(rate * n_days, 2);
  if rate < 0 or rate > 10000 or extras_sum < 0 or rental + extras_sum > 100000 then
    return jsonb_build_object('error', 'invalid_price');
  end if;

  return jsonb_build_object(
    'priced', true,
    'daily_rate', rate,
    'rental_days', n_days,
    'rental_total', rental,
    'extras_total', extras_sum,
    'total', rental + extras_sum,
    'list_price', q -> 'list_price',
    'discount_percent', q -> 'discount_percent',
    'matches_price_list',
      q is not null and rate = (q ->> 'daily_rate')::numeric and extras_sum = (q ->> 'extras_total')::numeric
  );
end;
$$;

-- Predlog cene za admin formu (po trenutnom cenovniku); quote je null ako
-- vozilo nije u cenovniku.
create or replace function admin_quote(p_car_id text, p_pickup date, p_return date, p_extras text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  return jsonb_build_object('success', true, 'quote', price_quote(p_car_id, p_pickup, p_return, p_extras));
end;
$$;

-- Starije verzije (sa ručno unetim ukupnim iznosom) se brišu.
drop function if exists admin_create_reservation(text, text, text, text, date, date, text, text, date, time, time, text, text, text, numeric, text[]);
drop function if exists admin_update_reservation(uuid, text, text, text, text, date, date, text, text, date, time, time, text, text, text, numeric, text[]);

-- Ručno uneta rezervacija (npr. posle telefonskog poziva). Ista pravila
-- zauzetosti kao za sajt — preklapanje odbija baza (exclusion constraint).
create or replace function admin_create_reservation(
  p_car_id text,
  p_car_name text,
  p_customer_name text,
  p_phone text,
  p_pickup date,
  p_return date,
  p_location text,
  p_email text default null,
  p_dob date default null,
  p_pickup_time time default null,
  p_return_time time default null,
  p_return_location text default null,
  p_note text default null,
  p_language text default 'sr',
  p_daily_rate numeric default null,
  p_extras_total numeric default null,
  p_extras text[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  price jsonb;
  priced boolean;
  input_error text;
  new_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  price := reservation_price(p_car_id, p_pickup, p_return, p_extras, p_daily_rate, p_extras_total);
  priced := coalesce((price ->> 'priced')::boolean, false);
  input_error := coalesce(
    reservation_input_error(p_car_id, p_car_name, p_customer_name, p_phone, p_email, p_pickup, p_return, p_location, null),
    price ->> 'error'
  );
  if input_error is not null then
    return jsonb_build_object('success', false, 'reason', input_error);
  end if;

  begin
    insert into reservations (
      car_id, car_name, customer_name, email, phone, date_of_birth,
      pickup_date, return_date, pickup_time, return_time, pickup_location, return_location,
      note, language, extras, source,
      total_price, list_price, discount_percent, daily_rate, rental_days, rental_total, extras_total, price_source
    ) values (
      trim(p_car_id), trim(p_car_name), trim(p_customer_name), nullif(trim(p_email), ''), trim(p_phone), p_dob,
      p_pickup, p_return, p_pickup_time, p_return_time, trim(p_location), nullif(trim(p_return_location), ''),
      nullif(trim(p_note), ''),
      case when p_language = 'en' then 'en' else 'sr' end,
      nullif(p_extras, '{}'),
      'admin',
      (price ->> 'total')::numeric,
      (price ->> 'list_price')::numeric,
      (price ->> 'discount_percent')::numeric,
      (price ->> 'daily_rate')::numeric,
      (price ->> 'rental_days')::integer,
      (price ->> 'rental_total')::numeric,
      (price ->> 'extras_total')::numeric,
      case
        when not priced then null
        when (price ->> 'matches_price_list')::boolean then 'price_list'
        else 'admin'
      end
    )
    returning id into new_id;
  exception when exclusion_violation then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end;

  return jsonb_build_object('success', true, 'id', new_id);
end;
$$;

-- Izmena podataka rezervacije (status se menja posebno, admin_set_status).
-- Cena po danu ostaje ona iz trenutka rezervacije dok je admin ne promeni:
-- kad se promene datumi, najam se preračunava po TOJ ceni, ne po današnjem
-- cenovniku.
create or replace function admin_update_reservation(
  p_id uuid,
  p_car_id text,
  p_car_name text,
  p_customer_name text,
  p_phone text,
  p_pickup date,
  p_return date,
  p_location text,
  p_email text default null,
  p_dob date default null,
  p_pickup_time time default null,
  p_return_time time default null,
  p_return_location text default null,
  p_note text default null,
  p_language text default 'sr',
  p_daily_rate numeric default null,
  p_extras_total numeric default null,
  p_extras text[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prev reservations;
  price jsonb;
  priced boolean;
  same_price boolean;
  new_source text;
  input_error text;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  price := reservation_price(p_car_id, p_pickup, p_return, p_extras, p_daily_rate, p_extras_total);
  priced := coalesce((price ->> 'priced')::boolean, false);
  input_error := coalesce(
    reservation_input_error(p_car_id, p_car_name, p_customer_name, p_phone, p_email, p_pickup, p_return, p_location, null),
    price ->> 'error'
  );
  if input_error is not null then
    return jsonb_build_object('success', false, 'reason', input_error);
  end if;

  select * into prev from reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  -- Cena po danu i dodaci nepromenjeni -> zadržava se poreklo cene (npr. cenovnik
  -- iz trenutka rezervacije); promenjeni -> "po cenovniku" ako se poklapa sa
  -- današnjim cenovnikom, inače "uneo admin".
  same_price := priced
    and prev.daily_rate is not distinct from (price ->> 'daily_rate')::numeric
    and coalesce(prev.extras_total, 0) = (price ->> 'extras_total')::numeric
    and prev.price_source is not null;
  new_source := case
    when not priced then null
    when same_price then prev.price_source
    when (price ->> 'matches_price_list')::boolean then 'price_list'
    else 'admin'
  end;

  begin
    update reservations set
      car_id = trim(p_car_id),
      car_name = trim(p_car_name),
      customer_name = trim(p_customer_name),
      email = nullif(trim(p_email), ''),
      phone = trim(p_phone),
      date_of_birth = p_dob,
      pickup_date = p_pickup,
      return_date = p_return,
      pickup_time = p_pickup_time,
      return_time = p_return_time,
      pickup_location = trim(p_location),
      return_location = nullif(trim(p_return_location), ''),
      note = nullif(trim(p_note), ''),
      language = case when p_language = 'en' then 'en' else 'sr' end,
      extras = nullif(p_extras, '{}'),
      -- Stara rezervacija bez poznate raspodele cene: iznos se ne briše ako
      -- admin nije zadao cenu po danu.
      total_price = case when priced or prev.daily_rate is not null then (price ->> 'total')::numeric else prev.total_price end,
      daily_rate = (price ->> 'daily_rate')::numeric,
      rental_days = (price ->> 'rental_days')::integer,
      rental_total = (price ->> 'rental_total')::numeric,
      extras_total = (price ->> 'extras_total')::numeric,
      list_price = case when same_price then prev.list_price else (price ->> 'list_price')::numeric end,
      discount_percent = case when same_price then prev.discount_percent else (price ->> 'discount_percent')::numeric end,
      price_source = new_source,
      updated_at = now()
    where id = p_id;
  exception when exclusion_violation then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end;

  return jsonb_build_object('success', true);
end;
$$;

-- Promena statusa. Dozvoljeni prelazi:
--   confirmed -> picked_up | cancelled | no_show
--   picked_up -> completed
--   cancelled -> confirmed (ponovo aktivirana — baza proverava da li je termin i dalje slobodan)
create or replace function admin_set_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  select status into current_status from reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if not (
    (current_status = 'confirmed' and p_status in ('picked_up', 'cancelled', 'no_show'))
    or (current_status = 'picked_up' and p_status = 'completed')
    or (current_status = 'cancelled' and p_status = 'confirmed')
  ) then
    return jsonb_build_object('success', false, 'reason', 'invalid_transition', 'from', current_status, 'to', p_status);
  end if;

  begin
    update reservations set status = p_status, updated_at = now() where id = p_id;
  exception when exclusion_violation then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end;

  return jsonb_build_object('success', true, 'status', p_status);
end;
$$;

-- Ručno beleženje uplate / avansa / povraćaja / kaucije.
create or replace function admin_add_payment(
  p_reservation_id uuid,
  p_kind text,
  p_amount numeric,
  p_method text default 'cash',
  p_paid_at date default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_kind is null or p_kind not in ('payment', 'refund', 'deposit_received', 'deposit_returned') then
    return jsonb_build_object('success', false, 'reason', 'invalid_kind');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    return jsonb_build_object('success', false, 'reason', 'invalid_amount');
  end if;
  if p_method is null or p_method not in ('cash', 'card', 'bank', 'other') then
    return jsonb_build_object('success', false, 'reason', 'invalid_method');
  end if;
  if not exists (select 1 from reservations where id = p_reservation_id) then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  insert into payments (reservation_id, kind, amount, method, paid_at, note, created_by)
  values (
    p_reservation_id, p_kind, round(p_amount, 2), p_method,
    coalesce(p_paid_at, (now() at time zone 'Europe/Belgrade')::date),
    nullif(trim(p_note), ''),
    current_actor()
  )
  returning id into new_id;

  insert into reservation_events (reservation_id, action, changes, actor)
  values (
    p_reservation_id, 'payment_added',
    jsonb_build_object('payment_id', new_id, 'kind', p_kind, 'amount', round(p_amount, 2), 'method', p_method),
    current_actor()
  );

  return jsonb_build_object('success', true, 'id', new_id);
end;
$$;

-- Poništavanje pogrešno unete uplate (stavka ostaje zabeležena kao poništena).
create or replace function admin_void_payment(p_payment_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p payments;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  update payments
  set voided_at = now(), voided_by = current_actor()
  where id = p_payment_id and voided_at is null
  returning * into p;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  insert into reservation_events (reservation_id, action, changes, actor)
  values (
    p.reservation_id, 'payment_voided',
    jsonb_build_object('payment_id', p.id, 'kind', p.kind, 'amount', p.amount, 'reason', nullif(trim(p_reason), '')),
    current_actor()
  );

  return jsonb_build_object('success', true);
end;
$$;

-- Registarska oznaka / beleška / aktivnost vozila iz fleet.js.
create or replace function admin_upsert_vehicle(
  p_car_id text,
  p_registration text default null,
  p_notes text default null,
  p_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if coalesce(p_car_id, '') !~ '^[a-z0-9-]{1,60}$' then
    return jsonb_build_object('success', false, 'reason', 'invalid_car');
  end if;

  insert into vehicle_registry (car_id, registration, notes, active, updated_at)
  values (p_car_id, nullif(upper(trim(p_registration)), ''), nullif(trim(p_notes), ''), coalesce(p_active, true), now())
  on conflict (car_id) do update set
    registration = excluded.registration,
    notes = excluded.notes,
    active = excluded.active,
    updated_at = now();

  return jsonb_build_object('success', true);
end;
$$;

-- Kalendar vozila: sve rezervacije (i otkazane, prikazuju se drugačije) koje
-- se preklapaju sa periodom od p_from do p_to.
create or replace function admin_calendar(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    return jsonb_build_object('success', false, 'reason', 'invalid_range');
  end if;

  return jsonb_build_object(
    'success', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'car_id', r.car_id,
          'car_name', r.car_name,
          'customer_name', r.customer_name,
          'pickup_date', r.pickup_date,
          'return_date', r.return_date,
          'pickup_time', r.pickup_time,
          'return_time', r.return_time,
          'status', r.status
        ) order by r.car_id, r.pickup_date)
      from reservations r
      where r.pickup_date <= p_to and r.return_date >= p_from
    ), '[]'::jsonb)
  );
end;
$$;

-- Početna strana admin panela: današnja preuzimanja i vraćanja (po
-- beogradskom vremenu), vozila kod kupaca i broj rezervacija po statusu.
create or replace function admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Belgrade')::date;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  return jsonb_build_object(
    'success', true,
    'today', today,
    'pickups_today', coalesce((
      select jsonb_agg(reservation_json(r) order by r.pickup_time nulls last, r.created_at)
      from reservations r
      where r.pickup_date = today and r.status = 'confirmed'
    ), '[]'::jsonb),
    'returns_today', coalesce((
      select jsonb_agg(reservation_json(r) order by r.return_time nulls last, r.created_at)
      from reservations r
      where r.return_date = today and r.status in ('confirmed', 'picked_up')
    ), '[]'::jsonb),
    'on_rent', (select count(*) from reservations where status = 'picked_up'),
    'upcoming_7_days', (
      select count(*) from reservations
      where status = 'confirmed' and pickup_date > today and pickup_date <= today + 7
    ),
    'status_counts', coalesce((
      select jsonb_object_agg(status, n)
      from (select status, count(*) as n from reservations group by status) s
    ), '{}'::jsonb)
  );
end;
$$;

-- Finansijski pregled za period (p_from..p_to). Razlikuje:
--   booked       vrednost aktivnih rezervacija (po datumu preuzimanja) —
--                to NIJE naplaćen novac; otkazane i "nije se pojavio" se ne računaju
--   payments     stvarno zabeležene uplate u periodu (po datumu uplate);
--                collected = uplate - povraćaji; kaucija je posebno i nije prihod
--   outstanding  preostalo za naplatu za aktivne rezervacije iz perioda
-- Rezervacije bez unete cene se ne sabiraju (booked.without_price).
create or replace function admin_finance_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active text[] := array['confirmed', 'picked_up', 'completed'];
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    return jsonb_build_object('success', false, 'reason', 'invalid_range');
  end if;

  return jsonb_build_object(
    'success', true,
    'from', p_from,
    'to', p_to,
    'booked', (
      select jsonb_build_object(
        'count', count(*),
        'value', coalesce(sum(r.total_price), 0),
        'without_price', count(*) filter (where r.total_price is null)
      )
      from reservations r
      where r.status = any (active) and r.pickup_date between p_from and p_to
    ),
    'outstanding', (
      select coalesce(sum(greatest(r.total_price - (t.paid - t.refunded), 0)), 0)
      from reservations r
      cross join lateral payment_totals(r.id) t
      where r.status = any (active) and r.total_price is not null and r.pickup_date between p_from and p_to
    ),
    'payments', (
      select jsonb_build_object(
        'received', coalesce(sum(amount) filter (where kind = 'payment'), 0),
        'refunded', coalesce(sum(amount) filter (where kind = 'refund'), 0),
        'collected', coalesce(sum(amount) filter (where kind = 'payment'), 0)
                   - coalesce(sum(amount) filter (where kind = 'refund'), 0),
        'deposits_received', coalesce(sum(amount) filter (where kind = 'deposit_received'), 0),
        'deposits_returned', coalesce(sum(amount) filter (where kind = 'deposit_returned'), 0)
      )
      from payments
      where voided_at is null and paid_at between p_from and p_to
    ),
    'deposits_held_now', (
      select coalesce(sum(amount) filter (where kind = 'deposit_received'), 0)
           - coalesce(sum(amount) filter (where kind = 'deposit_returned'), 0)
      from payments
      where voided_at is null
    ),
    'by_month', coalesce((
      with booked as (
        select to_char(pickup_date, 'YYYY-MM') as ym, count(*) as n, coalesce(sum(total_price), 0) as value
        from reservations
        where status = any (active) and pickup_date between p_from and p_to
        group by 1
      ),
      collected as (
        select to_char(paid_at, 'YYYY-MM') as ym,
          coalesce(sum(amount) filter (where kind = 'payment'), 0)
            - coalesce(sum(amount) filter (where kind = 'refund'), 0) as value
        from payments
        where voided_at is null and kind in ('payment', 'refund') and paid_at between p_from and p_to
        group by 1
      )
      select jsonb_agg(jsonb_build_object(
          'month', ym,
          'count', coalesce(b.n, 0),
          'booked', coalesce(b.value, 0),
          'collected', coalesce(c.value, 0)
        ) order by ym)
      from booked b
      full join collected c using (ym)
    ), '[]'::jsonb),
    'by_vehicle', coalesce((
      with booked as (
        select car_id, max(car_name) as car_name, count(*) as n, coalesce(sum(total_price), 0) as value
        from reservations
        where status = any (active) and pickup_date between p_from and p_to
        group by car_id
      ),
      collected as (
        select r.car_id, max(r.car_name) as car_name,
          coalesce(sum(p.amount) filter (where p.kind = 'payment'), 0)
            - coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0) as value
        from payments p
        join reservations r on r.id = p.reservation_id
        where p.voided_at is null and p.kind in ('payment', 'refund') and p.paid_at between p_from and p_to
        group by r.car_id
      )
      select jsonb_agg(jsonb_build_object(
          'car_id', car_id,
          'car_name', coalesce(b.car_name, c.car_name),
          'count', coalesce(b.n, 0),
          'booked', coalesce(b.value, 0),
          'collected', coalesce(c.value, 0)
        ) order by coalesce(b.value, 0) desc, car_id)
      from booked b
      full join collected c using (car_id)
    ), '[]'::jsonb),
    'status_counts', coalesce((
      select jsonb_object_agg(status, n)
      from (
        select status, count(*) as n from reservations
        where pickup_date between p_from and p_to
        group by status
      ) s
    ), '{}'::jsonb)
  );
end;
$$;

-- ============================================================================
-- CENOVNIK U ADMIN PANELU
-- ============================================================================
-- Promena cene važi samo za NOVE rezervacije — postojeće čuvaju svoj snimak cene.

create or replace function admin_set_car_price(p_car_id text, p_price_per_day integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if coalesce(p_car_id, '') !~ '^[a-z0-9-]{1,60}$' then
    return jsonb_build_object('success', false, 'reason', 'invalid_car');
  end if;
  if p_price_per_day is null or p_price_per_day not between 1 and 10000 then
    return jsonb_build_object('success', false, 'reason', 'invalid_price');
  end if;

  insert into price_list (car_id, price_per_day, updated_at, updated_by)
  values (p_car_id, p_price_per_day, now(), current_actor())
  on conflict (car_id) do update set
    price_per_day = excluded.price_per_day,
    updated_at = now(),
    updated_by = excluded.updated_by;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function admin_set_discount(p_min_days integer, p_discount_percent integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_discount_percent is null or p_discount_percent not between 0 and 90 then
    return jsonb_build_object('success', false, 'reason', 'invalid_discount');
  end if;

  update discount_tiers set discount_percent = p_discount_percent where min_days = p_min_days;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function admin_set_extra_price(p_id text, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_price is null or p_price not between 0 and 10000 then
    return jsonb_build_object('success', false, 'reason', 'invalid_price');
  end if;

  update rental_extras set price = p_price where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- ============================================================================
-- STARE REZERVACIJE — snimak cene iz sačuvanog teksta obračuna
-- ============================================================================
-- Sajt je uz svaku rezervaciju sačuvao tekst obračuna (kolona price_summary,
-- ili u napomeni posle "Procenjena cena:" / "Iznos:"), npr.
--   "2 dana × 38€ = 76€ · Ukupno 76€ (≈ 8.910 din)"
--   "7 days × €45 (−15%) = €315 · Child seat €21 · Total €336 (≈ …)"
-- Iz njega se cena popunjava SAMO ako se sve slaže: broj dana sa datumima
-- rezervacije, cena po danu × dani = najam, ukupno ≥ najam (i isti iznos kao
-- već upisani, ako postoji). Inače rezervacija ostaje bez cene — ništa se ne
-- izmišlja.
create or replace function reconstruct_reservation_price(r reservations)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  src text := coalesce(
    nullif(trim(r.price_summary), ''),
    trim((regexp_match(r.note, '(?:Procenjena cena|Iznos): ([^|]+)'))[1])
  );
  m text[];
  total_match text[];
  n integer;
  rate numeric;
  pct numeric;
  rental numeric;
  total numeric;
begin
  if src is null then
    return null;
  end if;
  m := regexp_match(src, '^(\d+) \S+ × €?([0-9.,]+)€?(?: \(−(\d+)%\))? = €?([0-9.,]+)€?');
  total_match := regexp_match(src, '(?:Ukupno|Total) €?([0-9.,]+)');
  if m is null or total_match is null then
    return null;
  end if;

  -- Cene su u celim evrima; tačka/zarez su samo razdvajanje hiljada.
  n := m[1]::integer;
  rate := regexp_replace(m[2], '[.,]', '', 'g')::numeric;
  pct := coalesce(m[3]::numeric, 0);
  rental := regexp_replace(m[4], '[.,]', '', 'g')::numeric;
  total := regexp_replace(total_match[1], '[.,]', '', 'g')::numeric;

  if n <> r.return_date - r.pickup_date or rate * n <> rental or total < rental then
    return null;
  end if;
  if r.total_price is not null and r.total_price <> total then
    return null;
  end if;

  return jsonb_build_object(
    'daily_rate', rate,
    'rental_days', n,
    'rental_total', rental,
    'extras_total', total - rental,
    'total', total,
    'discount_percent', pct,
    -- Cena iz cenovnika (pre popusta) je poznata samo kad nije bilo popusta.
    'list_price', case when pct = 0 then rate end
  );
end;
$$;

-- Popunjavanje (samo rezervacije bez snimka cene; bezbedno pokretati ponovo).
-- Svaka popunjena rezervacija dobija zapis u istoriji promena.
update reservations r set
  daily_rate = (s.x ->> 'daily_rate')::numeric,
  rental_days = (s.x ->> 'rental_days')::integer,
  rental_total = (s.x ->> 'rental_total')::numeric,
  extras_total = (s.x ->> 'extras_total')::numeric,
  total_price = (s.x ->> 'total')::numeric,
  discount_percent = (s.x ->> 'discount_percent')::numeric,
  list_price = (s.x ->> 'list_price')::numeric,
  price_source = 'reconstructed'
from (
  select r2.id, reconstruct_reservation_price(r2) as x
  from reservations r2
  where r2.rental_total is null
) s
where r.id = s.id and s.x is not null;

-- Iznos koji je ranije ručno unet u admin panelu, a rezervacija nema dodatke:
-- ceo iznos je najam (pouzdano). Sa dodacima se raspodela ne može znati.
update reservations set
  rental_days = return_date - pickup_date,
  rental_total = total_price,
  extras_total = 0,
  daily_rate = round(total_price / (return_date - pickup_date), 2),
  price_source = 'admin'
where rental_total is null
  and total_price is not null
  and coalesce(cardinality(extras), 0) = 0
  and return_date > pickup_date;

-- ============================================================================
-- PRIHODI — raspodela po danima i analitika
-- ============================================================================

-- Stavke prihoda za period, po rezervaciji i danu. Prihod rezervacije je
-- najam i dodaci umanjeni za zabeležene povraćaje (prvo najam, ostatak dodaci).
--   p_mode = 'rental'  — po danima najma: iznos se deli na dane od preuzimanja
--                        do dana pre vraćanja (isti broj dana kao na sajtu);
--                        ostatak centi ide prvim danima, pa je zbir dana uvek
--                        tačno jednak iznosu rezervacije
--   p_mode = 'booking' — ceo iznos na dan kada je rezervacija napravljena
-- Računa se uvek iz trenutnih podataka rezervacije, pa izmena datuma ili cene
-- odmah važi i nijedan iznos se ne broji dvaput.
create or replace function revenue_lines(
  p_from date,
  p_to date,
  p_mode text,
  p_statuses text[],
  p_car_id text default null
) returns table (reservation_id uuid, car_id text, car_name text, day date, rental numeric, extras numeric)
language sql
stable
set search_path = public
as $$
  with res as (
    select
      r.id,
      r.car_id,
      r.car_name,
      r.pickup_date,
      r.return_date - r.pickup_date as n_days,
      (r.created_at at time zone 'Europe/Belgrade')::date as booked_on,
      round(greatest(r.rental_total - t.refunded, 0) * 100)::bigint as rental_cents,
      round(greatest(coalesce(r.extras_total, 0) - greatest(t.refunded - r.rental_total, 0), 0) * 100)::bigint as extras_cents
    from reservations r
    cross join lateral payment_totals(r.id) t
    where r.status = any (p_statuses)
      and r.rental_total is not null
      and r.return_date > r.pickup_date
      and (p_car_id is null or r.car_id = p_car_id)
  )
  select id, car_id, car_name, booked_on, rental_cents / 100.0, extras_cents / 100.0
  from res
  where p_mode = 'booking' and booked_on between p_from and p_to
  union all
  select
    res.id,
    res.car_id,
    res.car_name,
    g.d::date,
    (res.rental_cents / res.n_days + case when g.d::date - res.pickup_date < res.rental_cents % res.n_days then 1 else 0 end) / 100.0,
    (res.extras_cents / res.n_days + case when g.d::date - res.pickup_date < res.extras_cents % res.n_days then 1 else 0 end) / 100.0
  from res
  cross join lateral generate_series(
    greatest(res.pickup_date, p_from)::timestamp,
    least(res.pickup_date + res.n_days - 1, p_to)::timestamp,
    interval '1 day'
  ) as g(d)
  where p_mode = 'rental';
$$;

-- Analitika prihoda za period (admin). p_scope:
--   booked   — ugovoreno: potvrđene, preuzete i završene rezervacije
--   realized — realizovano: samo završene
-- Otkazane i "nije se pojavio" se nikad ne računaju. Rezervacije bez poznate
-- cene se ne sabiraju (vraća se njihov broj). "cash" su stvarno zabeležene
-- uplate i povraćaji u periodu (po datumu uplate) — odvojeno od vrednosti.
create or replace function admin_revenue(
  p_from date,
  p_to date,
  p_mode text default 'rental',
  p_scope text default 'booked',
  p_car_id text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text := case when p_mode = 'booking' then 'booking' else 'rental' end;
  v_scope text := case when p_scope = 'realized' then 'realized' else 'booked' end;
  v_statuses text[] := case
    when p_scope = 'realized' then array['completed']
    else array['confirmed', 'picked_up', 'completed']
  end;
  v_car text := nullif(trim(p_car_id), '');
  result jsonb;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3700 then
    return jsonb_build_object('success', false, 'reason', 'invalid_range');
  end if;

  with lines as (
    select * from revenue_lines(p_from, p_to, v_mode, v_statuses, v_car)
  )
  select jsonb_build_object(
    'success', true,
    'from', p_from,
    'to', p_to,
    'mode', v_mode,
    'scope', v_scope,
    'car_id', v_car,
    'totals', (
      select jsonb_build_object(
        'rental', coalesce(sum(l.rental), 0),
        'extras', coalesce(sum(l.extras), 0),
        'total', coalesce(sum(l.rental + l.extras), 0),
        'reservations', count(distinct l.reservation_id)
      )
      from lines l
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.day, 'rental', x.rental, 'extras', x.extras) order by x.day)
      from (select l.day, sum(l.rental) as rental, sum(l.extras) as extras from lines l group by l.day) x
    ), '[]'::jsonb),
    'by_car', coalesce((
      select jsonb_agg(jsonb_build_object(
          'car_id', x.car_id,
          'car_name', x.car_name,
          'reservations', x.n,
          'rental', x.rental,
          'extras', x.extras,
          'total', x.rental + x.extras
        ) order by x.rental + x.extras desc, x.car_id)
      from (
        select l.car_id, max(l.car_name) as car_name, count(distinct l.reservation_id) as n,
          sum(l.rental) as rental, sum(l.extras) as extras
        from lines l
        group by l.car_id
      ) x
    ), '[]'::jsonb),
    'reservations', case when v_car is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'customer_name', r.customer_name,
          'pickup_date', r.pickup_date,
          'return_date', r.return_date,
          'status', r.status,
          'total_price', r.total_price,
          'rental', x.rental,
          'extras', x.extras
        ) order by r.pickup_date, r.created_at)
      from (
        select l.reservation_id, sum(l.rental) as rental, sum(l.extras) as extras
        from lines l
        group by l.reservation_id
      ) x
      join reservations r on r.id = x.reservation_id
    ), '[]'::jsonb) end,
    'unpriced', (
      select count(*)
      from reservations r
      where r.status = any (v_statuses)
        and r.rental_total is null
        and (v_car is null or r.car_id = v_car)
        and case
          when v_mode = 'booking' then (r.created_at at time zone 'Europe/Belgrade')::date between p_from and p_to
          else r.pickup_date <= p_to and r.return_date > p_from
        end
    ),
    'cash', (
      select jsonb_build_object(
        'received', coalesce(sum(p.amount) filter (where p.kind = 'payment'), 0),
        'refunded', coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0),
        'collected', coalesce(sum(p.amount) filter (where p.kind = 'payment'), 0)
                   - coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0)
      )
      from payments p
      join reservations r on r.id = p.reservation_id
      where p.voided_at is null
        and p.paid_at between p_from and p_to
        and (v_car is null or r.car_id = v_car)
    )
  )
  into result;

  return result;
end;
$$;

-- Prava pozivanja: Supabase podrazumevano dozvoljava svima da pozovu svaku
-- funkciju. Admin funkcije sme da pozove samo prijavljen korisnik (a one
-- same proveravaju da li je admin); pomoćne funkcije niko spolja.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%' or p.proname in ('cancel_reservation', 'is_admin'))
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'current_actor', 'payment_totals', 'reservation_json', 'reservation_input_error', 'price_quote',
        'reservation_price', 'reconstruct_reservation_price', 'revenue_lines'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
