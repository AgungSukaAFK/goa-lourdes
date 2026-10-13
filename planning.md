# Planning — GOA HZ

Satu aplikasi Next.js yang menggabungkan 3 sistem lama milik GA Lourdes Group
ke dalam satu database Supabase:

| Modul    | Asal (folder `legacy/`)            | Isi                                                       |
| -------- | ---------------------------------- | --------------------------------------------------------- |
| `asset`  | `asset_management_ (1).html`       | Aset, peminjaman, mutasi, audit, label QR                 |
| `fleet`  | `fleet_management (4) (1).html` + P2H dari GOA | Armada, booking + GPS, P2H, BBM, perbaikan, prediksi servis |
| `goa`    | `goa_5_ihz___monitoring (1).html`  | Task tim GA, workflow, planner rutin, KPI, safety topic   |

Styling mengikuti `styling-guide.md`, dengan file sumber dari `/Users/user/web/ga-web`.

---

## 1. Keputusan yang sudah disepakati

| # | Topik | Keputusan |
|---|-------|-----------|
| 1 | P2H | Hanya ada satu P2H, di modul Fleet. Menu P2H di GOA dihapus, tapi GOA tetap bisa membaca datanya untuk task & KPI. |
| 2 | Auth | Supabase Auth, login pakai **email atau NRP** + password. Auto confirm (tanpa verifikasi email). |
| 2a | Email sintetis | Karyawan tanpa email dibuatkan `nrp@demo.com`, password awal `demo1234`. Ganti password **tidak wajib**. |
| 2b | Daftar sendiri | Hanya isi NRP **atau** email, nama, dan password. Akun **nonaktif** tanpa company/akses. Moderator yang melengkapi NRP, company, dan akses sekaligus mengaktifkan. |
| 2c | Reset password | Dilakukan admin lewat User Management (tidak ada email reset). |
| 3 | ga-web | Terpisah: project & database sendiri. |
| 4 | Data lama | Dimigrasi setelah schema baru jadi. Datanya dikirim user. |
| 5 | Perusahaan | Data punya kolom `company` (`GMI` / `GIS`). User GMI hanya melihat GMI, user GIS hanya GIS (ditegakkan di RLS). User dengan company **`LOURDES`** bisa melihat keduanya. |
| 6 | Fitur | "Tema Tampilan" GOA diganti theme/accent/font switcher. Flappy Bird dibuang. |
| 6a | "AI" | Tetap rule-based tapi ditingkatkan, dan diberi nama yang jujur ("Saran Performa", "Prediksi Servis"). |
| 7 | Foto | Disimpan di Supabase Storage (tidak lagi base64 / Google Drive). |
| 8 | Ekspor | Semua dipertahankan: Excel import/export, label QR, cetak dokumen, export PPTX. |
| 9 | Penjadwalan | `pg_cron` di Supabase (task rutin, P2H mingguan, status hangus). |
| 10 | GPS | Posisi live lewat Realtime **dan** riwayat rute disimpan (bisa diputar ulang). |
| 11 | Project | Dibuat di root folder ini (nanti folder di-rename jadi `goa-lourdes`). |
| 12 | Tampilan | `AuthShell` & aset gambar dicopy dari ga-web. Dibuat **PWA**. |
| 13 | Nama/logo | **GOA HZ**, logo huruf "H" (SVG). Favicon statis berwarna netral. Warna aksen default mengikuti company akun (GMI → `theme-gmi`, GIS → `theme-gis`, LOURDES → default zinc). User tetap bisa mengganti. |
| 14 | Bahasa | URL berbahasa Inggris. Label UI campuran Indonesia/Inggris (Indonesia diutamakan). |
| 15 | Super admin | Disebut **Moderator**. |
| 16 | Migration DB | Dijalankan langsung ke project Supabase di `.env.local` setiap fase. |
| 17 | Deploy | Vercel, dideploy sendiri oleh user. |

---

## 2. Stack

Mengikuti `styling-guide.md` §1, ditambah:

| Kebutuhan | Library |
|---|---|
| Supabase SSR | `@supabase/ssr`, `@supabase/supabase-js` |
| Validasi form | `zod` + `react-hook-form` |
| Peta | `leaflet` + `react-leaflet` (tile OpenStreetMap) |
| QR | `qrcode.react` (label), `@zxing/browser` (scan via kamera) |
| Excel | `xlsx` (SheetJS, dari `cdn.sheetjs.com`, versi npm 0.18.5 punya CVE) |
| PPTX | `pptxgenjs` |
| Markdown (SOP/Safety) | `react-markdown` + `remark-gfm` |
| Kompres gambar | `browser-image-compression` (sebelum upload ke Storage) |
| PWA | `app/manifest.ts` + service worker via `@serwist/next` |

