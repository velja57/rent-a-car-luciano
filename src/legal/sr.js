import { companyLine, FACTS, joinList } from './facts';

// Uslovi najma i politika privatnosti — srpski. Blok: tekst = pasus, niz = lista.
// Link u tekstu: [tekst](adresa). Brojke i vozila dolaze iz FACTS (isti podaci kao sajt).
const f = FACTS;
const c = f.company;
const UPDATED = '10. novembar 2026.';
const firm = companyLine({ pib: 'PIB', mb: 'matični broj' });
const olderCars = joinList(f.olderDriverCars.map((car) => `${car.name} (${car.minAge} godina)`), 'i');
const depositCars = joinList(f.depositCars.map((car) => `${car.name} (${car.deposit} €)`), 'i');

export const terms = {
  eyebrow: 'Pravne informacije',
  title: ['Uslovi ', 'najma vozila'],
  updated: UPDATED,
  intro: [
    `Ovi uslovi važe za svaki najam vozila kod ${c.name}, bez obzira na to da li je rezervacija napravljena preko sajta, telefonom, WhatsApp-om ili lično. Zajedno sa ugovorom o najmu, koji potpisujemo pri preuzimanju vozila, čine celinu. Ako se ugovor i ovi uslovi razlikuju, važi ugovor.`,
    `Pružalac usluge: ${firm}. Kontakt: ${f.phone}, ${c.email}.`,
  ],
  sections: [
    {
      id: 'ko-moze',
      title: 'Ko može da iznajmi i vozi vozilo',
      blocks: [
        `Vozilo može da iznajmi i vozi osoba koja ima najmanje ${f.minAge} godina i važeću vozačku dozvolu B kategorije.${olderCars ? ` Za pojedina vozila potrebno je više godina: ${olderCars}. Uslov je naveden i na stranici svakog vozila.` : ''} Ne tražimo minimalni vozački staž.`,
        'Pri preuzimanju je potrebno pokazati ličnu kartu ili pasoš i vozačku dozvolu. Strani državljani mogu da voze sa vozačkom dozvolom koja važi u Republici Srbiji; ako dozvola nije izdata na latiničnom pismu, preporučujemo i međunarodnu vozačku dozvolu.',
        'Vozilo smeju da voze samo vozači upisani u ugovor o najmu. Zadržavamo pravo da ne izdamo vozilo ako uslovi nisu ispunjeni, na primer ako dokumenta ne odgovaraju podacima iz rezervacije.',
      ],
    },
    {
      id: 'rezervacija',
      title: 'Rezervacija',
      blocks: [
        'Rezervacija preko sajta se beleži odmah, a potvrdu dobijaš na mejl. Pri rezervaciji se ništa ne plaća.',
        `Preko sajta možeš rezervisati najviše ${f.maxOnlineDays} dana. Za duži najam ili posebne zahteve pozovi nas.`,
        'Ako izabrano vozilo iz opravdanih razloga (npr. kvar) ne bude dostupno, ponudićemo ti vozilo iste ili više klase pod istim uslovima. Ako ti zamena ne odgovara, rezervacija se otkazuje bez ikakvih troškova za tebe.',
      ],
    },
    {
      id: 'preuzimanje',
      title: 'Preuzimanje i vraćanje vozila',
      blocks: [
        `Preko sajta se vozilo preuzima i vraća radnim danima (ponedeljak–petak) od ${f.hoursFrom} do ${f.hoursTo} h, na adresi ${c.address}. Drugi termini (vikend, rano jutro, kasno veče) mogući su uz dogovor telefonom, bez doplate.`,
        'Vozilo besplatno dovozimo i preuzimamo na aerodromu Nikola Tesla, a po dogovoru i na tvojoj adresi u Beogradu.',
        'Pri preuzimanju zajedno pregledamo vozilo; postojeća oštećenja i nivo goriva upisujemo u ugovor. Ako primetiš oštećenje koje nije upisano, javi nam pre nego što kreneš.',
        'Vozilo se vraća na ugovoreno mesto i u ugovoreno vreme, sa ključevima, dokumentima i opremom koju je imalo pri preuzimanju.',
        'Posle svakog najma vozilo pripremamo za sledećeg kupca, pa ono može biti rezervisano već nekoliko sati posle tvog termina vraćanja. Zato te molimo da poštuješ dogovoreno vreme.',
      ],
    },
    {
      id: 'trajanje',
      title: 'Trajanje najma i kašnjenje',
      blocks: [
        'Dan najma traje 24 sata od vremena preuzimanja.',
        `Za vraćanje imaš ${f.graceMinutes} minuta tolerancije. Posle toga se svaki započeti period od 24 sata računa kao novi dan najma po cenovniku.`,
        'Ako želiš da produžiš najam, javi nam se pre isteka termina. Produženje je moguće ako vozilo nije rezervisano za drugog kupca.',
        'Ako vozilo vratiš pre ugovorenog termina, cena najma se ne umanjuje.',
        'Ako vozilo nije vraćeno u ugovoreno vreme, a ne možemo da te kontaktiramo, obavestićemo nadležne organe.',
      ],
    },
    {
      id: 'cena',
      title: 'Cena i plaćanje',
      blocks: [
        'Cena po danu zavisi od vozila i dužine najma; popust za duži najam se računa automatski. Za tvoju rezervaciju važi cena prikazana u trenutku rezervacije.',
        'U cenu su uključeni osnovno osiguranje, neograničena kilometraža i, u zimskoj sezoni, zimske gume. Dečije sedište i dostava na aerodrom su besplatni. Ostale dodatne usluge (puno kasko, izlazak iz Srbije) plaćaju se prema cenovniku na sajtu.',
        `Od trećeg najma kod nas, kao stalni klijent dobijaš dodatnih ${f.loyaltyDiscount}% popusta na cenu najma vozila. Popust se obračunava pri preuzimanju vozila, na cenu posle popusta za duži najam, i ne odnosi se na dodatne usluge.`,
        'Ceo iznos najma plaća se pri preuzimanju vozila, gotovinom ili platnom karticom. Unapred se ništa ne plaća.',
        'Cene su izražene u evrima; iznos u dinarima na sajtu je informativan.',
      ],
    },
    {
      id: 'depozit',
      title: 'Depozit',
      blocks: depositCars
        ? [
            `Za većinu vozila ne tražimo depozit. Depozit se polaže pri preuzimanju samo za sledeća vozila: ${depositCars}. Iznos je naveden i na stranici vozila.`,
            'Depozit vraćamo pri vraćanju vozila, umanjen samo za troškove po ovim uslovima (npr. gorivo koje nedostaje ili učešće u šteti).',
          ]
        : ['Za najam vozila ne tražimo depozit.'],
    },
    {
      id: 'otkazivanje',
      title: 'Otkazivanje i izmena rezervacije',
      blocks: [
        `Rezervaciju možeš besplatno da otkažeš ili izmeniš najkasnije ${f.freeCancellationHours} sati pre preuzimanja — telefonom, WhatsApp-om ili mejlom.`,
        'Pošto se pri rezervaciji ništa ne plaća, pri otkazivanju nema povraćaja novca.',
        'Ako ne dođeš po vozilo u dogovoreno vreme i ne javiš se, rezervacija se poništava i vozilo može biti izdato drugom kupcu.',
      ],
    },
    {
      id: 'gorivo',
      title: 'Gorivo',
      blocks: [
        'Vozilo vraćaš sa istim nivoom goriva kao pri preuzimanju; nivo se upisuje u ugovor. Ako je goriva manje, naplaćujemo gorivo koje nedostaje po važećoj ceni goriva.',
        'Vrsta goriva navedena je u opisu vozila. Troškove i štetu nastalu sipanjem pogrešnog goriva snosi korisnik.',
      ],
    },
    {
      id: 'koriscenje',
      title: 'Korišćenje vozila',
      blocks: [
        'Vozilo koristi pažljivo, u skladu sa saobraćajnim propisima i uputstvom proizvođača. Nije dozvoljeno:',
        [
          'upravljanje pod dejstvom alkohola, droga ili lekova koji utiču na sposobnost vožnje;',
          'davanje vozila licu koje nije upisano u ugovor;',
          'prevoz putnika ili stvari uz naplatu i izdavanje vozila trećem licu;',
          'učešće na trkama, testiranjima i obuka vozača;',
          'vuča drugog vozila ili prikolice bez naše saglasnosti;',
          'vožnja van puteva i preopterećenje vozila;',
          'pušenje u vozilu;',
          'korišćenje vozila za nezakonite radnje.',
        ],
        'Kućni ljubimci su dozvoljeni samo uz prethodni dogovor.',
        'Ako se upali lampica upozorenja ili primetiš kvar, zaustavi se kada je bezbedno i pozovi nas. Troškove popravki koje nismo odobrili ne nadoknađujemo.',
      ],
    },
    {
      id: 'inostranstvo',
      title: 'Izlazak iz Srbije',
      blocks: [
        'Vozilo može da napusti Srbiju samo uz našu prethodnu saglasnost i dodatak „Izlazak iz Srbije (zeleni karton)“ prema cenovniku. Planirani put u inostranstvo navedi pri rezervaciji, a najkasnije pri preuzimanju vozila.',
        'Bez naše saglasnosti izlazak iz zemlje nije dozvoljen, a osiguranje tada ne pokriva štetu.',
        'U inostranstvu poštuj tamošnje propise; putarine, vinjete i takse plaća korisnik.',
      ],
    },
    {
      id: 'osiguranje',
      title: 'Osiguranje i odgovornost za štetu',
      blocks: [
        'Sva vozila imaju obavezno osiguranje od autoodgovornosti. U cenu najma uključeno je i osnovno osiguranje vozila, uz učešće korisnika u šteti; iznos učešća naveden je u ugovoru o najmu.',
        'Uz dodatak „Puno kasko (bez učešća u šteti)“ korisnik ne učestvuje u šteti na vozilu.',
        'Osiguranje ne pokriva štetu, i korisnik je nadoknađuje u celosti, ako je nastala:',
        [
          'pod dejstvom alkohola, droga ili lekova koji utiču na sposobnost vožnje;',
          'namerno ili usled grube nepažnje;',
          'dok je vozilom upravljalo lice koje nije upisano u ugovor;',
          'van Srbije bez naše saglasnosti ili korišćenjem vozila suprotno ovim uslovima;',
          'u saobraćajnoj nezgodi koja nije prijavljena policiji, a za koju nije sačinjen ni evropski izveštaj o saobraćajnoj nezgodi.',
        ],
        'Za gubitak ili oštećenje ključeva i dokumenata vozila korisnik snosi stvarne troškove.',
      ],
    },
    {
      id: 'nezgoda',
      title: 'Saobraćajna nezgoda, kvar ili krađa',
      blocks: [
        `Nezgoda: obezbedi mesto nezgode, pozovi policiju (192) kada je to potrebno i odmah nas obavesti na ${f.phone} (dostupni smo 0–24). Za manju nezgodu bez povređenih, kada se učesnici slažu, može se popuniti evropski izveštaj o saobraćajnoj nezgodi — i tada nas odmah obavesti.`,
        'Kvar: pozovi nas u bilo koje doba — pomoć na putu dostupna je 0–24. Dogovorićemo popravku na putu ili, kada je moguće, zamensko vozilo.',
        'Krađa: odmah je prijavi policiji i nama i vrati nam ključeve i dokumenta vozila.',
      ],
    },
    {
      id: 'troskovi',
      title: 'Saobraćajni prekršaji i drugi troškovi',
      blocks: [
        'Za vreme najma korisnik odgovara za saobraćajne prekršaje, kazne za parkiranje, putarine i druge troškove nastale korišćenjem vozila. Ako nadležni organ posle najma zatraži podatke o vozaču, dostavićemo mu podatke iz ugovora o najmu.',
        'Vozilo vraćaš u stanju u kakvom si ga preuzeo, uz uobičajenu upotrebu. Ako je unutrašnjost neuobičajeno zaprljana, naplaćujemo stvarni trošak čišćenja.',
        'Ne odgovaramo za stvari ostavljene ili prevožene u vozilu.',
      ],
    },
    {
      id: 'podaci',
      title: 'Lični podaci',
      blocks: ['Kako prikupljamo i čuvamo tvoje podatke i koja su tvoja prava, objašnjeno je u [Politici privatnosti](/politika-privatnosti).'],
    },
    {
      id: 'prigovori',
      title: 'Prigovori i rešavanje sporova',
      blocks: [
        `Ako nisi zadovoljan uslugom, pošalji prigovor mejlom na ${c.email}, poštom na adresu ${c.address} ili nam se javi telefonom na ${f.phone}. Odgovorićemo u roku od 8 dana od prijema prigovora.`,
        'Na ove uslove i ugovor o najmu primenjuju se propisi Republike Srbije, posebno Zakon o obligacionim odnosima i Zakon o zaštiti potrošača.',
        'Spor ćemo pokušati da rešimo sporazumno. Potrošač može da pokrene i postupak vansudskog rešavanja potrošačkog spora pred telom sa liste koju vodi ministarstvo nadležno za zaštitu potrošača. Ako spor ne bude rešen na ovaj način, nadležan je sud u Beogradu, osim ako zakon za potrošača ne propisuje drugačije.',
      ],
    },
    {
      id: 'izmene',
      title: 'Izmene uslova',
      blocks: ['Ove uslove možemo da izmenimo. Za tvoj najam važe uslovi objavljeni u trenutku rezervacije.'],
    },
  ],
};

