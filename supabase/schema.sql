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

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_status_check') then
    alter table reservations
      add constraint reservations_status_check check (status in ('confirmed', 'cancelled'));
  end if;
end $$;

-- Sprečava da dve AKTIVNE (confirmed) rezervacije za ISTO vozilo imaju
-- preklapajuće datume — provera se radi na nivou baze, pa je sigurna i kad
-- dva korisnika rezervišu u istom trenutku (race condition). Otkazane
-- rezervacije (status='cancelled') se ne računaju — oslobađaju termin.
alter table reservations drop constraint if exists no_overlapping_reservations;
alter table reservations
  add constraint no_overlapping_reservations
  exclude using gist (car_id with =, date_range with &&)
  where (status = 'confirmed');

-- RLS uključen, BEZ ikakvih policy-ja za anon/authenticated role.
-- Posledica: niko sa anon ključem (frontend) ne može direktno da čita ili
-- piše u ovu tabelu. Jedini pristup je kroz dve funkcije ispod, koje su
-- SECURITY DEFINER (rade sa pravima vlasnika funkcije, zaobilaze RLS za
-- svoje interne upite) i izlažu samo ono što je potrebno:
-- - is_car_available: vraća samo true/false, nikad lične podatke
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
      and status = 'confirmed'
      and date_range && daterange(p_pickup, p_return, '[]')
  );
$$;

grant execute on function is_car_available(text, date, date) to anon;

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
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_return <= p_pickup then
    return jsonb_build_object('success', false, 'reason', 'invalid_dates');
  end if;

  begin
    insert into reservations (
      car_id, car_name, customer_name, email, phone, date_of_birth,
      pickup_date, return_date, pickup_location, note
    ) values (
      p_car_id, p_car_name, p_customer_name, p_email, p_phone, p_dob,
      p_pickup, p_return, p_location, nullif(trim(p_note), '')
    )
    returning id into new_id;
  exception when exclusion_violation then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end;

  return jsonb_build_object('success', true, 'id', new_id);
end;
$$;

grant execute on function create_reservation(text, text, text, text, text, date, date, date, text, text) to anon;

-- ============================================================================
-- ADMIN PANEL — pristup za prijavljenog vlasnika (Supabase Auth)
-- ============================================================================
-- Admin email već podešen ispod: marsenic57@gmail.com
-- VAŽNO PRE POKRETANJA OVOG DELA:
-- 1. Napravi admin korisnika sa TOM istom adresom: Authentication -> Users
--    -> Add user (+ lozinka koju ćeš koristiti za prijavu na /admin).
-- 2. Obavezno: Authentication -> Providers -> Email -> isključi "Allow new
--    users to sign up" (ne želimo da bilo ko spolja napravi nalog i vidi
--    podatke kupaca). Detaljno uputstvo: README_ADMIN.md.

drop policy if exists admin_select_reservations on reservations;
create policy admin_select_reservations on reservations
  for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'marsenic57@gmail.com');

create or replace function cancel_reservation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.jwt() ->> 'email' is distinct from 'marsenic57@gmail.com' then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  update reservations set status = 'cancelled' where id = p_id and status = 'confirmed';

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function cancel_reservation(uuid) to authenticated;