Versi Next.js & React disamakan dengan ga-web (Next 15.5, React 19) agar
komponen yang dicopy langsung jalan.

Pola data: **Server Components untuk baca, Server Actions untuk tulis**.
Semua tabel memakai RLS. Service role key hanya dipakai di server untuk
pembuatan akun dan migrasi data.

---

## 3. Navigasi & perpindahan modul

```
app/
  (auth)/login, sign-up, pending
  (With Sidebar)/
    layout.tsx               ← SidebarProvider + header + breadcrumb
    asset/…                  ← modul Asset
    fleet/…                  ← modul Fleet
    goa/…                    ← modul GOA
    admin/…                  ← lintas modul (user, karyawan, site)
    profile/
  page.tsx                   ← redirect ke modul terakhir (cookie `last-module`)
```

- **`ModuleSwitcher`** (pola TeamSwitcher shadcn) ada di `SidebarHeader`, di
  bawah logo. Isinya hanya modul yang user punya aksesnya. Tiap modul tampil
  dengan ikon lucide (`Package`, `Truck`, `ListChecks`) dan role user di modul
  itu sebagai subjudul.
- **Modul aktif dibaca dari segmen pertama URL**, bukan dari state, jadi deep
  link, refresh, dan breadcrumb tetap benar.
- Menu tiap modul didefinisikan di config:
  `lib/modules/{asset,fleet,goa,admin}.ts` → `{ id, label, icon, basePath, groups: [{ label, items: [{ title, url, icon, keywords, can(access) }] }] }`.
  `AppSidebar`, `SidebarSearch`, breadcrumb, dan guard halaman membaca config
  yang sama. Menambah modul baru cukup dengan menambah satu file.
- Grup **Admin** tampil di bawah menu modul untuk Moderator.
- `middleware.ts`: refresh session → redirect ke `/login` jika belum login,
  ke `/pending` jika `is_active = false`. Setiap `layout.tsx` modul memeriksa akses modul dan
  mengembalikan 404 jika user tidak punya akses.
- **Moderator dan user LOURDES** punya pilihan company di header
  (`Semua / GMI / GIS`), disimpan di cookie dan dipakai sebagai filter
  default. User GMI/GIS tidak punya pilihan ini, mereka terkunci ke
  company-nya.

---

## 4. Auth & hak akses

### Login
- Field "Email atau NRP". Jika tidak mengandung `@`, server memanggil RPC
  `auth_email_for_nrp(nrp)` (security definer) untuk mendapatkan email
  akunnya, lalu `signInWithPassword`.
- **Daftar sendiri** (`/sign-up`): NRP atau email (satu field), nama,
  password. Jika yang diisi NRP, email dibuat `nrp@demo.com`. Hasilnya
  `is_active = false`, company kosong, tanpa akses modul. User diarahkan
  ke `/pending` sampai Moderator melengkapi data dan mengaktifkan.
- **Dibuat admin** (User Management): password default `demo1234`. User
  bisa mengganti sendiri di `/profile` (tidak wajib).

### User Management (`/admin/users`)
- Tabel user dengan filter company, status, dan modul. Aksi: tambah, edit,
  hapus, aktif/nonaktif, reset password (kembali ke `demo1234`),
  dan atur akses per modul.
- Bulk: "Buat akun dari data karyawan" (pilih karyawan → akun dibuat dengan
  email sintetis).
- Pengaman: Moderator tidak bisa menonaktifkan atau menghapus dirinya sendiri,
  dan sistem harus selalu punya minimal satu Moderator aktif.

### Role per modul (`module_access`)

| Modul | Role | Catatan |
|---|---|---|
| asset | `admin`, `staff` | Ditambah `permissions` per menu (read/write/delete) seperti sistem lama |
| fleet | `admin`, `driver`, `employee` | Driver: P2H, booking, BBM. Employee: hanya booking |
| goa   | `supervisor` (atasan), `member` (tim), `guest` | |

Moderator (`profiles.is_moderator`) melewati semua cek dan bisa melihat semua
company.