export const privacy = {
  eyebrow: 'Pravne informacije',
  title: ['Politika ', 'privatnosti'],
  updated: UPDATED,
  intro: [
    'Ova politika objašnjava koje lične podatke prikupljamo kada koristiš sajt i iznajmljuješ vozilo, zašto ih prikupljamo, koliko ih čuvamo i koja su tvoja prava. Podatke obrađujemo u skladu sa Zakonom o zaštiti podataka o ličnosti („Službeni glasnik RS“, br. 87/2018).',
  ],
  sections: [
    {
      id: 'rukovalac',
      title: 'Ko obrađuje tvoje podatke',
      blocks: [`Rukovalac podacima je ${firm}. Za sva pitanja o ličnim podacima piši nam na ${c.email} ili nas pozovi na ${f.phone}.`],
    },
    {
      id: 'podaci',
      title: 'Koje podatke prikupljamo',
      blocks: [
        [
          'Rezervacija preko sajta: ime i prezime, email, broj telefona, izabrano vozilo, datumi i vreme preuzimanja i vraćanja, lokacija, dodatne usluge, napomena i jezik sajta.',
          'Najam vozila: podaci iz lične karte ili pasoša i vozačke dozvole koji se upisuju u ugovor o najmu, iznos i način plaćanja, stanje vozila, a po potrebi i podaci o saobraćajnoj nezgodi ili prekršaju.',
          'Kontakt telefonom, WhatsApp-om, mejlom ili preko Instagrama: podaci koje nam sam pošalješ.',
          'Tehnički podaci: kada otvoriš sajt, hosting i servisi navedeni niže automatski dobijaju IP adresu i podatke o pregledaču.',
        ],
        'Preko sajta ne prikupljamo podatke o platnim karticama — plaćanje se obavlja pri preuzimanju vozila.',
      ],
    },
    {
      id: 'svrha',
      title: 'Zašto obrađujemo podatke i na osnovu čega',
      blocks: [
        [
          'Da obradimo rezervaciju, pošaljemo potvrdu i podsetnik dan pre preuzimanja i zaključimo i izvršimo ugovor o najmu — izvršenje ugovora i radnje pre njegovog zaključenja (član 12. stav 1. tačka 2) Zakona). Uslov uzrasta za izabrano vozilo proveravamo pri preuzimanju, po ličnoj karti ili pasošu i vozačkoj dozvoli.',
          'Da ispunimo zakonske obaveze, kao što su poslovne i poreske evidencije i dostavljanje podataka o vozaču nadležnim organima (tačka 3).',
          'Naš legitimni interes (tačka 6): zaštita od lažnih rezervacija i zloupotreba (npr. ograničen broj rezervacija sa istog kontakta), bezbednost sajta i ostvarivanje ili odbrana pravnih zahteva.',
        ],
        'Ne šaljemo reklamne poruke, ne pravimo profile korisnika i ne prodajemo podatke.',
        'Sajt automatski proverava da li je vozilo slobodno i da li ispunjavaš uslov uzrasta. Ako misliš da je provera pogrešna, pozovi nas.',
      ],
    },
    {
      id: 'obaveznost',
      title: 'Da li moraš da daš podatke',
      blocks: ['Podaci iz forme za rezervaciju (osim napomene) i podaci za ugovor o najmu su neophodni da bismo mogli da izdamo vozilo. Bez njih rezervacija i najam nisu mogući.'],
    },
    {
      id: 'primaoci',
      title: 'Ko još ima pristup podacima',
      blocks: [
        [
          'Naši zaposleni koji rade sa rezervacijama, preko zaštićenog administratorskog panela.',
          'Pružaoci usluga koji podatke obrađuju po našem nalogu: Supabase (baza podataka sa rezervacijama), Resend (slanje mejlova potvrde i podsetnika) i Vercel (hosting sajta).',
          'Google: na sajtu se prikazuju Google mapa i Google fontovi; pri njihovom učitavanju Google dobija tvoju IP adresu, a mapa može da postavi Google kolačiće.',
          'Meta (WhatsApp, Instagram): samo ako nas kontaktiraš preko tih aplikacija; tada važe i njihova pravila privatnosti.',
          'Osiguravajuća društva, servisi i državni organi (policija, sud, poreska uprava): kada je to potrebno zbog štete ili kada to zahteva zakon.',
        ],
      ],
    },
    {
      id: 'inostranstvo',
      title: 'Prenos podataka van Srbije',
      blocks: ['Neki od navedenih pružalaca usluga (Supabase, Resend, Vercel, Google, Meta) obrađuju podatke i van Republike Srbije, u Evropskoj uniji i SAD. Prenos se vrši u skladu sa Zakonom, uz mere zaštite koje ti pružaoci usluga obezbeđuju svojim ugovorima o obradi podataka.'],
    },
    {
      id: 'cuvanje',
      title: 'Koliko dugo čuvamo podatke',
      blocks: [
        [
          'Podatke iz rezervacija i ugovora o najmu čuvamo dok traje najam, a posle toga dok traju rokovi zastarelosti potraživanja i rokovi koje propisuju računovodstveni i poreski propisi.',
          'Podatke iz rezervacija koje su otkazane ili nisu realizovane čuvamo dok su potrebni za evidenciju i zaštitu od zloupotreba; na tvoj zahtev ih brišemo ranije, ako nema zakonske obaveze čuvanja.',
          'Prepisku i poruke čuvamo dok su potrebne za rešavanje tvog upita.',
        ],
      ],
    },
    {
      id: 'prava',
      title: 'Tvoja prava',
      blocks: [
        'U skladu sa Zakonom imaš pravo da:',
        [
          'dobiješ informaciju da li obrađujemo tvoje podatke i kopiju tih podataka;',
          'zahtevaš ispravku netačnih ili dopunu nepotpunih podataka;',
          'zahtevaš brisanje podataka, kada za njihovu obradu više nema osnova;',
          'zahtevaš ograničenje obrade;',
          'dobiješ svoje podatke u strukturisanom, uobičajeno korišćenom obliku (prenosivost);',
          'podneseš prigovor na obradu koja se zasniva na našem legitimnom interesu.',
        ],
        `Zahtev pošalji na ${c.email} ili nam se javi na ${f.phone}. Odgovaramo bez odlaganja, a najkasnije u roku od 30 dana; pre odgovora možemo da zatražimo potvrdu identiteta.`,
      ],
    },
    {
      id: 'poverenik',
      title: 'Pritužba Povereniku',
      blocks: ['Ako smatraš da tvoje podatke obrađujemo suprotno Zakonu, možeš da podneseš pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti, Bulevar kralja Aleksandra 15, 11120 Beograd, [www.poverenik.rs](https://www.poverenik.rs).'],
    },
    {
      id: 'kolacici',
      title: 'Kolačići',
      blocks: ['Sajt ne koristi kolačiće za analitiku ni oglašavanje. Google mapa u podnožju sajta i Google fontovi učitavaju se sa Google servera, koji mogu da koriste svoje kolačiće i tehničke podatke prema [pravilima privatnosti kompanije Google](https://policies.google.com/privacy). Administratorski panel koristi memoriju pregledača samo za prijavu zaposlenih.'],
    },
    {
      id: 'bezbednost',
      title: 'Bezbednost podataka',
      blocks: ['Sajt radi preko šifrovane veze (HTTPS). Rezervacijama mogu da pristupe samo ovlašćeni zaposleni sa ličnom prijavom, a baza podataka je zaštićena pravilima koja ne dozvoljavaju da se podaci čitaju sa javnog sajta.'],
    },
    {
      id: 'maloletnici',
      title: 'Maloletna lica',
      blocks: ['Vozilo mogu da iznajme samo punoletna lica, pa svesno ne prikupljamo podatke maloletnika.'],
    },
    {
      id: 'izmene',
      title: 'Izmene politike privatnosti',
      blocks: ['Ovu politiku možemo da izmenimo; aktuelna verzija je uvek objavljena na ovoj stranici, sa datumom poslednje izmene.'],
    },
  ],
};
