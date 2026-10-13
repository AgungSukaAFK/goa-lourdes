# GOA HZ

Sistem General Affair Lourdes Group (GMI & GIS) yang menggabungkan tiga aplikasi lama:

| Modul | URL | Isi |
|---|---|---|
| Asset | `/asset` | Aset & kode otomatis, label QR + scan, peminjaman, mutasi, audit, cetak dokumen |
| Fleet | `/fleet` | Kendaraan, driver, booking + peta & GPS realtime, P2H, perbaikan, prediksi servis, BBM |
| GOA | `/goa` | Tugas tim GA, workflow, planner rutin, KPI & saran performa, safety topic |
| Admin | `/admin` | User management, karyawan, site, pengumuman, format kode aset |

Next.js 15 (App Router) · Supabase (Postgres + Auth + Storage + Realtime + pg_cron) ·
Tailwind 4 + shadcn/ui (styling mengikuti `styling-guide.md`) · PWA (Serwist).
Rencana & keputusan desain: [`planning.md`](planning.md).

## Menjalankan lokal

```bash
cp .env.example .env.local   # isi nilainya (lihat komentar di file)
npm install
npm run dev                  # http://localhost:3000
```

Login awal: NRP **20260101**, password **demo1234** (Moderator). Ganti password lewat menu Profil.
Kalau database masih kosong, buat Moderator dengan:

```bash
node --env-file=.env.local scripts/create-moderator.mjs <NRP> "<Nama>" [password]
```

## Database

Semua skema ada di `supabase/migrations/` dan dijalankan berurutan:

```bash
npm run db:push              # supabase db push memakai SUPABASE_DB_URL
```

- Hak akses dijaga **RLS** di setiap tabel. User GMI hanya melihat data GMI dan user GIS hanya GIS.
  User berstatus `LOURDES` dan Moderator melihat keduanya.
- Alur penting (setujui pinjam/mutasi, P2H, mulai/selesai trip, tugas GOA) berjalan lewat fungsi SQL
  supaya atomik dan tidak bisa dimanipulasi dari browser.
- Job terjadwal (`pg_cron`, waktu WIB):
  - 00.05: tugas rutin GOA dibuat dari template
  - 00.10: tugas rutin yang tidak ditutup menjadi "Hangus"
  - 06.00: task P2H mingguan untuk kendaraan yang jatuh tempo
  - 07.00: notifikasi pajak, KIR, dan servis kendaraan
  - Minggu: titik GPS lebih dari 180 hari dihapus

## Akun & akses

- Login memakai **email atau NRP** + password. Akun tanpa email memakai `NRP@demo.com` di belakang layar.
- Daftar sendiri (`/sign-up`) menghasilkan akun **nonaktif**. Moderator melengkapi NRP, PT, dan akses modul
  di User Management, lalu mengaktifkannya.
- Akun dibuat atau di-reset admin dengan password `demo1234`.
- Role per modul: Asset (Admin / Staff + hak per menu), Fleet (Admin / Driver / Karyawan),
  GOA (Atasan / Tim / Guest).

## Migrasi data lama

1. Kumpulkan data ke `migration-data/{asset,fleet,goa}/<nama tabel lama>.json` (atau `.csv` dari
   dashboard Supabase lama). Bisa juga ditarik otomatis memakai key yang ada di HTML lama:
   ```bash
   node scripts/migrate/export-legacy.mjs
   ```
2. Coba tanpa menulis apa pun, lalu baca `migration-report.md`:
   ```bash
   node --env-file=.env.local scripts/migrate/import.mjs --dry-run
   ```
3. Import sungguhan (aman diulang, tidak menggandakan data):
   ```bash
   node --env-file=.env.local scripts/migrate/import.mjs --fleet-company=GMI --goa-company=GMI
   ```
   Opsi lain: `--accounts=none` (tanpa membuat akun login), `--skip-photos`.

Yang dilakukan importer: karyawan digabung berdasarkan NRP, kendaraan Fleet dan GOA digabung berdasarkan
plat, P2H dari kedua sistem masuk ke satu tabel, task "Rutin" GOA dijadikan template (yang diblokir
menjadi nonaktif), foto base64 dan Google Drive (yang publik) dipindah ke Storage, dan akun dibuat untuk
user Asset, driver Fleet, serta user GOA.

## Deploy ke Vercel

1. Import repo ke Vercel (framework Next.js, build `npm run build`).
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, dan `NEXT_PUBLIC_APP_URL` (URL produksi, dipakai di QR label aset).
   `SUPABASE_DB_URL` & `SUPABASE_PROJECT_REF` tidak perlu di Vercel.
3. Di Supabase → Authentication → URL Configuration, isi **Site URL** dengan URL produksi.
4. Upload foto memakai Supabase Storage langsung dari browser, jadi limit body Vercel (4,5 MB) tidak berpengaruh.

## Catatan

- **GPS:** browser/PWA berhenti mengirim lokasi saat layar HP mati. Halaman trip menahan layar tetap menyala
  (Wake Lock) dan monitoring menandai kendaraan yang lebih dari 5 menit tanpa update.
- `npm run db:types` butuh Docker. Tipe TypeScript untuk DB ditulis manual di `lib/types.ts` dan `lib/*/types.ts`.
- Ikon PWA dibuat dari `public/icon.svg`: `node scripts/generate-icons.mjs`.