### RLS (helper SQL)
- `is_moderator()`, `can_see_company(c)`, `has_module_role(module, roles[])`
- `can_see_company(c)` = moderator, **atau** company profil = `LOURDES`,
  **atau** company profil = `c`.
- Pola policy di setiap tabel yang punya company: `can_see_company(company)`,
  digabung dengan cek role modul untuk insert/update/delete.

---

## 5. Skema database

Semua tabel ada di schema `public` dengan prefix per modul. PK `uuid`,
`created_at`/`updated_at` diisi trigger. `company` di data memakai enum
`company_code ('GMI','GIS')`. Profil memakai `profile_company ('GMI','GIS','LOURDES')`.
Karyawan LOURDES (`employees.company`) juga boleh `LOURDES`.

### Core
| Tabel | Kolom penting |
|---|---|
| `profiles` | `id` (= auth.users.id), `employee_id`, `nrp`, `name`, `email`, `company` (`GMI`/`GIS`/`LOURDES`, null saat baru daftar), `avatar_path`, `is_active`, `is_moderator` |
| `module_access` | `user_id`, `module` (`asset`/`fleet`/`goa`), `role`, `permissions jsonb` — unik (user, module) |
| `employees` | `nrp` (unik), `name`, `company`, `position`, `division`, `site_id`, `join_date`, `photo_path`, `is_active` — master karyawan, termasuk yang tidak punya akun |
| `sites` | `name`, `company` — gabungan `sites` (Asset) dan `operational_sites` (Fleet) |
| `notifications` | `user_id` (null = broadcast), `company`, `module`, `title`, `body`, `link`, `read_at`, `expires_at` — pengganti `global_notifications` |
| `activity_logs` | `module`, `entity`, `entity_id`, `action`, `actor_id`, `data jsonb` — pengganti `logs` |
| `app_settings` | `key`, `company`, `value jsonb` — format kode aset, info kop dokumen, dll. |
| `sop_pages` | `module`, `slug`, `title`, `content_md`, `sort` — SOP bisa diedit admin |

### Asset
| Tabel | Kolom penting |
|---|---|
| `asset_categories` | `name`, `depreciation_years` |
| `assets` | `code` (unik), `accurate_code`, `name`, `category_id`, `brand`, `model`, `status` (`ready`/`loaned`/`damaged`/`lost`/`disposed`), `cost`, `purchase_date`, `depreciation_years`, `site_id`, `owner_employee_id`, `is_borrowable`, `mr_number`, `po_number`, `company`, `photo_path` |
| `asset_loans` | `asset_id`, `borrower_employee_id`, `borrow_date`, `expected_return_date`, `actual_return_date`, `purpose`, `status` (`pending`/`approved`/`returned`/`rejected`), `approved_by` |
| `asset_mutations` | `asset_id`, `from_employee_id`, `to_employee_id`, `from_site_id`, `to_site_id`, `reason`, `status` (`pending`/`approved`/`rejected`), `is_direct` |
| `asset_audits` | `code`, `asset_id`, `due_date`, `status` (`waiting`/`fulfilled`), `notes`, `realized_by`, `photo_path` |

Penyusutan dan nilai buku dihitung lewat view `assets_with_book_value`
(garis lurus), tidak disimpan.

### Fleet
| Tabel | Kolom penting |
|---|---|
| `fleet_vehicles` | `plate` (unik), `model`, `company`, `site_id`, `odometer`, `service_interval_km`, `last_service_odo`, `tax_date`, `kir_date`, `plate_date`, `status` (`available`/`in_use`/`grounded`/`maintenance`) |
| `fleet_odometer_logs` | `vehicle_id`, `odometer`, `source` (`p2h`/`fuel`/`trip`/`manual`), `recorded_at` — pengganti `log_km` jsonb |
| `fleet_drivers` | `employee_id`, `license_no`, `license_expiry`, `is_active` |
| `fleet_driver_vehicles` | `driver_id`, `vehicle_id` — pengganti `assignments` |
| `fleet_bookings` | `requester_id`, `vehicle_id`, `driver_id`, `start_time`, `end_time`, `purpose`, `destination`, `dest_lat/lng`, `est_cost`, `distance_km`, `status` (`pending`/`approved`/`in_use`/`completed`/`rejected`/`cancelled`), `company` |
| `fleet_trip_points` | `booking_id`, `lat`, `lng`, `speed`, `accuracy`, `recorded_at` — riwayat rute GPS |
| `fleet_p2h_checklist_items` | `category`, `name`, `description`, `target` (`vehicle`/`driver`), `weight`, `is_critical`, `sort`, `is_active` — checklist bisa diedit |
| `fleet_p2h_inspections` | `vehicle_id`, `driver_id`, `inspector_employee_id`, `booking_id` (null = rutin), `kind` (`pre_trip`/`weekly`), `odometer`, `score`, `result` (`fit`/`caution`/`grounded`), `answers jsonb`, `issues text[]`, `lat/lng`, `next_due_date` |
| `fleet_p2h_photos` | `inspection_id`, `side` (`front`/`back`/`left`/`right`/`other`), `path` |
| `fleet_repairs` | `vehicle_id`, `inspection_id`, `component`, `reported_by`, `status` (`queued`/`in_progress`/`done`), `mechanic`, `actual_cost`, `done_at` |
| `fleet_parts` | `name`, `type`, `interval_km`, `cost`, `vehicle_ids uuid[]` (null = semua) — pengganti `part_settings` |
| `fleet_fuel_logs` | `vehicle_id`, `driver_id`, `date`, `start_odo`, `end_odo`, `liters`, `total_cost` — rasio, Rp/km, dan skor dihitung di view |

