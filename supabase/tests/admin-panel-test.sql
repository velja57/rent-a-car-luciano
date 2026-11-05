-- Test baze za admin panel. Pokreni POSLE supabase/schema.sql:
-- Supabase Dashboard -> SQL Editor -> New query -> zalepi ceo fajl -> Run.
--
-- Test NIŠTA ne ostavlja u bazi i ne dira prave rezervacije: koristi izmišljeno
-- vozilo "test-vozilo-admin" i datume u 2099. godini, a ceo test je jedan blok
-- koji se na kraju NAMERNO prekida porukom o grešci, pa baza poništava sve što
-- je test upisao (i nijedan mejl se ne šalje).
--
-- Rezultat je u toj poruci, npr:
--   ERROR: REZULTAT TESTA: 92 od 92 provera uspešno. Sve je u redu.
-- Ako neka provera ne uspe, poruka nabraja koje.

do $test$
declare
  car constant text := 'test-vozilo-admin';
  admin_email text;
  total int := 0;
  passed int := 0;
  failed text[] := '{}';
  res jsonb;
  ok boolean;
  n bigint;
  id_a uuid;
  id_b uuid;
  id_c uuid;
  id_d uuid;
  id_e uuid;
  id_f uuid;
  id_g uuid;
  id_g2 uuid;
  id_h uuid;
  id_n uuid;
  refund_id uuid;
  num numeric;
  today_bg date := (now() at time zone 'Europe/Belgrade')::date;
