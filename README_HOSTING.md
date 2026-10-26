# Hosting — GitHub + Vercel

Sajt se hostuje na Vercel-u, povezanom sa GitHub repozitorijumom. Svaki put
kad se izmena push-uje na `main` granu, Vercel automatski objavljuje novu
verziju sajta (traje obično ~30-60 sekundi).

## 1. GitHub repozitorijum

Lokalni Git repozitorijum je već napravljen i prvi commit je urađen. Fali
samo da postoji prazan repo na GitHub-u da u njega push-ujemo.

1. Idi na [github.com/new](https://github.com/new).
2. Repository name: `rent-a-car-luciano` (ili kako god želiš — javi mi ako
   biraš drugo ime).
3. Vidljivost: **Private** (preporuka — kod sadrži strukturu baze i interne
   napomene; nema u njemu nijedan pravi ključ/lozinku, ali nema razloga da
   bude javno).
4. **NE** čekiraj "Add a README file", "Add .gitignore" ni "Choose a license"
   — repo mora biti prazan, mi već imamo sve to lokalno.
5. Create repository.

Kad ga napraviš, javi mi (ili samo potvrdi da je gotovo) — ja ću push-ovati
postojeći kod u njega.

## 2. Poveži GitHub sa Vercel-om

1. Idi na [vercel.com](https://vercel.com) → Sign up / Log in (najlakše
   preko "Continue with GitHub" — odmah ih poveže).
2. Add New → Project.
3. Izaberi `rent-a-car-luciano` repo (Vercel traži dozvolu da vidi tvoje
   GitHub repo-e prvi put — odobri).
4. Vercel automatski prepoznaje Vite projekat (Build command: `vite build`,
   Output: `dist`) — ne menjaj ništa tu.

## 3. Env promenljive (OBAVEZNO pre prvog deploy-a)

Reservacioni sistem neće raditi na pravom sajtu dok ne dodaš iste env
promenljive koje imaš u `.env.local` (iz [README_RESERVATIONS.md](README_RESERVATIONS.md), korak 3):

1. U Vercel projektu: Settings → Environment Variables.
2. Dodaj:
   - `VITE_SUPABASE_URL` = tvoj Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = tvoj Supabase anon ključ
3. Sačuvaj, pa Deployments → ⋯ → Redeploy (da build pokupi nove promenljive).

Bez ovoga, sajt na Vercel-u radi isto kao i lokalno bez `.env.local` — sve
osim rezervacionog sistema radi normalno, rezervacije padaju na WhatsApp-only.

## 4. Deploy

Nakon koraka 1-3, svaki `git push` na `main` granu automatski pravi novi
deploy. Prvi deploy se pokreće odmah nakon povezivanja repo-a u koraku 2.

## 5. Admin panel na pravom sajtu

Nakon deploy-a, admin panel je na `https://<tvoj-domen>/admin` (lepši URL,
`vercel.json` ga preusmerava na `/admin.html`). Podešavanje admin naloga:
[README_ADMIN.md](README_ADMIN.md).

## 6. Custom domen (opciono)

Ako imaš svoj domen (npr. lucianorentacar.rs), može da se poveže: Vercel
projekat → Settings → Domains → Add. Vercel da uputstva za DNS podešavanje
kod tvog registrara domena. Javi ako imaš domen pa prođemo kroz to zajedno.

## Poznata ograničenja

- Svaki push na `main` ide direktno uživo (nema staging/preview korak
  podešen) — za sajt ove veličine to je u redu, ali ako poželiš da prvo
  gledaš izmene na test-URL-u pre nego što idu uživo, Vercel to radi
  automatski za svaki branch koji NIJE `main` (Preview Deployments) — možemo
  da iskoristimo to ako želiš taj workflow.