### GOA
| Tabel | Kolom penting |
|---|---|
| `goa_members` | `profile_id`, `title` (jabatan), `sp_level`, `sp_date`, `presence_status`, `backup_profile_id` |
| `goa_task_templates` | `title`, `description`, `job_category`, `assignee_id`, `reviewer_id`, `frequency` (`daily`/`weekly`/`monthly`), `days int[]`, `skip_holidays`, `is_active` — pengganti task "Rutin" + `goa_blocked_plans` (blokir = `is_active=false`) |
| `goa_tasks` | `template_id`, `title`, `description`, `type` (`once`/`routine`), `job_category`, `assignee_id`, `reviewer_id`, `status` (`pending`/`in_progress`/`done`/`undone`/`expired`), `rating`, `start_time`, `due_at`, `completed_at`, `duration_minutes`, `undone_reason`, `done_notes`, `reminder_at`, `source` (`manual`/`template`/`p2h`), `company` |
| `goa_kpi_settings` | `target` (`GLOBAL` atau profile_id), `parameters jsonb` (nama, bobot) |
| `goa_safety_topics` | `title`, `category`, `content_md`, `cover_path`, `published_at` |
| `holidays` | `date`, `name` — untuk `skip_holidays` |

### Storage buckets (semua private, diakses lewat signed URL)
`avatars`, `asset-photos`, `p2h-photos`, `audit-photos`, `attachments`.
Struktur path: `{company}/{entity}/{id}/{file}`. Policy storage memakai
helper RLS yang sama.

### pg_cron
| Job | Jadwal (WIB) | Fungsi |
|---|---|---|
| `goa_generate_routine_tasks` | 00:05 setiap hari | Membuat `goa_tasks` dari template aktif (melewati hari libur jika diset) |
| `goa_expire_tasks` | 23:55 setiap hari | Task rutin yang lewat batas → `expired` (dulu "Hangus") |
| `fleet_weekly_p2h` | Senin 06:00 | Untuk tiap kendaraan yang `next_due_date`-nya jatuh di minggu ini: buat task GOA ("P2H mingguan B 1234 XX") dengan link ke form Fleet |
| `fleet_doc_reminders` | 07:00 setiap hari | Notifikasi pajak/KIR ≤ 30 hari dan servis ≤ 500 km |
| `cleanup_trip_points` | Minggu 02:00 | Rute GPS lebih dari 180 hari diringkas/dihapus |

---

## 6. Halaman per modul

### Admin (`/admin`) — Moderator
`users`, `employees` (+ import Excel), `sites`, `settings` (format kode aset
per company, kop dokumen), `notifications` (broadcast).

### Asset (`/asset`)
| URL | Isi |
|---|---|
| `/asset` | Dashboard: total & nilai aset, status, per kategori/site, pinjaman jatuh tempo |
| `/asset/assets` | List + filter + import/export Excel, tambah aset, cetak label QR massal |
| `/asset/assets/[id]` | Detail, riwayat (pinjam/mutasi/audit), nilai buku, mutasi langsung, cetak label |
| `/asset/scan` | Scan QR dengan kamera → buka detail aset |
| `/asset/loans` | Pengajuan → approve GA → kembali. Cetak form pinjam |
| `/asset/mutations` | Pengajuan → approve. Cetak berita acara mutasi |
| `/asset/audits` | Buat audit (acak/terpilih), realisasi dengan foto, cetak |
| `/asset/categories` | Kategori + masa penyusutan |
| `/asset/activity` | Log aktivitas |
| `/asset/sop` | SOP |