begin
  select email into admin_email from admin_users order by created_at limit 1;

  -- =========================================================================
  -- 0. Priprema (kao vlasnik baze): test vozilo u cenovniku (40€/dan) i
  --    "stare" rezervacije bez snimka cene, samo sa tekstom obračuna.
  -- =========================================================================
  insert into price_list (car_id, price_per_day) values (car, 40)
  on conflict (car_id) do update set price_per_day = 40;

  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, price_summary)
  values (car, 'TEST vozilo', 'TEST Stara G', 'test@example.com', '060 111 222', '1990-01-01', '2099-11-01', '2099-11-03',
    'TEST', '2 dana × 38€ = 76€ · Ukupno 76€ (≈ 8.910 din)')
  returning id into id_g;
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, price_summary, language)
  values (car, 'TEST vozilo', 'TEST Stara G2', 'test@example.com', '060 111 222', '1990-01-01', '2099-11-10', '2099-11-13',
    'TEST', '3 days × €41 (−10%) = €123 · Child seat €9 · Total €132 (≈ 15,470 RSD)', 'en')
  returning id into id_g2;
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, price_summary)
  values (car, 'TEST vozilo', 'TEST Stara H', 'test@example.com', '060 111 222', '1990-01-01', '2099-11-20', '2099-11-22',
    'TEST', '3 dana × 38€ = 114€ · Ukupno 114€ (≈ 13.360 din)')
  returning id into id_h;
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, note)
  values (car, 'TEST vozilo', 'TEST Stara N', 'test@example.com', '060 111 222', '1990-01-01', '2099-11-25', '2099-11-27',
    'TEST', 'Kupac kasni | Procenjena cena: 2 dana × 50€ = 100€ · Ukupno 100€ (≈ 11.720 din) | Jezik kupca: engleski')
  returning id into id_n;

  res := (select reconstruct_reservation_price(r) from reservations r where r.id = id_g);
  ok := (res ->> 'daily_rate')::numeric = 38 and (res ->> 'rental_total')::numeric = 76 and (res ->> 'extras_total')::numeric = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('stara cena (srpski tekst) se rekonstruiše [%s]', res)); end if;

  res := (select reconstruct_reservation_price(r) from reservations r where r.id = id_g2);
  ok := (res ->> 'daily_rate')::numeric = 41 and (res ->> 'rental_total')::numeric = 123 and (res ->> 'extras_total')::numeric = 9
    and (res ->> 'total')::numeric = 132 and (res ->> 'discount_percent')::numeric = 10 and res -> 'list_price' = 'null'::jsonb;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('stara cena (engleski, popust, dodatak) se rekonstruiše [%s]', res)); end if;

  res := (select reconstruct_reservation_price(r) from reservations r where r.id = id_h);
  ok := res is null;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('stara cena koja se ne slaže sa datumima se NE popunjava [%s]', res)); end if;

  res := (select reconstruct_reservation_price(r) from reservations r where r.id = id_n);
  ok := (res ->> 'total')::numeric = 100 and (res ->> 'daily_rate')::numeric = 50;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('stara cena iz napomene se rekonstruiše [%s]', res)); end if;

  -- "Stare" rezervacije više ne trebaju (da ne utiču na brojanje u ostatku testa).
  delete from reservations where id in (id_g, id_g2, id_h, id_n);

  -- =========================================================================
  -- 1. Posetilac sajta (javni anon ključ)
  -- =========================================================================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  res := null;
  begin
    perform admin_list_reservations();
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'anon ne sme da pozove admin funkciju'); end if;

  begin
    perform payment_totals(gen_random_uuid());
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'anon ne sme da pozove pomoćnu funkciju'); end if;

  begin
    select count(*) into n from reservations;
    ok := n = 0;
  exception when insufficient_privilege then
    ok := true;
  end;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'anon ne vidi rezervacije'); end if;

  begin
    select count(*) into n from payments;
    ok := n = 0;
  exception when insufficient_privilege then
    ok := true;
  end;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'anon ne vidi uplate'); end if;

  res := get_price_list();
  ok := (res -> 'cars' ->> car)::integer = 40 and jsonb_array_length(res -> 'discounts') >= 1 and jsonb_array_length(res -> 'extras') >= 1;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'sajt može da pročita cenovnik'); end if;

  begin
    perform admin_set_car_price(car, 1);
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'anon ne sme da menja cenovnik'); end if;

  begin
    perform admin_fleet_usage('2099-01-01', '2099-01-31');
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'anon ne sme da vidi iskorišćenost flote'); end if;

  -- Rezervacija A sa sajta: 10.-12.6.2099 (2 dana) sa dečijim sedištem. Sajt
  -- "šalje" pogrešan iznos 120€ — baza mora da izračuna sama: 2 × 40 + 2 × 3 = 86€.
  res := create_reservation(car, 'TEST vozilo', 'TEST Kupac A', 'test@example.com', '060 111 222', '1990-01-01',
    '2099-06-10', '2099-06-12', 'TEST lokacija', 'TEST', 'sr', 'TEST 120€', 120, array['child-seat']);
  id_a := (res ->> 'id')::uuid;
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: nova rezervacija A [%s]', res)); end if;

  -- Preuzimanje na dan vraćanja A (12.6.) — dan vraćanja je zauzet.
  res := create_reservation(car, 'TEST vozilo', 'TEST Kupac X', 'test@example.com', '060 111 222', '1990-01-01',
    '2099-06-12', '2099-06-14', 'TEST lokacija', null);
  ok := res ->> 'reason' = 'unavailable';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: preuzimanje na dan vraćanja mora biti odbijeno [%s]', res)); end if;

  -- Rezervacija B od dana posle vraćanja A: 13.-15.6.2099, 90€.
  res := create_reservation(car, 'TEST vozilo', 'TEST Kupac B', 'test@example.com', '060 111 222', '1990-01-01',
    '2099-06-13', '2099-06-15', 'TEST lokacija', null, 'sr', null, 90, null);
  id_b := (res ->> 'id')::uuid;
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: rezervacija B dan posle vraćanja A [%s]', res)); end if;

  res := create_reservation(car, 'TEST vozilo', 'TEST Kupac', '', '060 111 222', '1990-01-01',
    '2099-08-01', '2099-08-03', 'TEST lokacija', null);
  ok := res ->> 'reason' = 'invalid_input';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: rezervacija bez emaila mora biti odbijena [%s]', res)); end if;

  res := create_reservation(car, 'TEST vozilo', 'TEST Kupac', 'test@example.com', '060 111 222', '1990-01-01',
    '2099-08-05', '2099-08-05', 'TEST lokacija', null);
  ok := res ->> 'reason' = 'invalid_dates';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: vraćanje isti dan kao preuzimanje mora biti odbijeno [%s]', res)); end if;

  ok := not is_car_available(car, '2099-06-11', '2099-06-13') and is_car_available(car, '2099-06-16', '2099-06-18');
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'sajt: provera dostupnosti'); end if;

  select count(*) into n from get_booked_dates(car);
  ok := n = 2;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: kalendar treba da vidi 2 zauzeta termina, vidi %s', n)); end if;

  reset role;

  -- =========================================================================
  -- 2. Prijavljen korisnik koji NIJE admin
  -- =========================================================================
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"neko-drugi@example.com"}', true);
  set local role authenticated;

  res := admin_list_reservations();
  ok := res ->> 'reason' = 'forbidden';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('ne-admin: lista mora biti zabranjena [%s]', left(res::text, 200))); end if;

  res := admin_set_status(id_a, 'cancelled');
  ok := res ->> 'reason' = 'forbidden';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('ne-admin: promena statusa mora biti zabranjena [%s]', res)); end if;

  res := cancel_reservation(id_a);
  ok := res ->> 'reason' = 'forbidden';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('ne-admin: otkazivanje mora biti zabranjeno [%s]', res)); end if;

  select count(*) into n from reservations;
  ok := n = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'ne-admin ne sme da vidi rezervacije'); end if;

  reset role;

  -- =========================================================================
  -- 3. Admin
  -- =========================================================================
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;

  res := admin_list_reservations(p_search => 'TEST Kupac', p_car_id => car);
  ok := (res ->> 'total')::int = 2;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: pretraga treba da nađe 2 test rezervacije [%s]', left(res::text, 200))); end if;

  res := admin_list_reservations(p_search => id_a::text);
  ok := (res ->> 'total')::int = 1 and res -> 'rows' -> 0 ->> 'id' = id_a::text;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: pretraga po ID-ju'); end if;

  res := admin_get_reservation(id_a);
  ok := (res -> 'reservation' ->> 'total_price')::numeric = 86
    and (res -> 'reservation' ->> 'rental_total')::numeric = 80
    and (res -> 'reservation' ->> 'extras_total')::numeric = 6
    and (res -> 'reservation' ->> 'daily_rate')::numeric = 40
    and (res -> 'reservation' ->> 'rental_days')::int = 2
    and res -> 'reservation' ->> 'price_source' = 'price_list'
    and res -> 'reservation' ->> 'source' = 'web'
    and res -> 'reservation' -> 'extras' = '["child-seat"]'::jsonb
    and (res -> 'reservation' ->> 'days')::int = 2;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('baza sama računa cenu A: 2 × 40 + dodatak 6 = 86 (ne 120 sa sajta) [%s]', left(res::text, 400))); end if;

  ok := res -> 'reservation' ->> 'note' like '%Upozorenje: kupac je na sajtu video 120%po cenovniku je 86%';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('upozorenje kad se iznos sa sajta razlikuje od cenovnika [%s]', res -> 'reservation' ->> 'note')); end if;

  select count(*) into n from reservations where car_id = car;
  ok := n = 2;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin treba da vidi rezervacije (RLS)'); end if;

  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac X',
    p_phone => '060 111 222', p_pickup => '2099-06-14', p_return => '2099-06-16', p_location => 'TEST lokacija');
  ok := res ->> 'reason' = 'unavailable';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: preklapanje sa B mora biti odbijeno [%s]', res)); end if;

  -- Telefonska rezervacija C, bez emaila i datuma rođenja: 1.-3.7.2099, dogovoreno 50€/dan -> 100€.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac C',
    p_phone => '060 111 222', p_pickup => '2099-07-01', p_return => '2099-07-03', p_location => 'TEST lokacija',
    p_pickup_time => '10:00', p_daily_rate => 50);
  id_c := (res ->> 'id')::uuid;
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_c);
  ok := ok and res -> 'reservation' ->> 'source' = 'admin' and res -> 'reservation' ->> 'email' is null
    and (res -> 'reservation' ->> 'total_price')::numeric = 100
    and res -> 'reservation' ->> 'price_source' = 'admin';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: telefonska rezervacija C [%s]', left(res::text, 300))); end if;

  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST',
    p_phone => '12', p_pickup => '2099-09-01', p_return => '2099-09-02', p_location => 'TEST');
  ok := res ->> 'reason' = 'invalid_phone';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: neispravan telefon mora biti odbijen [%s]', res)); end if;

  res := admin_update_reservation(p_id => id_b, p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac B',
    p_phone => '060 111 222', p_pickup => '2099-06-11', p_return => '2099-06-15', p_location => 'TEST lokacija',
    p_email => 'test@example.com', p_dob => '1990-01-01', p_daily_rate => 40);
  ok := res ->> 'reason' = 'unavailable';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: izmena B koja se preklapa sa A mora biti odbijena [%s]', res)); end if;

  -- B produžena do 16.6. uz istu cenu po danu (40€): 3 × 40 = 120€, poreklo cene ostaje "cenovnik".
  res := admin_update_reservation(p_id => id_b, p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac B',
    p_phone => '060 111 222', p_pickup => '2099-06-13', p_return => '2099-06-16', p_location => 'TEST lokacija',
    p_email => 'test@example.com', p_dob => '1990-01-01', p_daily_rate => 40);
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_b);
  ok := ok and (res -> 'reservation' ->> 'total_price')::numeric = 120
    and (res -> 'reservation' ->> 'rental_days')::int = 3
    and res -> 'reservation' ->> 'price_source' = 'price_list';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: izmena B (produžen najam po istoj ceni 3 × 40 = 120) [%s]', left(res::text, 300))); end if;

  res := admin_check_availability(car, '2099-06-13', '2099-06-16', id_b);
  ok := (res ->> 'available')::boolean;
  res := admin_check_availability(car, '2099-06-13', '2099-06-16');
  ok := ok and not (res ->> 'available')::boolean and jsonb_array_length(res -> 'conflicts') = 1;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: provera dostupnosti sa/bez tekuće rezervacije [%s]', res)); end if;

  res := admin_set_status(id_a, 'completed');
  ok := res ->> 'reason' = 'invalid_transition';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: potvrđena -> završena bez preuzimanja mora biti odbijeno [%s]', res)); end if;

  res := admin_set_status(id_a, 'picked_up');
  ok := (res ->> 'success')::boolean;
  res := admin_set_status(id_a, 'completed');
  ok := ok and (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: A potvrđena -> preuzeta -> završena [%s]', res)); end if;

  res := admin_check_availability(car, '2099-06-10', '2099-06-11');
  ok := not (res ->> 'available')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: završena rezervacija i dalje zauzima svoje dane'); end if;

  -- Otkazivanje B oslobađa 13.-16.6. — D ih zauzima.
  res := admin_set_status(id_b, 'cancelled');
  ok := (res ->> 'success')::boolean;
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac D',
    p_phone => '060 111 222', p_pickup => '2099-06-13', p_return => '2099-06-16', p_location => 'TEST lokacija');
  id_d := (res ->> 'id')::uuid;
  ok := ok and (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: otkazivanje oslobađa termin [%s]', res)); end if;

  res := admin_set_status(id_b, 'confirmed');
  ok := res ->> 'reason' = 'unavailable';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: ponovna aktivacija B mora biti odbijena dok D drži termin [%s]', res)); end if;

  res := admin_set_status(id_d, 'no_show');
  ok := (res ->> 'success')::boolean;
  res := admin_set_status(id_b, 'confirmed');
  ok := ok and (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: "nije se pojavio" oslobađa termin, B ponovo aktivna [%s]', res)); end if;

  res := admin_set_status(id_d, 'confirmed');
  ok := res ->> 'reason' = 'invalid_transition';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: "nije se pojavio" se ne vraća u potvrđenu [%s]', res)); end if;

  -- Uplate na A (iznos 86€): avans 50 + 30, povraćaj 10, kaucija 300, vraćeno 100.
  res := admin_add_payment(id_a, 'payment', 50, 'cash', '2099-06-10', 'TEST avans');
  ok := (res ->> 'success')::boolean;
  res := admin_add_payment(id_a, 'payment', 30, 'card', '2099-06-12');
  ok := ok and (res ->> 'success')::boolean;
  res := admin_add_payment(id_a, 'refund', 10, 'cash', '2099-06-12');
  refund_id := (res ->> 'id')::uuid;
  ok := ok and (res ->> 'success')::boolean;
  res := admin_add_payment(id_a, 'deposit_received', 300, 'cash', '2099-06-10');
  ok := ok and (res ->> 'success')::boolean;
  res := admin_add_payment(id_a, 'deposit_returned', 100, 'cash', '2099-06-12');
  ok := ok and (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: unos uplata [%s]', res)); end if;

  res := admin_get_reservation(id_a);
  ok := (res -> 'reservation' ->> 'net_paid')::numeric = 70
    and (res -> 'reservation' ->> 'balance')::numeric = 16
    and (res -> 'reservation' ->> 'deposit_held')::numeric = 200;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: A uplaćeno 70, preostalo 16, kaucija 200 [%s]', left(res -> 'reservation' ->> 'net_paid', 20))); end if;

  res := admin_void_payment(refund_id, 'TEST greška');
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_a);
  ok := ok
    and (res -> 'reservation' ->> 'net_paid')::numeric = 80
    and (res -> 'reservation' ->> 'balance')::numeric = 6
    and jsonb_array_length(res -> 'payments') = 5;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: poništen povraćaj — uplaćeno 80, preostalo 6, stavka ostaje zabeležena'); end if;

  res := admin_void_payment(refund_id);
  ok := res ->> 'reason' = 'not_found';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: ista stavka se ne poništava dvaput'); end if;

  res := admin_add_payment(id_a, 'payment', -5);
  ok := res ->> 'reason' = 'invalid_amount';
  res := admin_add_payment(id_a, 'poklon', 5);
  ok := ok and res ->> 'reason' = 'invalid_kind';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: neispravna uplata mora biti odbijena'); end if;

  -- Istorija A: nastanak (sa sajta), 2 promene statusa, 5 uplata, 1 poništenje.
  res := admin_get_reservation(id_a);
  ok := jsonb_array_length(res -> 'events') = 9
    and exists (
      select 1 from jsonb_array_elements(res -> 'events') e
      where e ->> 'action' = 'created' and e ->> 'actor' = 'sajt'
    )
    and exists (
      select 1 from jsonb_array_elements(res -> 'events') e
      where e ->> 'action' = 'status_changed' and e ->> 'actor' = admin_email
    );
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: istorija promena A (očekivano 9 stavki, ima %s)', jsonb_array_length(res -> 'events'))); end if;

  -- Finansije 1.6.-31.7.2099: aktivne A 86 + B 120 + C 100 = 306 (D "nije se
  -- pojavio" se ne računa); naplaćeno 80; preostalo 6 + 120 + 100 = 226.
  res := admin_finance_summary('2099-06-01', '2099-07-31');
  ok := (res -> 'booked' ->> 'value')::numeric = 306
    and (res -> 'booked' ->> 'count')::int = 3
    and (res -> 'booked' ->> 'without_price')::int = 0
    and (res -> 'payments' ->> 'collected')::numeric = 80
    and (res -> 'payments' ->> 'refunded')::numeric = 0
    and (res -> 'payments' ->> 'deposits_received')::numeric = 300
    and (res ->> 'outstanding')::numeric = 226
    and (res -> 'status_counts' ->> 'confirmed')::int = 2
    and (res -> 'status_counts' ->> 'no_show')::int = 1;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('finansije: vrednost/naplaćeno/preostalo [%s]', left(res::text, 400))); end if;

  ok := jsonb_array_length(res -> 'by_month') = 2
    and (res -> 'by_month' -> 0 ->> 'booked')::numeric = 206
    and (res -> 'by_month' -> 0 ->> 'collected')::numeric = 80
    and (res -> 'by_month' -> 1 ->> 'booked')::numeric = 100
    and res -> 'by_vehicle' -> 0 ->> 'car_id' = car
    and (res -> 'by_vehicle' -> 0 ->> 'booked')::numeric = 306;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'finansije: po mesecima i po vozilu'); end if;

  res := cancel_reservation(id_c);
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: staro dugme "Otkaži" i dalje radi [%s]', res)); end if;

  res := admin_upsert_vehicle(car, 'bg-test-01', 'TEST');
  ok := (res ->> 'success')::boolean;
  res := admin_list_reservations(p_search => 'BG-TEST-01');
  ok := ok and (res ->> 'total')::int = 4;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: registarska oznaka se čuva i pretraga je nalazi'); end if;

  res := admin_calendar('2099-06-01', '2099-07-31');
  select count(*) into n from jsonb_array_elements(res -> 'rows') e where e ->> 'car_id' = car;
  ok := n = 4;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('kalendar: očekivane 4 test rezervacije, ima %s', n)); end if;

  res := admin_overview();
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('pregled [%s]', left(res::text, 200))); end if;

  -- =========================================================================
  -- 4. Cenovnik, snimak cene i prihodi (admin)
  -- =========================================================================
  res := admin_set_car_price(car, 45);
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_a);
  ok := ok and (res -> 'reservation' ->> 'total_price')::numeric = 86 and (res -> 'reservation' ->> 'daily_rate')::numeric = 40;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'promena cene 40 -> 45 ne menja staru rezervaciju A (i dalje 2 × 40 + 6 = 86)'); end if;

  -- F sa sajta posle promene cene: 30.8.-2.9.2099 = 3 dana, popust 10% -> 45 × 0,9 = 40,5 -> 41 € -> 123 €.
  res := create_reservation(car, 'TEST vozilo', 'TEST Kupac F', 'test@example.com', '060 111 222', '1990-01-01',
    '2099-08-30', '2099-09-02', 'TEST lokacija', null, 'sr', null, 123, null);
  id_f := (res ->> 'id')::uuid;
  res := admin_get_reservation(id_f);
  ok := (res -> 'reservation' ->> 'total_price')::numeric = 123
    and (res -> 'reservation' ->> 'daily_rate')::numeric = 41
    and (res -> 'reservation' ->> 'list_price')::numeric = 45
    and (res -> 'reservation' ->> 'discount_percent')::numeric = 10
    and res -> 'reservation' ->> 'note' is null;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('nova rezervacija po novoj ceni (3 dana × 41 = 123), bez upozorenja kad se iznos slaže [%s]', left(res::text, 300))); end if;

  res := admin_quote(car, '2099-08-30', '2099-09-02', array['child-seat', 'nepostoji']);
  ok := (res -> 'quote' ->> 'total')::numeric = 132 and res -> 'quote' -> 'extras' = '["child-seat"]'::jsonb;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('predlog cene za admin formu (123 + 3 × 3 = 132, nepoznat dodatak se ignoriše) [%s]', res)); end if;

  res := admin_revenue('2099-08-01', '2099-08-31', 'rental', 'booked', car);
  ok := (res -> 'totals' ->> 'rental')::numeric = 82 and (res -> 'totals' ->> 'reservations')::int = 1;
  res := admin_revenue('2099-09-01', '2099-09-30', 'rental', 'booked', car);
  ok := ok and (res -> 'totals' ->> 'rental')::numeric = 41;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('rezervacija preko granice meseca: avgust 82 (2 dana), septembar 41 (1 dan) [%s]', left(res::text, 300))); end if;

  -- Izmena datuma F (ista cena po danu): 1.-4.9. -> sve u septembru, ništa u avgustu, bez dupliranja.
  res := admin_update_reservation(p_id => id_f, p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac F',
    p_phone => '060 111 222', p_pickup => '2099-09-01', p_return => '2099-09-04', p_location => 'TEST lokacija',
    p_email => 'test@example.com', p_dob => '1990-01-01', p_daily_rate => 41);
  ok := (res ->> 'success')::boolean;
  res := admin_revenue('2099-08-01', '2099-08-31', 'rental', 'booked', car);
  ok := ok and (res -> 'totals' ->> 'total')::numeric = 0;
  res := admin_revenue('2099-08-01', '2099-09-30', 'rental', 'booked', car);
  ok := ok and (res -> 'totals' ->> 'total')::numeric = 123 and jsonb_array_length(res -> 'daily') = 3;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('izmena datuma: analitika koristi nove datume, iznos se ne duplira [%s]', left(res::text, 300))); end if;

  -- E: 1.-4.10.2099 (3 dana) po 30 € = 90 €, pa povraćaj 10 € -> prihod 80 €.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac E',
    p_phone => '060 111 222', p_pickup => '2099-10-01', p_return => '2099-10-04', p_location => 'TEST lokacija',
    p_daily_rate => 30);
  id_e := (res ->> 'id')::uuid;
  res := admin_add_payment(id_e, 'refund', 10, 'cash', '2099-10-05');
  res := admin_revenue('2099-10-01', '2099-10-31', 'rental', 'booked', car);
  ok := (res -> 'totals' ->> 'total')::numeric = 80 and (res -> 'cash' ->> 'refunded')::numeric = 10;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('povraćaj umanjuje prihod (90 − 10 = 80) [%s]', left(res::text, 300))); end if;

  -- Jun: A (završena, 86) + B (potvrđena, 120). Realizovano = samo završene.
  res := admin_revenue('2099-06-01', '2099-06-30', 'rental', 'booked', car);
  ok := (res -> 'totals' ->> 'total')::numeric = 206
    and (res -> 'totals' ->> 'rental')::numeric = 200
    and (res -> 'totals' ->> 'extras')::numeric = 6
    and (res -> 'totals' ->> 'reservations')::int = 2
    and jsonb_array_length(res -> 'reservations') = 2;
  res := admin_revenue('2099-06-01', '2099-06-30', 'rental', 'realized', car);
  ok := ok and (res -> 'totals' ->> 'total')::numeric = 86;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('analitika jun: ugovoreno 206 (najam 200 + dodaci 6), realizovano 86 [%s]', left(res::text, 300))); end if;

  res := admin_set_status(id_b, 'cancelled');
  res := admin_revenue('2099-06-01', '2099-06-30', 'rental', 'booked', car);
  ok := (res -> 'totals' ->> 'total')::numeric = 86;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('otkazana rezervacija se ne računa u prihod [%s]', left(res::text, 200))); end if;

  -- Po datumu rezervacije: sve aktivne test rezervacije su napravljene danas:
  -- A 86 + F 123 + E 80 = 289 (B i C otkazane, D "nije se pojavio").
  res := admin_revenue(today_bg, today_bg, 'booking', 'booked', car);
  ok := (res -> 'totals' ->> 'total')::numeric = 289 and (res -> 'totals' ->> 'reservations')::int = 3;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('analitika po datumu rezervacije (ceo iznos na dan rezervacije) [%s]', left(res::text, 300))); end if;

  res := admin_revenue('2099-01-01', '2099-12-31', 'rental', 'booked', null);
  ok := (res ->> 'success')::boolean
    and exists (select 1 from jsonb_array_elements(res -> 'by_car') c where c ->> 'car_id' = car and (c ->> 'total')::numeric = 289);
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('analitika cele flote: test vozilo 289 u 2099. [%s]', left(res::text, 300))); end if;

  -- Iskorišćenost, jun 2099: samo A (završena, 10.-12.6. = 2 dana najma, 86 €) — B je
  -- otkazana, D "nije se pojavio". Dan vraćanja (12.6.) se ne računa.
  res := admin_fleet_usage('2099-06-01', '2099-06-30', 'booked', car);
  ok := (res ->> 'period_days')::int = 30
    and jsonb_array_length(res -> 'cars') = 1
    and (res -> 'cars' -> 0 ->> 'rented_days')::int = 2
    and (res -> 'cars' -> 0 ->> 'priced_days')::int = 2
    and (res -> 'cars' -> 0 ->> 'revenue')::numeric = 86;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('iskorišćenost jun: 2 dana u najmu od 30, prihod 86 € (ADR 43 €) [%s]', res)); end if;

  -- Deo rezervacije u periodu: F 1.-4.9. (3 dana), period od 2.9. -> 2.9. i 3.9. = 2 dana, 82 €.
  res := admin_fleet_usage('2099-09-02', '2099-09-30', 'booked', car);
  ok := (res -> 'cars' -> 0 ->> 'rented_days')::int = 2 and (res -> 'cars' -> 0 ->> 'revenue')::numeric = 82;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('iskorišćenost: računa se samo deo rezervacije koji pada u period (2 dana, 82 €) [%s]', res)); end if;

  -- Rezervacija bez cene (1.-5.12.2099, 4 dana) zauzima vozilo, ali ne ulazi u ADR.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac bez cene',
    p_phone => '060 111 222', p_pickup => '2099-12-01', p_return => '2099-12-05', p_location => 'TEST lokacija');
  res := admin_fleet_usage('2099-12-01', '2099-12-31', 'booked', car);
  ok := (res -> 'cars' -> 0 ->> 'rented_days')::int = 4
    and (res -> 'cars' -> 0 ->> 'priced_days')::int = 0
    and (res -> 'cars' -> 0 ->> 'revenue')::numeric = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('rezervacija bez cene: 4 dana zauzeto, 0 dana za ADR [%s]', res)); end if;

  -- Realizovano = samo završene: F je potvrđena, pa septembar nema dana u najmu.
  res := admin_fleet_usage('2099-09-01', '2099-09-30', 'realized', car);
  ok := jsonb_array_length(res -> 'cars') = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('iskorišćenost "realizovano" broji samo završene [%s]', res)); end if;

  reset role;

  -- =========================================================================
  -- 5. Raspodela po danima (kao vlasnik baze — interna funkcija)
  -- =========================================================================
  select count(*), sum(l.rental) into n, num
  from revenue_lines('2099-10-01', '2099-10-31', 'rental', array['confirmed', 'picked_up', 'completed'], car) l
  where l.reservation_id = id_e;
  ok := n = 3 and num = 80;
  select max(l.rental) - min(l.rental) into num
  from revenue_lines('2099-10-01', '2099-10-31', 'rental', array['confirmed', 'picked_up', 'completed'], car) l
  where l.reservation_id = id_e;
  ok := ok and num = 0.01;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'zaokruživanje: 80 € na 3 dana = 26,67 + 26,67 + 26,66, zbir tačno 80'); end if;

  select count(*), sum(l.rental) into n, num
  from revenue_lines('2099-06-01', '2099-06-30', 'rental', array['confirmed', 'picked_up', 'completed'], car) l
  where l.reservation_id = id_a;
  ok := n = 2 and num = 80;
  select sum(l.extras) into num
  from revenue_lines('2099-06-01', '2099-06-30', 'rental', array['confirmed', 'picked_up', 'completed'], car) l
  where l.reservation_id = id_a;
  ok := ok and num = 6;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'A po danima: 10.6. i 11.6. po 40 € najma (dan vraćanja se ne računa), dodaci 6 € odvojeno'); end if;

  -- =========================================================================
  -- 6. Limiti za rezervacije sa sajta (zaštita od lažnih rezervacija)
  -- =========================================================================
  -- Tri buduće rezervacije sa istim kontaktom, napravljene pre 2 dana (ne ulaze
  -- u limit po satu).
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, created_at)
  select car, 'TEST vozilo', 'TEST Limit ' || g, 'limit@example.com', '061 999 0001', '1990-01-01',
    make_date(2098, g, 1), make_date(2098, g, 3), 'TEST', now() - interval '2 days'
  from generate_series(1, 3) g;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  -- 1.5.-1.6.2098 = 31 dan -> odbijeno; 1.5.-31.5.2098 = 30 dana -> prolazi.
  res := create_reservation(car, 'TEST vozilo', 'TEST Dugi', 'dugi@example.com', '062 333 4444', '1990-01-01',
    '2098-05-01', '2098-06-01', 'TEST lokacija', null);
  ok := res ->> 'reason' = 'too_long';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: najam duži od 30 dana mora biti odbijen [%s]', res)); end if;

  res := create_reservation(car, 'TEST vozilo', 'TEST Dugi', 'dugi@example.com', '062 333 4444', '1990-01-01',
    '2098-05-01', '2098-05-31', 'TEST lokacija', null);
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: najam od tačno 30 dana prolazi [%s]', res)); end if;

  -- Četvrta buduća rezervacija istog kontakta: isti telefon u drugom zapisu, pa
  -- isti email velikim slovima -> oba odbijena.
  res := create_reservation(car, 'TEST vozilo', 'TEST Limit 4', 'drugi@example.com', '+381 61 999 0001', '1990-01-01',
    '2098-07-01', '2098-07-03', 'TEST lokacija', null);
  ok := res ->> 'reason' = 'too_many';
  res := create_reservation(car, 'TEST vozilo', 'TEST Limit 5', 'LIMIT@example.com', '063 777 8888', '1990-01-01',
    '2098-08-01', '2098-08-03', 'TEST lokacija', null);
  ok := ok and res ->> 'reason' = 'too_many';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: najviše 3 buduće rezervacije po telefonu ili emailu [%s]', res)); end if;

  reset role;

  -- Popuna do 30 rezervacija sa sajta u poslednjih sat vremena (računajući i
  -- prave, ako ih ima), pa sledeća sa sajta mora biti odbijena.
  select count(*) into n from reservations where source = 'web' and created_at > now() - interval '1 hour';
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location)
  select car, 'TEST vozilo', 'TEST Popuna ' || g, 'popuna' || g || '@example.com', '064 000 ' || lpad(g::text, 4, '0'),
    '1990-01-01', make_date(2097, 1, 1) + g * 3, make_date(2097, 1, 1) + g * 3 + 1, 'TEST'
  from generate_series(1, greatest(30 - n, 0)::int) g;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  res := create_reservation(car, 'TEST vozilo', 'TEST Novi', 'novi@example.com', '065 123 4567', '1990-01-01',
    '2097-06-01', '2097-06-03', 'TEST lokacija', null);
  ok := res ->> 'reason' = 'rate_limited';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('sajt: najviše 30 rezervacija sa sajta na sat [%s]', res)); end if;
  reset role;

  -- Admin panel nema ova ograničenja: najam od 40 dana dok je limit po satu dostignut.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Dugi admin',
    p_phone => '061 999 0001', p_pickup => '2097-07-01', p_return => '2097-08-10', p_location => 'TEST lokacija');
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: telefonska rezervacija od 40 dana nema limite sajta [%s]', res)); end if;
  reset role;

  -- =========================================================================
  -- 7. Spisak uplata u periodu (stavke iza "Naplaćeno u periodu")
  -- =========================================================================
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"neko-drugi@example.com"}', true);
  set local role authenticated;
  res := admin_list_payments('2099-06-01', '2099-06-30', car);
  ok := res ->> 'reason' = 'forbidden';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('ne-admin: spisak uplata mora biti zabranjen [%s]', res)); end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;

  -- Jun, A: uplate 50 i 30 (obe sa datumom preuzimanja 10.6.); poništen povraćaj i
  -- kaucija se ne prikazuju.
  res := admin_list_payments('2099-06-01', '2099-06-30', car);
  ok := jsonb_array_length(res -> 'rows') = 2
    and (select array_agg((r ->> 'amount')::numeric order by (r ->> 'amount')::numeric) from jsonb_array_elements(res -> 'rows') r) = array[30, 50]::numeric[]
    and (select bool_and((r ->> 'paid_at')::date = '2099-06-10') from jsonb_array_elements(res -> 'rows') r)
    and (res -> 'rows' -> 0 -> 'reservation' ->> 'id')::uuid = id_a
    and (res -> 'rows' -> 0 -> 'reservation' ->> 'balance')::numeric = 6;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('spisak uplata jun: 30 i 50 € sa datumom preuzimanja, bez poništenih i kaucije; A preostalo 6 € [%s]', left(res::text, 300))); end if;

  -- Uplata na otkazanoj B i preplata A: obe su u spisku, zbir = "Naplaćeno neto".
  -- Datum uplate je datum preuzimanja: B 13.6. (najnovija), A 10.6.
  res := admin_add_payment(id_b, 'payment', 20, 'cash', '2099-06-20');
  res := admin_add_payment(id_a, 'payment', 100, 'bank', '2099-06-25');
  res := admin_list_payments('2099-06-01', '2099-06-30', car);
  ok := jsonb_array_length(res -> 'rows') = 4
    and (res -> 'rows' -> 0 ->> 'paid_at')::date = '2099-06-13'
    and (res -> 'rows' -> 0 -> 'reservation' ->> 'status') = 'cancelled'
    and (res -> 'rows' -> 0 -> 'reservation' -> 'balance') = 'null'::jsonb
    and (res -> 'rows' -> 1 -> 'reservation' ->> 'balance')::numeric = -94
    and (select sum(case when r ->> 'kind' = 'refund' then -1 else 1 end * (r ->> 'amount')::numeric)
         from jsonb_array_elements(res -> 'rows') r)
      = (admin_revenue('2099-06-01', '2099-06-30', 'rental', 'booked', car) -> 'cash' ->> 'collected')::numeric;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('spisak uplata: preplaćeno (−94 €), uplata na otkazanoj, zbir = naplaćeno neto [%s]', left(res::text, 400))); end if;

  -- Povraćaj E (5.10.) je u spisku; filter po vozilu.
  res := admin_list_payments('2099-10-01', '2099-10-31', car);
  ok := jsonb_array_length(res -> 'rows') = 1 and res -> 'rows' -> 0 ->> 'kind' = 'refund';
  res := admin_list_payments('2099-10-01', '2099-10-31', 'nepostojece-vozilo');
  ok := ok and jsonb_array_length(res -> 'rows') = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('spisak uplata: povraćaj u oktobru, filter po vozilu [%s]', res)); end if;

  res := admin_list_payments('2099-06-30', '2099-06-01', car);
  ok := res ->> 'reason' = 'invalid_range';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('spisak uplata: neispravan period [%s]', res)); end if;
  reset role;

  -- =========================================================================
  -- 8. Rezervacije koje analitika ne može da uračuna — po imenu
  -- =========================================================================
  -- Stara rezervacija sa dodatkom: poznat je samo ukupan iznos (54 €), bez
  -- podele na najam i dodatke (kao pre prebacivanja cenovnika u bazu).
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, total_price, extras)
  values (car, 'TEST vozilo', 'TEST Bez podele', 'test@example.com', '060 111 222', '1990-01-01', '2099-12-10', '2099-12-12',
    'TEST', 54, array['child-seat']);

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;
  -- Decembar: "TEST Kupac bez cene" (1.-5.12., iznos nije unet) i "TEST Bez podele" (10.-12.12., 54 €).
  res := admin_revenue('2099-12-01', '2099-12-31', 'rental', 'booked', car);
  ok := (res ->> 'unpriced')::int = 2
    and jsonb_array_length(res -> 'unpriced_reservations') = 2
    and res -> 'unpriced_reservations' -> 0 ->> 'customer_name' = 'TEST Kupac bez cene'
    and res -> 'unpriced_reservations' -> 0 -> 'total_price' = 'null'::jsonb
    and res -> 'unpriced_reservations' -> 1 ->> 'customer_name' = 'TEST Bez podele'
    and (res -> 'unpriced_reservations' -> 1 ->> 'total_price')::numeric = 54
    and (res -> 'totals' ->> 'total')::numeric = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('analitika navodi rezervacije bez cene po imenu (bez iznosa / 54 € bez podele) [%s]', left(res::text, 400))); end if;
  reset role;

  -- =========================================================================
  -- 9. Preuzimanje vozila = naplata celog iznosa (admin_pickup)
  -- =========================================================================
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"neko-drugi@example.com"}', true);
  set local role authenticated;
  res := admin_pickup(id_f, 'cash');
  ok := res ->> 'reason' = 'forbidden';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('ne-admin: preuzimanje mora biti zabranjeno [%s]', res)); end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;

  -- P1: 1.-3.3.2099, 2 × 50 = 100 €. Bez načina plaćanja -> odbijeno, ništa se ne menja.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Preuzimanje 1',
    p_phone => '060 111 222', p_pickup => '2099-03-01', p_return => '2099-03-03', p_location => 'TEST lokacija',
    p_daily_rate => 50);
  id_g := (res ->> 'id')::uuid;
  res := admin_pickup(id_g, 'bank');
  ok := res ->> 'reason' = 'invalid_method';
  res := admin_get_reservation(id_g);
  ok := ok and res -> 'reservation' ->> 'status' = 'confirmed' and jsonb_array_length(res -> 'payments') = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('preuzimanje: način plaćanja mora biti gotovina ili kartica, ništa se ne upisuje [%s]', left(res::text, 300))); end if;

  -- Gotovina: status "preuzeta" + uplata 100 € sa danom stvarnog preuzimanja (danas), tačno
  -- vreme preuzimanja je zabeleženo, u istoriji oba događaja.
  res := admin_pickup(id_g, 'cash');
  ok := (res ->> 'success')::boolean and (res ->> 'paid')::numeric = 100;
  res := admin_get_reservation(id_g);
  ok := ok and res -> 'reservation' ->> 'status' = 'picked_up'
    and (res -> 'reservation' ->> 'net_paid')::numeric = 100
    and (res -> 'reservation' ->> 'balance')::numeric = 0
    and jsonb_array_length(res -> 'payments') = 1
    and res -> 'payments' -> 0 ->> 'method' = 'cash'
    and (res -> 'payments' -> 0 ->> 'paid_at')::date = today_bg
    and res -> 'reservation' ->> 'picked_up_at' is not null
    and exists (select 1 from jsonb_array_elements(res -> 'events') e where e ->> 'action' = 'payment_added')
    and exists (select 1 from jsonb_array_elements(res -> 'events') e where e ->> 'action' = 'status_changed');
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('preuzimanje: status "preuzeta", vreme preuzimanja i uplata celog iznosa 100 € (gotovina, dan preuzimanja) [%s]', left(res::text, 400))); end if;

  res := admin_pickup(id_g, 'cash');
  ok := res ->> 'reason' = 'invalid_transition';
  res := admin_get_reservation(id_g);
  ok := ok and jsonb_array_length(res -> 'payments') = 1;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('preuzimanje se ne beleži dvaput (nema duple uplate) [%s]', left(res::text, 200))); end if;

  -- P2: bez cene -> ne može da se preuzme dok se ne upiše cena.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Preuzimanje 2',
    p_phone => '060 111 222', p_pickup => '2099-03-10', p_return => '2099-03-12', p_location => 'TEST lokacija');
  id_h := (res ->> 'id')::uuid;
  res := admin_pickup(id_h, 'card');
  ok := res ->> 'reason' = 'no_price';
  res := admin_get_reservation(id_h);
  ok := ok and res -> 'reservation' ->> 'status' = 'confirmed' and jsonb_array_length(res -> 'payments') = 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('preuzimanje bez cene je odbijeno [%s]', left(res::text, 200))); end if;

  -- P3: 3 × 50 = 150 €, ranije upisano 40 € -> kartica 110 €. P4: već plaćeno 100 € -> samo status.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Preuzimanje 3',
    p_phone => '060 111 222', p_pickup => '2099-03-20', p_return => '2099-03-23', p_location => 'TEST lokacija',
    p_daily_rate => 50);
  id_n := (res ->> 'id')::uuid;
  res := admin_add_payment(id_n, 'payment', 40, 'cash', '2099-03-01');
  res := admin_pickup(id_n, 'card');
  ok := (res ->> 'paid')::numeric = 110;
  res := admin_get_reservation(id_n);
  ok := ok and (res -> 'reservation' ->> 'net_paid')::numeric = 150 and (res -> 'reservation' ->> 'balance')::numeric = 0;
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Preuzimanje 4',
    p_phone => '060 111 222', p_pickup => '2099-04-01', p_return => '2099-04-03', p_location => 'TEST lokacija',
    p_daily_rate => 50);
  id_g2 := (res ->> 'id')::uuid;
  res := admin_add_payment(id_g2, 'payment', 100, 'card', '2099-03-25');
  res := admin_pickup(id_g2);
  ok := ok and (res ->> 'success')::boolean and (res ->> 'paid')::numeric = 0;
  res := admin_get_reservation(id_g2);
  ok := ok and res -> 'reservation' ->> 'status' = 'picked_up' and jsonb_array_length(res -> 'payments') = 1;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('preuzimanje: upisuje se samo ostatak (110 €), a već plaćena se samo preuzima [%s]', left(res::text, 300))); end if;
  reset role;

  -- =========================================================================
  -- 10. Datum uplate = datum preuzimanja vozila
  -- =========================================================================
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;

  -- P3 je preuzeta danas: i ranije upisana uplata i uplata pri preuzimanju nose dan
  -- stvarnog preuzimanja; povraćaj zadržava svoj datum.
  res := admin_add_payment(id_n, 'refund', 5, 'cash', '2099-04-02');
  res := admin_get_reservation(id_n);
  ok := (select bool_and((p ->> 'paid_at')::date = today_bg) from jsonb_array_elements(res -> 'payments') p where p ->> 'kind' = 'payment')
    and (select count(*) from jsonb_array_elements(res -> 'payments') p where p ->> 'kind' = 'payment') = 2
    and exists (select 1 from jsonb_array_elements(res -> 'payments') p where p ->> 'kind' = 'refund' and (p ->> 'paid_at')::date = '2099-04-02');
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('datum uplate je dan preuzimanja vozila (povraćaj zadržava svoj) [%s]', left(res -> 'payments' ->> 0, 300))); end if;

  -- P2 (10.3., još nije preuzeta): upisana uplata nosi datum preuzimanja iz rezervacije
  -- i pomera se kad se taj datum izmeni (9.3.).
  res := admin_add_payment(id_h, 'payment', 10, 'cash', '2099-01-01');
  res := admin_update_reservation(p_id => id_h, p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Preuzimanje 2',
    p_phone => '060 111 222', p_pickup => '2099-03-09', p_return => '2099-03-12', p_location => 'TEST lokacija');
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_h);
  ok := ok and (res -> 'payments' -> 0 ->> 'paid_at')::date = '2099-03-09';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('pre preuzimanja: promena datuma preuzimanja pomera datum uplate [%s]', left(res -> 'payments' ->> 0, 300))); end if;
  reset role;

  -- =========================================================================
  -- 11. Poništeno preuzimanje i vraćanje vozila
  -- =========================================================================
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"neko-drugi@example.com"}', true);
  set local role authenticated;
  res := admin_undo_pickup(id_g);
  ok := res ->> 'reason' = 'forbidden';
  res := admin_return(id_g);
  ok := ok and res ->> 'reason' = 'forbidden';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;

  -- P1 (preuzeta, naplaćeno 100 €): poništavanje -> potvrđena, bez vremena preuzimanja,
  -- naplata poništena (ostaje zapisana), u istoriji razlog.
  res := admin_undo_pickup(id_g);
  ok := ok and (res ->> 'success')::boolean and (res ->> 'voided')::numeric = 100;
  res := admin_get_reservation(id_g);
  ok := ok and res -> 'reservation' ->> 'status' = 'confirmed'
    and res -> 'reservation' -> 'picked_up_at' = 'null'::jsonb
    and (res -> 'reservation' ->> 'net_paid')::numeric = 0
    and jsonb_array_length(res -> 'payments') = 1
    and res -> 'payments' -> 0 ->> 'voided_at' is not null
    and exists (select 1 from jsonb_array_elements(res -> 'events') e
                where e ->> 'action' = 'payment_voided' and e -> 'changes' ->> 'reason' = 'Poništeno preuzimanje');
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('poništeno preuzimanje: potvrđena, naplata poništena i zapisana [%s]', left(res::text, 400))); end if;

  -- Ponovno preuzimanje (kartica) -> nova naplata 100 €; vraćanje pre planiranog dana skraćuje
  -- rezervaciju (1.-3.3. -> 1.-2.3.), cena i naplata ostaju iste.
  res := admin_pickup(id_g, 'card');
  ok := (res ->> 'paid')::numeric = 100;
  res := admin_return(id_g);
  ok := ok and (res ->> 'success')::boolean and (res ->> 'shortened')::boolean;
  res := admin_get_reservation(id_g);
  ok := ok and res -> 'reservation' ->> 'status' = 'completed'
    and res -> 'reservation' ->> 'returned_at' is not null
    and (res -> 'reservation' ->> 'return_date')::date = '2099-03-02'
    and (res -> 'reservation' ->> 'total_price')::numeric = 100
    and (res -> 'reservation' ->> 'net_paid')::numeric = 100;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('vozilo vraćeno ranije: završena, vreme vraćanja, skraćen termin, ista cena i naplata [%s]', left(res::text, 400))); end if;

  -- Završena se ne vraća niti poništava; potvrđena se ne može "vratiti".
  res := admin_undo_pickup(id_g);
  ok := res ->> 'reason' = 'invalid_transition';
  res := admin_return(id_h);
  ok := ok and res ->> 'reason' = 'invalid_transition';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('poništavanje i vraćanje samo za preuzetu rezervaciju [%s]', res)); end if;
  reset role;

  -- =========================================================================
  -- 12. Kontrolna tabla: izdata vozila, današnja preuzimanja, kašnjenje
  -- =========================================================================
  -- K1: kod kupca, trebalo je da bude vraćeno juče -> kasni.
  -- K2: preuzeto danas, vraćanje za 2 dana -> u današnjim preuzimanjima, ne kasni.
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, status, picked_up_at)
  values (car, 'TEST vozilo', 'TEST Kasni', 'test@example.com', '060 111 222', '1990-01-01', today_bg - 3, today_bg - 1,
    'TEST', 'picked_up', now() - interval '3 days')
  returning id into id_a;
  insert into reservations (car_id, car_name, customer_name, email, phone, date_of_birth, pickup_date, return_date,
    pickup_location, status, picked_up_at)
  values (car, 'TEST vozilo', 'TEST Danas', 'test@example.com', '060 111 222', '1990-01-01', today_bg, today_bg + 2,
    'TEST', 'picked_up', now())
  returning id into id_b;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', admin_email)::text, true);
  set local role authenticated;
  res := admin_overview();
  ok := exists (select 1 from jsonb_array_elements(res -> 'late_returns') x where (x ->> 'id')::uuid = id_a)
    and not exists (select 1 from jsonb_array_elements(res -> 'late_returns') x where (x ->> 'id')::uuid = id_b)
    and (res -> 'rented_cars') ? car;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('kontrolna tabla: kasni sa vraćanjem (juče), izdato vozilo [%s]', left(res::text, 300))); end if;

  ok := exists (select 1 from jsonb_array_elements(res -> 'pickups_today') x
                where (x ->> 'id')::uuid = id_b and x ->> 'status' = 'picked_up' and x ->> 'picked_up_at' is not null)
    and (res ->> 'confirmed')::int >= 0;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('kontrolna tabla: današnje preuzimanje ostaje na spisku i posle preuzimanja [%s]', left(res -> 'pickups_today' ->> 0, 300))); end if;
  reset role;

  raise exception using
    message = format(
      'REZULTAT TESTA: %s od %s provera uspešno. %s',
      passed,
      total,
      case when cardinality(failed) = 0 then 'Sve je u redu.' else 'NEUSPELO -> ' || array_to_string(failed, ' || ') end
    ),
    hint = 'Ovo nije kvar: test se namerno završava ovom porukom da bi baza poništila sve što je test upisao.';
end
$test$;
