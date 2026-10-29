-- Test baze za admin panel. Pokreni POSLE supabase/schema.sql:
-- Supabase Dashboard -> SQL Editor -> New query -> zalepi ceo fajl -> Run.
--
-- Test NIŠTA ne ostavlja u bazi i ne dira prave rezervacije: koristi izmišljeno
-- vozilo "test-vozilo-admin" i datume u 2099. godini, a ceo test je jedan blok
-- koji se na kraju NAMERNO prekida porukom o grešci, pa baza poništava sve što
-- je test upisao (i nijedan mejl se ne šalje).
--
-- Rezultat je u toj poruci, npr:
--   ERROR: REZULTAT TESTA: 44 od 44 provera uspešno. Sve je u redu.
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
  refund_id uuid;
begin
  select email into admin_email from admin_users order by created_at limit 1;

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

  -- Rezervacija A sa sajta: 10.-12.6.2099, 120€, sa dodatkom.
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
  ok := (res -> 'reservation' ->> 'total_price')::numeric = 120
    and res -> 'reservation' ->> 'source' = 'web'
    and res -> 'reservation' -> 'extras' = '["child-seat"]'::jsonb
    and (res -> 'reservation' ->> 'days')::int = 2;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: A treba da ima iznos, dodatke i broj dana [%s]', left(res::text, 300))); end if;

  select count(*) into n from reservations where car_id = car;
  ok := n = 2;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin treba da vidi rezervacije (RLS)'); end if;

  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac X',
    p_phone => '060 111 222', p_pickup => '2099-06-14', p_return => '2099-06-16', p_location => 'TEST lokacija');
  ok := res ->> 'reason' = 'unavailable';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: preklapanje sa B mora biti odbijeno [%s]', res)); end if;

  -- Telefonska rezervacija C, bez emaila i datuma rođenja: 1.-3.7.2099, 150€.
  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac C',
    p_phone => '060 111 222', p_pickup => '2099-07-01', p_return => '2099-07-03', p_location => 'TEST lokacija',
    p_pickup_time => '10:00', p_total_price => 150);
  id_c := (res ->> 'id')::uuid;
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_c);
  ok := ok and res -> 'reservation' ->> 'source' = 'admin' and res -> 'reservation' ->> 'email' is null;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: telefonska rezervacija C [%s]', left(res::text, 300))); end if;

  res := admin_create_reservation(p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST',
    p_phone => '12', p_pickup => '2099-09-01', p_return => '2099-09-02', p_location => 'TEST');
  ok := res ->> 'reason' = 'invalid_phone';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: neispravan telefon mora biti odbijen [%s]', res)); end if;

  res := admin_update_reservation(p_id => id_b, p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac B',
    p_phone => '060 111 222', p_pickup => '2099-06-11', p_return => '2099-06-15', p_location => 'TEST lokacija',
    p_email => 'test@example.com', p_dob => '1990-01-01', p_total_price => 90);
  ok := res ->> 'reason' = 'unavailable';
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: izmena B koja se preklapa sa A mora biti odbijena [%s]', res)); end if;

  -- B produžena do 16.6., nova cena 120€.
  res := admin_update_reservation(p_id => id_b, p_car_id => car, p_car_name => 'TEST vozilo', p_customer_name => 'TEST Kupac B',
    p_phone => '060 111 222', p_pickup => '2099-06-13', p_return => '2099-06-16', p_location => 'TEST lokacija',
    p_email => 'test@example.com', p_dob => '1990-01-01', p_total_price => 120);
  ok := (res ->> 'success')::boolean;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: izmena B (produžen najam) [%s]', res)); end if;

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

  -- Uplate na A (iznos 120€): avans 50 + 30, povraćaj 10, kaucija 300, vraćeno 100.
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
    and (res -> 'reservation' ->> 'balance')::numeric = 50
    and (res -> 'reservation' ->> 'deposit_held')::numeric = 200;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('admin: A uplaćeno 70, preostalo 50, kaucija 200 [%s]', left(res -> 'reservation' ->> 'net_paid', 20))); end if;

  res := admin_void_payment(refund_id, 'TEST greška');
  ok := (res ->> 'success')::boolean;
  res := admin_get_reservation(id_a);
  ok := ok
    and (res -> 'reservation' ->> 'net_paid')::numeric = 80
    and (res -> 'reservation' ->> 'balance')::numeric = 40
    and jsonb_array_length(res -> 'payments') = 5;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, 'admin: poništen povraćaj — uplaćeno 80, preostalo 40, stavka ostaje zabeležena'); end if;

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

  -- Finansije 1.6.-31.7.2099: aktivne A 120 + B 120 + C 150 = 390 (D "nije se
  -- pojavio" se ne računa); naplaćeno 80; preostalo 40 + 120 + 150 = 310.
  res := admin_finance_summary('2099-06-01', '2099-07-31');
  ok := (res -> 'booked' ->> 'value')::numeric = 390
    and (res -> 'booked' ->> 'count')::int = 3
    and (res -> 'booked' ->> 'without_price')::int = 0
    and (res -> 'payments' ->> 'collected')::numeric = 80
    and (res -> 'payments' ->> 'refunded')::numeric = 0
    and (res -> 'payments' ->> 'deposits_received')::numeric = 300
    and (res ->> 'outstanding')::numeric = 310
    and (res -> 'status_counts' ->> 'confirmed')::int = 2
    and (res -> 'status_counts' ->> 'no_show')::int = 1;
  total := total + 1; if ok then passed := passed + 1; else failed := array_append(failed, format('finansije: vrednost/naplaćeno/preostalo [%s]', left(res::text, 400))); end if;

  ok := jsonb_array_length(res -> 'by_month') = 2
    and (res -> 'by_month' -> 0 ->> 'booked')::numeric = 240
    and (res -> 'by_month' -> 0 ->> 'collected')::numeric = 80
    and (res -> 'by_month' -> 1 ->> 'booked')::numeric = 150
    and res -> 'by_vehicle' -> 0 ->> 'car_id' = car
    and (res -> 'by_vehicle' -> 0 ->> 'booked')::numeric = 390;
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