### Fleet (`/fleet`)
| URL | Isi |
|---|---|
| `/fleet` | Dashboard: unit available/in use/grounded, skor kelayakan, P2H hari ini, dokumen jatuh tempo |
| `/fleet/bookings` | Pengajuan → approve → **P2H wajib** → berangkat → selesai |
| `/fleet/bookings/[id]` | Detail. Untuk driver: tombol mulai/selesai trip + kirim GPS |
| `/fleet/p2h` | Form P2H (pre-trip / weekly) |
| `/fleet/p2h/history` | Riwayat, filter, detail + foto, cetak, export |
| `/fleet/p2h/schedule` | Kepatuhan P2H mingguan per kendaraan |
| `/fleet/monitoring` | Peta live trip yang berjalan + putar ulang rute |
| `/fleet/vehicles` | Database armada (+ import Excel), detail, riwayat KM |
| `/fleet/drivers` | Driver & assignment kendaraan |
| `/fleet/repairs` | Daftar perbaikan (dari P2H atau manual) → realisasi biaya |
| `/fleet/maintenance` | Prediksi Servis: jadwal ganti part berdasarkan rata-rata km/hari |
| `/fleet/annual-plan` | Prediksi Tahunan: estimasi biaya perawatan per bulan/unit |
| `/fleet/fuel` | Rasio BBM: input pengisian, km/L, Rp/km, peringkat efisiensi |
| `/fleet/settings` | Part & interval, checklist P2H, data pemeriksa |
| `/fleet/sop` | SOP |

### GOA (`/goa`)
| URL | Isi |
|---|---|
| `/goa` | Dashboard: beban kerja, rasio selesai, tren KPI |
| `/goa/my-tasks` | Task saya: mulai/selesai/tidak selesai + catatan |
| `/goa/board` | Workflow kanban (filter tim) |
| `/goa/tasks` | Tabel semua task + filter + export Excel/PPTX |
| `/goa/planner` | Template task rutin (aktif/blokir) |
| `/goa/team` · `/goa/team/[id]` | Tim & KPI matrix, detail anggota (SP, kehadiran, backup PIC) |
| `/goa/insights` | Saran Performa (rule-based, dijelaskan dari data) |
| `/goa/safety` | Safety Topic (kelola: supervisor) |
| `/goa/settings` | Parameter & bobot KPI |

### Peningkatan logika "AI" (tetap rule-based)
- **Prediksi Servis:** memakai rata-rata km/hari dari `fleet_odometer_logs`
  (30/90 hari terakhir) untuk memperkirakan *tanggal* jatuh tempo, bukan
  hanya sisa km. Diberi tingkat keyakinan berdasarkan jumlah data.
- **Saran Performa:** skor KPI per anggota dipecah per parameter. Saran
  dibuat dari parameter terlemah dan tren 4 minggu, disertai angka
  pendukungnya, sehingga tiap saran bisa ditelusuri asalnya.

---

## 7. Detail P2H (gabungan)

1. Dua pemicu:
   - **pre-trip**: dari booking `approved`. Tombol "Mulai perjalanan"
     terkunci sampai ada P2H untuk booking tersebut (admin bisa override,
     dan override-nya dicatat).
   - **weekly**: dari jadwal / task GOA.
2. Form: pilih kendaraan (default kendaraan yang di-assign ke driver) → KM →
   checklist driver (kesehatan + kerapian) → checklist kendaraan (per
   kategori) → foto 4 sisi (dari kamera, dikompres) → lokasi GPS otomatis.
3. Skor = 100 − jumlah bobot item yang gagal.
   **GROUNDED** jika ada item `is_critical` yang gagal atau skor < 70,
   **CAUTION** jika < 100, selain itu **FIT**.
4. Hasilnya:
   - GROUNDED → status kendaraan `grounded`, tidak bisa di-booking sampai
     perbaikan selesai.
   - Setiap item kendaraan yang gagal → masuk `fleet_repairs` (`queued`).
   - Odometer kendaraan diupdate dan dicatat di `fleet_odometer_logs`.
   - Peringatan pajak ≤ 30 hari dan servis ≤ 500 km ditampilkan.
5. Checklist awal = gabungan 25 item Fleet + 36 item GOA (duplikat
   digabung), 5 cek kesehatan driver + 5 cek kerapian. Item kritis: Mesin,
   Kemudi, Rem, Roda, fokus & fisik driver.

## 8. GPS tracking

- Driver menekan "Mulai perjalanan" → `navigator.geolocation.watchPosition`
  → titik dikirim setiap ±15 detik atau setiap pindah > 50 m ke
  `fleet_trip_points`.
- Admin di `/fleet/monitoring` subscribe Realtime (`postgres_changes`) →
  marker bergerak, dan polyline rute bisa diputar ulang.
- Jarak aktual dihitung dari titik-titik tersebut saat trip selesai.
- **Batasan:** browser/PWA (terutama iOS) **berhenti mengirim lokasi saat
  layar mati atau app di background**. Di halaman trip dipasang Wake Lock
  agar layar tetap menyala, dan ditampilkan peringatan jika GPS terputus.
  Tracking yang benar-benar di background butuh app native, dan itu di luar
  scope proyek ini.

## 9. PWA

`app/manifest.ts` (nama "GOA HZ", `start_url: /`, `display: standalone`),
ikon dihasilkan dari `public/icon.svg` (192/512/maskable). Service worker
via Serwist untuk cache shell & aset statis, ditambah halaman offline
sederhana. Tidak ada offline write (data tetap butuh koneksi).

## 10. Migrasi data lama

Script `scripts/migrate/` (TypeScript, dijalankan lokal dengan service role):

1. Baca dump dari user (JSON/CSV per tabel lama).
2. **Karyawan**: gabung `employees` Asset + Fleet + `p2h_drivers` + `users`
   GOA berdasarkan NRP. Company diambil dari `company_name`
   (`PT. Garuda Mart Indonesia` → GMI, dll.). Konflik dicatat ke laporan.
3. **Site**: gabung `sites` + `operational_sites` berdasarkan nama.
4. **Kendaraan**: gabung `vehicles` + `p2h_vehicles` berdasarkan plat.
5. Lalu entitas transaksi (aset, pinjam, mutasi, audit, booking, P2H dari
   kedua sumber, perbaikan, BBM, task, KPI). ID lama disimpan di kolom
   `legacy_id` agar bisa ditelusuri.
6. Foto: base64 → upload ke Storage. Link Google Drive → diunduh lalu
   diupload, atau link tetap disimpan jika gagal.
7. Akun: untuk tiap user lama dibuat akun Supabase Auth (email asli atau
   `nrp@demo.com`, password `demo1234`). Role lama dipetakan ke
   `module_access`.
8. Hasilnya berupa laporan (`migration-report.md`): jumlah per tabel, baris
   yang dilewati, dan konflik.

Dry-run dulu ke database lokal (`supabase start`), baru ke production.

## 11. Fase pengerjaan

| Fase | Isi | Selesai jika |
|---|---|---|
| 0. Fondasi | `git init`, pindahkan HTML ke `legacy/`, scaffold Next, copy styling & komponen dari ga-web, favicon "H", manifest | `npm run build` lolos, halaman kosong tampil di 4 mode tema |
| 1. Core | Migration core + RLS + helper, auth (login email/NRP, sign-up nonaktif, pending, ganti password), layout sidebar + ModuleSwitcher, Admin (users, employees, sites, settings) | Moderator bisa membuat user GMI & GIS, dan masing-masing hanya melihat data company-nya |
| 2. Asset | Seluruh halaman Asset + cetak + QR + Excel | Alur pinjam & mutasi end-to-end |
| 3. Fleet | Armada, driver, booking, P2H gabungan, perbaikan, BBM, prediksi, GPS + monitoring | Booking → P2H → trip dengan GPS → selesai. Kendaraan GROUNDED terblokir |
| 4. GOA | Task, board, planner + cron, KPI, insights, safety, export PPTX, integrasi P2H mingguan | Template rutin menghasilkan task otomatis keesokan harinya |
| 5. Polish | Notifikasi, PWA/service worker, pencarian menu, aksesibilitas, reduced motion | Checklist §11 styling guide lolos |
| 6. Migrasi | Script + dry-run + laporan + eksekusi ke production | Laporan migrasi disetujui user |

Setiap fase diakhiri dengan `build` + `lint` + tes manual di browser. Commit
dilakukan per fase.

## 12. Pertanyaan terbuka

Tidak ada. Semua sudah dijawab per 2026-10-13.
