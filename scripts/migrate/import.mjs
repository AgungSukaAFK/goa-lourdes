// Import data 3 sistem lama (Asset, Fleet, GOA) ke database GOA HZ.
//
//   node --env-file=.env.local scripts/migrate/import.mjs --dry-run
//   node --env-file=.env.local scripts/migrate/import.mjs [--fleet-company=GMI] [--goa-company=GMI]
//        [--accounts=all|none] [--skip-photos]
//
// Sumber: migration-data/{asset,fleet,goa}/<tabel lama>.json|.csv (lihat export-legacy.mjs).
// Aman dijalankan ulang: semua baris memakai kunci alami (NRP, plat, kode aset)
// atau kode "*-LEGACY-<id lama>" sehingga upsert tidak menggandakan data.
// Hasil: migration-report.md.
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { Report, load, normName, normPlate, num, parseCompany, str, toDate, toTs } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const DRY = !!args["dry-run"];
const FLEET_CO = parseCompany(args["fleet-company"], "GMI");
const GOA_CO = parseCompany(args["goa-company"], "GMI");
const ACCOUNTS = args.accounts ?? "all";
const PHOTOS = !args["skip-photos"];
const PASSWORD = "demo1234";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const R = new Report();
const startedAt = new Date().toISOString();

/** Tulis (atau pura-pura menulis saat dry-run). Mengembalikan baris hasil. */
async function upsert(table, rows, onConflict, select = "*") {
  if (!rows.length) return [];
  if (DRY) return rows.map((r, i) => ({ id: `dry-${table}-${i}`, ...r }));
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict }).select(select);
    if (error) {
      // Satu-satu supaya baris yang bermasalah ketahuan.
      for (const r of rows.slice(i, i + 500)) {
        const { data: d1, error: e1 } = await db.from(table).upsert(r, { onConflict }).select(select);
        if (e1) R.note(`${table}: gagal ${JSON.stringify(r).slice(0, 140)} → ${e1.message}`);
        else out.push(...d1);
      }
    } else out.push(...data);
  }
  return out;
}

async function fetchAll(table, select = "*") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** data:image/...;base64 atau URL http -> upload ke storage. */
async function uploadImage(bucket, pathNoExt, src) {
  if (!PHOTOS || DRY || !src) return null;
  try {
    let buf, type;
    if (String(src).startsWith("data:")) {
      const m = String(src).match(/^data:([^;]+);base64,(.*)$/s);
      if (!m) return null;
      type = m[1];
      buf = Buffer.from(m[2], "base64");
    } else if (/^https?:\/\//.test(src)) {
      // Link Google Drive "view" -> unduhan langsung
      const id = String(src).match(/\/d\/([^/]+)|[?&]id=([^&]+)/);
      const url = id ? `https://drive.google.com/uc?export=download&id=${id[1] ?? id[2]}` : src;
      const res = await fetch(url, { redirect: "follow" });
      type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } else return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${pathNoExt}.${ext}`;
    const { error } = await db.storage.from(bucket).upload(path, buf, { contentType: type, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Data sumber
// ---------------------------------------------------------------------------
const A = {
  sites: await load("asset", "sites"),
  categories: await load("asset", "categories"),
  employees: await load("asset", "employees"),
  assets: await load("asset", "assets"),
  loans: await load("asset", "loans"),
  mutations: await load("asset", "mutations"),
  audits: await load("asset", "audits"),
  users: await load("asset", "system_users"),
  configs: await load("asset", "system_configs"),
};
const F = {
  sites: await load("fleet", "operational_sites"),
  employees: await load("fleet", "employees"),
  vehicles: await load("fleet", "vehicles"),
  drivers: await load("fleet", "drivers"),
  assignments: await load("fleet", "assignments"),
  inspectors: await load("fleet", "inspectors"),
  parts: await load("fleet", "part_settings"),
  bookings: await load("fleet", "bookings"),
  p2h: await load("fleet", "p2h_history"),
  repairs: await load("fleet", "repair_list"),
  fuel: await load("fleet", "fuel_consumption"),
};
const G = {
  users: await load("goa", "users"),
  tasks: await load("goa", "tasks"),
  blocked: await load("goa", "goa_blocked_plans"),
  kpi: await load("goa", "kpi_settings"),
  drivers: await load("goa", "p2h_drivers"),
  vehicles: await load("goa", "p2h_vehicles"),
  assignments: await load("goa", "p2h_assignments"),
  p2h: await load("goa", "p2h_completed_logs"),
};

R.section("Data sumber");
for (const [sys, obj] of Object.entries({ asset: A, fleet: F, goa: G })) {
  for (const [k, v] of Object.entries(obj)) R.count(`${sys}.${k}`, v.length);
}

// ---------------------------------------------------------------------------
// 1. Site (dipakai bersama -> company LOURDES)
// ---------------------------------------------------------------------------
R.section("Site");
const siteNames = new Set(
  [
    ...A.sites.map((s) => s.name),
    ...A.employees.map((e) => e.site),
    ...A.assets.map((a) => a.site),
    ...F.sites.map((s) => s.name),
    ...F.vehicles.map((v) => v.area),
    ...F.employees.map((e) => e.work_location),
  ]
    .map(str)
    .filter(Boolean),
);
const siteRows = await upsert("sites", [...siteNames].map((name) => ({ name, company: "LOURDES" })), "name,company", "id, name");
const siteId = new Map(siteRows.map((s) => [normName(s.name), s.id]));
R.count("site", siteRows.length);

// ---------------------------------------------------------------------------
// 2. Karyawan (gabungan berdasarkan NRP)
// ---------------------------------------------------------------------------
R.section("Karyawan");
const emp = new Map();
const addEmp = (nrp, patch, source) => {
  const k = str(nrp);
  if (!k) return;
  const cur = emp.get(k) ?? { nrp: k, sources: new Set() };
  for (const [f, v] of Object.entries(patch)) if (v !== null && v !== undefined && v !== "" && cur[f] == null) cur[f] = v;
  cur.sources.add(source);
  emp.set(k, cur);
};
for (const e of A.employees)
  addEmp(e.nrp, { name: str(e.name), company: parseCompany(e.company_name), position: str(e.position), site: str(e.site), photo: e.photo }, "asset");
for (const e of F.employees) addEmp(e.nrp, { name: str(e.name), company: FLEET_CO, division: str(e.division), site: str(e.work_location) }, "fleet");
for (const d of F.drivers) addEmp(d.nrp, { name: str(d.name), company: FLEET_CO, position: "Driver" }, "fleet-driver");
for (const u of A.users) addEmp(u.nrp, { name: str(u.name), company: "LOURDES" }, "asset-user");

const empRows = await upsert(
  "employees",
  [...emp.values()]
    .filter((e) => e.name)
    .map((e) => ({
      nrp: e.nrp,
      name: e.name,
      company: e.company ?? "GMI",
      position: e.position ?? null,
      division: e.division ?? null,
      site_id: e.site ? (siteId.get(normName(e.site)) ?? null) : null,
      legacy_id: [...e.sources].join(","),
    })),
  "nrp",
  "id, nrp, name, company",
);
for (const e of emp.values()) if (!e.name) R.note(`NRP ${e.nrp} tanpa nama, dilewati.`);
const empByNrp = new Map(empRows.map((e) => [e.nrp, e]));
const empByName = new Map(empRows.map((e) => [normName(e.name), e]));
R.count("karyawan", empRows.length);

/** Karyawan berdasarkan nama; dibuat baru (NRP sementara) kalau belum ada. */
const pendingByName = [];
async function employeeByName(name, company, tag) {
  const n = normName(name);
  if (!n) return null;
  if (empByName.has(n)) return empByName.get(n);
  const nrp = `${tag}-${n.replace(/[^a-z0-9]+/g, "").slice(0, 20)}`;
  const [row] = await upsert("employees", [{ nrp, name: str(name), company, legacy_id: tag }], "nrp", "id, nrp, name, company");
  if (row) {
    empByName.set(n, row);
    empByNrp.set(nrp, row);
    pendingByName.push(`${name} → NRP sementara ${nrp}`);
  }
  return row ?? null;
}

// ---------------------------------------------------------------------------
// 3. Asset
// ---------------------------------------------------------------------------
R.section("Asset");
const catNames = new Map();
for (const c of A.categories) catNames.set(normName(c.name), { name: str(c.name), depreciation_years: num(c.depreciation_years, 4) });
for (const a of A.assets) if (a.category && !catNames.has(normName(a.category))) catNames.set(normName(a.category), { name: str(a.category), depreciation_years: num(a.depreciation_years, 4) });
const catRows = await upsert("asset_categories", [...catNames.values()].filter((c) => c.name), "name", "id, name");
const catId = new Map(catRows.map((c) => [normName(c.name), c.id]));
R.count("kategori", catRows.length);

// Format kode per PT dari konfigurasi lama (kalau ada)
const fmt = A.configs.find((c) => /format/i.test(JSON.stringify(c)));
if (fmt) R.note(`Konfigurasi lama ditemukan: ${JSON.stringify(fmt).slice(0, 160)}. Cek Admin → Pengaturan.`);

const ASSET_STATUS = { READY: "ready", DIPINJAM: "loaned", LOANED: "loaned", RUSAK: "damaged", HILANG: "lost", DISPOSAL: "disposed", DISPOSED: "disposed" };
const assetRowsIn = [];
for (const a of A.assets) {
  const code = str(a.code);
  if (!code || !str(a.name)) {
    R.note(`Aset tanpa kode/nama dilewati: ${JSON.stringify(a).slice(0, 100)}`);
    continue;
  }
  const company = parseCompany(a.company_name, "GMI");
  const owner = str(a.ownerNrp ?? a.owner_nrp);
  if (owner && owner !== "-" && !empByNrp.has(owner)) R.note(`Aset ${code}: pemegang NRP ${owner} tidak ada di data karyawan.`);
  assetRowsIn.push({
    code,
    accurate_code: str(a.accurate_code) === "-" ? null : str(a.accurate_code),
    name: str(a.name),
    category_id: a.category ? (catId.get(normName(a.category)) ?? null) : null,
    brand: str(a.brand) === "-" ? null : str(a.brand),
    model: str(a.model) === "-" ? null : str(a.model),
    status: ASSET_STATUS[String(a.status ?? "").toUpperCase()] ?? "ready",
    cost: num(a.cost, 0),
    purchase_date: toDate(a.purchase_date),
    depreciation_years: num(a.depreciation_years, 4),
    site_id: a.site ? (siteId.get(normName(a.site)) ?? null) : null,
    owner_employee_id: owner && owner !== "-" ? (empByNrp.get(owner)?.id ?? null) : null,
    is_borrowable: a.is_borrowable === true || ["true", "ya", "yes"].includes(String(a.is_borrowable).toLowerCase()),
    mr_number: str(a.mr_number) === "-" ? null : str(a.mr_number),
    po_number: str(a.po_number) === "-" ? null : str(a.po_number),
    company,
    legacy_id: str(a.id) ?? code,
    _photo: a.photo,
  });
}
const assetRows = await upsert("assets", assetRowsIn.map(({ _photo, ...r }) => r), "code", "id, code, company");
const assetByCode = new Map(assetRows.map((a) => [a.code, a]));
R.count("aset", assetRows.length);
let photoOk = 0;
for (const a of assetRowsIn.filter((x) => x._photo)) {
  const row = assetByCode.get(a.code);
  if (!row) continue;
  const p = await uploadImage("asset-photos", `${row.company}/${row.id}/legacy`, a._photo);
  if (p) {
    await db.from("assets").update({ photo_path: p }).eq("id", row.id);
    photoOk++;
  }
}
R.count("foto aset terupload", photoOk);

const LOAN = { "MENUNGGU PERSETUJUAN GA": "pending", "DISETUJUI GA": "approved", SELESAI: "returned", DITOLAK: "rejected" };
const loanRows = [];
for (const l of A.loans) {
  const asset = assetByCode.get(str(l.assetCode ?? l.asset_code));
  const borrower = empByNrp.get(str(l.ownerNrp ?? l.owner_nrp));
  if (!asset || !borrower) {
    R.note(`Pinjaman ${l.id}: aset/peminjam tidak ditemukan (${l.assetCode}, ${l.ownerNrp}).`);
    continue;
  }
  const borrow = toDate(l.borrowDate) ?? toDate(l.created_at) ?? new Date().toISOString().slice(0, 10);
  let due = toDate(l.expectedReturnDate) ?? borrow;
  if (due < borrow) due = borrow;
  loanRows.push({
    code: `LN-LEGACY-${l.id}`,
    asset_id: asset.id,
    borrower_employee_id: borrower.id,
    company: asset.company,
    borrow_date: borrow,
    expected_return_date: due,
    actual_return_date: toDate(l.actualReturnDate),
    purpose: str(l.purpose),
    status: LOAN[String(l.status ?? "").toUpperCase()] ?? "returned",
    legacy_id: str(l.id),
  });
}
R.count("peminjaman", (await upsert("asset_loans", loanRows, "code", "id")).length);

const MUT = { PENDING: "pending", "DISETUJUI GA": "approved", DITOLAK: "rejected" };
const mutRows = [];
for (const m of A.mutations) {
  const asset = assetByCode.get(str(m.assetCode));
  const to = empByNrp.get(str(m.targetEmployeeNrp));
  if (!asset) {
    R.note(`Mutasi ${m.id}: aset ${m.assetCode} tidak ditemukan.`);
    continue;
  }
  mutRows.push({
    code: `MT-LEGACY-${m.id}`,
    asset_id: asset.id,
    company: asset.company,
    from_employee_id: empByNrp.get(str(m.prevOwnerNrp))?.id ?? null,
    to_employee_id: to?.id ?? null,
    reason: str(m.reason),
    status: MUT[String(m.status ?? "").toUpperCase()] ?? "approved",
    created_at: toTs(m.time) ?? undefined,
    legacy_id: str(m.id),
  });
}
R.count("mutasi", (await upsert("asset_mutations", mutRows, "code", "id")).length);

const auditRows = [];
for (const a of A.audits) {
  const asset = assetByCode.get(str(a.assetCode));
  if (!asset) {
    R.note(`Audit ${a.code}: aset ${a.assetCode} tidak ditemukan.`);
    continue;
  }
  const done = /TERPENUHI|SELESAI|DONE/i.test(String(a.status));
  auditRows.push({
    code: `AUD-LEGACY-${a.code ?? a.id}`,
    asset_id: asset.id,
    company: asset.company,
    due_date: toDate(a.dueDate) ?? new Date().toISOString().slice(0, 10),
    status: done ? "fulfilled" : "waiting",
    found_condition: done ? "ready" : null,
    notes: str(a.notes),
    realized_at: done ? (toTs(a.updated_at) ?? new Date().toISOString()) : null,
    legacy_id: str(a.id ?? a.code),
  });
}
R.count("audit", (await upsert("asset_audits", auditRows, "code", "id")).length);

// ---------------------------------------------------------------------------
// 4. Fleet: kendaraan (gabungan Fleet + GOA P2H, berdasarkan plat)
// ---------------------------------------------------------------------------
R.section("Fleet");
const veh = new Map();
for (const v of F.vehicles) {
  const plate = normPlate(v.plate);
  if (!plate) continue;
  const logs = Array.isArray(v.log_km) ? v.log_km : (() => { try { return JSON.parse(v.log_km ?? "[]"); } catch { return []; } })();
  veh.set(plate, { plate, model: str(v.model) ?? "-", odometer: num(v.km, 0), site: str(v.area), tax_date: toDate(v.tax_date), kir_date: toDate(v.kir_date), plate_date: toDate(v.plate_date), logs, fleetId: str(v.id) });
}
for (const v of G.vehicles) {
  const plate = normPlate(v.plate);
  if (!plate) continue;
  const cur = veh.get(plate) ?? { plate, model: str(v.model) ?? "-", odometer: 0, logs: [] };
  cur.odometer = Math.max(cur.odometer ?? 0, num(v.last_odo, 0));
  cur.service_interval_km = num(v.interval, null) ?? cur.service_interval_km;
  cur.tax_date = cur.tax_date ?? toDate(v.tax_date);
  cur.goaKey = str(v.key);
  veh.set(plate, cur);
}
const vehRows = await upsert(
  "fleet_vehicles",
  [...veh.values()].map((v) => {
    const interval = v.service_interval_km ?? 5000;
    return {
      plate: v.plate,
      model: v.model,
      company: FLEET_CO,
      site_id: v.site ? (siteId.get(normName(v.site)) ?? null) : null,
      odometer: v.odometer,
      service_interval_km: interval,
      last_service_odo: Math.floor(v.odometer / interval) * interval,
      tax_date: v.tax_date ?? null,
      kir_date: v.kir_date ?? null,
      plate_date: v.plate_date ?? null,
      legacy_id: [v.fleetId, v.goaKey].filter(Boolean).join(",") || null,
    };
  }),
  "plate",
  "id, plate, company",
);
const vehByPlate = new Map(vehRows.map((v) => [v.plate, v]));
const vehByLegacy = new Map();
for (const v of veh.values()) {
  const row = vehByPlate.get(v.plate);
  if (!row) continue;
  if (v.fleetId) vehByLegacy.set(`fleet:${v.fleetId}`, row);
  if (v.goaKey) vehByLegacy.set(`goa:${v.goaKey}`, row);
}
R.count("kendaraan", vehRows.length);

if (!DRY) {
  const odo = [];
  for (const v of veh.values()) {
    const row = vehByPlate.get(v.plate);
    for (const l of v.logs ?? []) if (row && num(l.km) != null && toTs(l.date)) odo.push({ vehicle_id: row.id, odometer: num(l.km), source: "import", recorded_at: toTs(l.date) });
  }
  // Hapus log import lama dulu supaya tidak dobel saat dijalankan ulang.
  await db.from("fleet_odometer_logs").delete().eq("source", "import").in("vehicle_id", vehRows.map((v) => v.id));
  for (let i = 0; i < odo.length; i += 500) await db.from("fleet_odometer_logs").insert(odo.slice(i, i + 500));
  R.count("log KM", odo.length);
}

// Driver: Fleet (NRP) + GOA (nama)
const driverRowsIn = new Map();
const driverLegacy = new Map();
for (const d of F.drivers) {
  const e = empByNrp.get(str(d.nrp));
  if (!e) continue;
  driverRowsIn.set(e.id, { employee_id: e.id, company: e.company, legacy_id: `fleet:${d.id}` });
  driverLegacy.set(`fleet:${d.id}`, e.id);
}
for (const d of G.drivers) {
  const e = await employeeByName(d.name, FLEET_CO, "GOA");
  if (!e) continue;
  if (!driverRowsIn.has(e.id)) driverRowsIn.set(e.id, { employee_id: e.id, company: e.company, legacy_id: `goa:${d.key ?? d.id}` });
  driverLegacy.set(`goa:${d.key}`, e.id);
  driverLegacy.set(`goa:${d.id}`, e.id);
}
const drvRows = await upsert("fleet_drivers", [...driverRowsIn.values()], "employee_id", "id, employee_id");
const drvByEmp = new Map(drvRows.map((d) => [d.employee_id, d.id]));
const driverId = (legacyKey) => drvByEmp.get(driverLegacy.get(legacyKey)) ?? null;
R.count("driver", drvRows.length);

const assign = [];
for (const a of F.assignments) {
  const d = driverId(`fleet:${a.driver_id}`);
  const v = vehByLegacy.get(`fleet:${a.vehicle_id}`);
  if (d && v) assign.push({ driver_id: d, vehicle_id: v.id });
}
for (const a of G.assignments) {
  const d = driverId(`goa:${a.driver_key ?? a.driver_id ?? a.driver}`);
  const v = vehByLegacy.get(`goa:${a.vehicle_key ?? a.vehicle_id ?? a.vehicle}`);
  if (d && v) assign.push({ driver_id: d, vehicle_id: v.id });
}
R.count("assignment driver-kendaraan", (await upsert("fleet_driver_vehicles", assign, "driver_id,vehicle_id", "driver_id")).length);

if (!DRY && F.inspectors.length) {
  const { data: existing } = await db.from("fleet_inspectors").select("name");
  const have = new Set((existing ?? []).map((x) => normName(x.name)));
  const ins = F.inspectors.filter((i) => str(i.name) && !have.has(normName(i.name))).map((i) => ({ name: str(i.name), company: "LOURDES" }));
  if (ins.length) await db.from("fleet_inspectors").insert(ins);
  R.count("pemeriksa", ins.length);
}

if (!DRY && F.parts.length) {
  const { data: existing } = await db.from("fleet_parts").select("id, name");
  const byName = new Map((existing ?? []).map((p) => [normName(p.name), p.id]));
  for (const p of F.parts) {
    const row = {
      name: str(p.name),
      type: String(p.type).toUpperCase() === "KM" ? "km" : "days",
      interval: num(p.interval, 5000),
      cost: num(p.cost, 0),
      vehicle_ids: !p.vehicle_id || p.vehicle_id === "ALL" ? null : [vehByLegacy.get(`fleet:${p.vehicle_id}`)?.id].filter(Boolean),
      legacy_id: str(p.id),
    };
    if (!row.name) continue;
    const id = byName.get(normName(row.name));
    if (id) await db.from("fleet_parts").update(row).eq("id", id);
    else await db.from("fleet_parts").insert(row);
    R.count("part");
  }
}

// Booking
const BK = { "MENUNGGU PERSETUJUAN": "pending", DISETUJUI: "approved", "SEDANG DIGUNAKAN": "in_use", SELESAI: "completed", DIBATALKAN: "cancelled", DITOLAK: "rejected", DENIED: "rejected" };
const bookingRows = [];
for (const b of F.bookings) {
  const v = vehByLegacy.get(`fleet:${b.vehicle_id}`) ?? vehByPlate.get(normPlate(b.vehicle_plate));
  const start = toTs(b.start_time);
  let end = toTs(b.end_time);
  if (!v || !start) {
    R.note(`Booking ${b.id}: kendaraan/waktu tidak valid.`);
    continue;
  }
  if (!end || end <= start) end = new Date(new Date(start).getTime() + 3600e3).toISOString();
  const status = BK[String(b.status ?? "").toUpperCase()] ?? "completed";
  bookingRows.push({
    code: `BKG-LEGACY-${b.id}`,
    company: v.company,
    requester_employee_id: empByNrp.get(str(b.nrp))?.id ?? (await employeeByName(b.name, v.company, "FLT"))?.id ?? null,
    vehicle_id: v.id,
    purpose: str(b.purpose) ?? "-",
    destination: str(b.destination),
    dest_lat: num(b.dest_lat),
    dest_lng: num(b.dest_lng),
    start_time: start,
    end_time: end,
    est_distance_km: num(b.actual_distance),
    est_cost: num(b.est_cost),
    // Perjalanan lama yang masih "dipakai" dianggap selesai (tidak ada GPS untuk dilanjutkan).
    status: status === "in_use" ? "completed" : status,
    last_lat: num(b.live_lat),
    last_lng: num(b.live_lng),
    legacy_id: str(b.id),
  });
}
const bkRows = await upsert("fleet_bookings", bookingRows, "code", "id, code, legacy_id");
const bookingByLegacy = new Map(bkRows.map((b) => [b.legacy_id, b.id]));
R.count("booking", bkRows.length);

// P2H: Fleet (harian) + GOA (mingguan)
const resultFromScore = (s) => (s < 70 ? "grounded" : s < 100 ? "caution" : "fit");
const p2hRowsIn = [];
for (const h of F.p2h) {
  const v = vehByPlate.get(normPlate(h.vehicle_plate));
  if (!v) {
    R.note(`P2H Fleet ${h.id}: kendaraan ${h.vehicle_plate} tidak ditemukan.`);
    continue;
  }
  const drv = h.driver_name ? drvByEmp.get((await employeeByName(h.driver_name, v.company, "FLT"))?.id) : null;
  const broken = Array.isArray(h.broken_list) ? h.broken_list : String(h.broken_list ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const score = num(h.score, 100);
  p2hRowsIn.push({
    code: `P2H-LEGACY-F${h.id}`,
    company: v.company,
    vehicle_id: v.id,
    driver_id: drv ?? null,
    booking_id: h.booking_id ? (bookingByLegacy.get(String(h.booking_id)) ?? null) : null,
    kind: "pre_trip",
    inspector_name: str(h.inspector),
    odometer: num(h.km_check, 0),
    score,
    result: resultFromScore(score),
    answers: [],
    issues: [...broken, ...(h.driver_health && h.driver_health !== "Sangat Sehat" ? [`Driver: ${h.driver_health}`] : [])],
    notes: "Import dari Fleet lama",
    created_at: toTs(h.date) ?? undefined,
    legacy_id: `fleet:${h.id}`,
  });
}
const GRES = (t) => (/GROUNDED|TIDAK LAYAK/i.test(t) ? "grounded" : /CAUTION|CATATAN/i.test(t) ? "caution" : "fit");
const goaPhotos = [];
for (const h of G.p2h) {
  const v = vehByPlate.get(normPlate(h.vehicle_plate));
  if (!v) {
    R.note(`P2H GOA ${h.id}: kendaraan ${h.vehicle_plate} tidak ditemukan.`);
    continue;
  }
  const drv = driverId(`goa:${h.driver_key}`) ?? driverId(`goa:${h.driver_id}`) ?? (h.driver_name ? drvByEmp.get((await employeeByName(h.driver_name, v.company, "GOA"))?.id) : null);
  const list = (x) => (Array.isArray(x) ? x : (() => { try { return JSON.parse(x ?? "[]"); } catch { return String(x ?? "").split(/[,;]\s*/).filter(Boolean); } })());
  const loc = typeof h.location === "string" ? (() => { try { return JSON.parse(h.location); } catch { return null; } })() : h.location;
  const code = `P2H-LEGACY-G${h.id}`;
  p2hRowsIn.push({
    code,
    company: v.company,
    vehicle_id: v.id,
    driver_id: drv ?? null,
    kind: "weekly",
    odometer: num(h.odometer, 0),
    score: num(h.score, 100),
    result: GRES(String(h.status ?? "")),
    answers: [],
    issues: [...list(h.drv_issues).map((x) => `Driver: ${x}`), ...list(h.veh_issues)],
    notes: "Import dari P2H Online GO (GOA lama)",
    lat: num(loc?.lat),
    lng: num(loc?.lng),
    next_due_date: toDate(h.next_week_date),
    created_at: toTs(h.time ?? h.created_at) ?? undefined,
    legacy_id: `goa:${h.id}`,
  });
  const ph = typeof h.photos === "string" ? (() => { try { return JSON.parse(h.photos); } catch { return null; } })() : h.photos;
  if (ph) goaPhotos.push({ code, company: v.company, vehicle: v.id, photos: ph });
}
const p2hRows = await upsert("fleet_p2h_inspections", p2hRowsIn, "code", "id, code");
const p2hByCode = new Map(p2hRows.map((p) => [p.code, p.id]));
R.count("P2H", p2hRows.length);
let p2hPhotoOk = 0, p2hPhotoFail = 0;
const SIDE = { depan: "front", belakang: "back", kiri: "left", kanan: "right" };
for (const g of goaPhotos) {
  const id = p2hByCode.get(g.code);
  if (!id || DRY) continue;
  await db.from("fleet_p2h_photos").delete().eq("inspection_id", id);
  for (const [k, url] of Object.entries(g.photos)) {
    if (!url) continue;
    const path = await uploadImage("p2h-photos", `${g.company}/${g.vehicle}/legacy-${id}-${k}`, url);
    if (path) {
      await db.from("fleet_p2h_photos").insert({ inspection_id: id, side: SIDE[k] ?? "other", path });
      p2hPhotoOk++;
    } else p2hPhotoFail++;
  }
}
R.count("foto P2H terupload", p2hPhotoOk);
if (p2hPhotoFail) R.note(`${p2hPhotoFail} foto P2H GOA (Google Drive) gagal diunduh. Biasanya karena file Drive tidak dibagikan publik.`);

const REP = { ANTREAN: "queued", SELESAI: "done", DIKERJAKAN: "in_progress", PROSES: "in_progress" };
const repRows = [];
for (const r of F.repairs) {
  const v = vehByPlate.get(normPlate(r.vehicle_id)) ?? vehByLegacy.get(`fleet:${r.vehicle_id}`);
  if (!v) {
    R.note(`Perbaikan ${r.id}: kendaraan ${r.vehicle_id} tidak ditemukan.`);
    continue;
  }
  const status = REP[String(r.status ?? "").toUpperCase()] ?? "queued";
  repRows.push({
    code: `REP-LEGACY-${r.id}`,
    company: v.company,
    vehicle_id: v.id,
    component: str(r.component) ?? "-",
    status,
    reported_by_name: str(r.driver_name),
    mechanic: str(r.mechanic),
    actual_cost: num(r.actual_cost),
    created_at: toTs(r.reported_date) ?? undefined,
    done_at: status === "done" ? (toTs(r.done_date ?? r.updated_at) ?? toTs(r.reported_date)) : null,
    legacy_id: str(r.id),
  });
}
R.count("perbaikan", (await upsert("fleet_repairs", repRows, "code", "id")).length);

if (!DRY && F.fuel.length) {
  await db.from("fleet_fuel_logs").delete().like("legacy_id", "fleet:%");
  const rows = [];
  for (const f of F.fuel) {
    const v = vehByLegacy.get(`fleet:${f.vehicle_id}`) ?? vehByPlate.get(normPlate(f.vehicle_plate));
    const s = num(f.start_odo), e = num(f.end_odo), l = num(f.fuel_volume);
    if (!v || s == null || e == null || !l || e <= s) {
      R.note(`BBM ${f.id}: data tidak lengkap / KM tidak valid, dilewati.`);
      continue;
    }
    const drvEmp = empByNrp.get(str(f.driver_nrp)) ?? (f.driver_name ? await employeeByName(f.driver_name, v.company, "FLT") : null);
    rows.push({ company: v.company, vehicle_id: v.id, driver_id: drvEmp ? (drvByEmp.get(drvEmp.id) ?? null) : null, date: toDate(f.date), start_odo: s, end_odo: e, liters: l, total_cost: num(f.total_cost, 0), legacy_id: `fleet:${f.id}` });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("fleet_fuel_logs").insert(rows.slice(i, i + 500));
    if (error) R.note(`BBM: ${error.message}`);
  }
  R.count("BBM", rows.length);
}

// ---------------------------------------------------------------------------
// 5. Akun login (Asset system_users, driver Fleet, user GOA)
// ---------------------------------------------------------------------------
R.section("Akun login");
const profiles = DRY ? [] : await fetchAll("profiles", "id, nrp, email");
const profByNrp = new Map(profiles.filter((p) => p.nrp).map((p) => [p.nrp.toLowerCase(), p]));
const access = new Map(); // profileId -> {asset, fleet, goa}

async function ensureAccount({ login, name, employee, company }) {
  const key = login.toLowerCase();
  if (profByNrp.has(key)) return profByNrp.get(key).id;
  if (DRY) {
    R.count("akun baru (dry-run)");
    profByNrp.set(key, { id: `dry-${key}` });
    return `dry-${key}`;
  }
  const email = `${key.replace(/[^a-z0-9._-]/g, "")}@demo.com`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name, nrp: login } });
  if (error) {
    R.note(`Akun ${login} gagal dibuat: ${error.message}`);
    return null;
  }
  await db.from("profiles").update({ nrp: login, name, company: company ?? "GMI", employee_id: employee?.id ?? null, is_active: true }).eq("id", data.user.id);
  profByNrp.set(key, { id: data.user.id });
  R.count("akun baru");
  return data.user.id;
}
const grant = (pid, module, role, permissions = {}) => {
  if (!pid) return;
  const cur = access.get(pid) ?? {};
  // Role yang lebih tinggi menang kalau orang yang sama muncul dua kali.
  const rank = { admin: 3, supervisor: 3, staff: 1, member: 1, driver: 1, employee: 0, guest: 0 };
  if (!cur[module] || rank[role] > rank[cur[module].role]) cur[module] = { role, permissions };
  access.set(pid, cur);
};

if (ACCOUNTS !== "none") {
  // Asset
  const PERM_KEYS = ["dashboard", "assets", "loans", "mutations", "audits", "config", "sop"];
  for (const u of A.users) {
    const nrp = str(u.nrp);
    if (!nrp) continue;
    const e = empByNrp.get(nrp);
    const pid = await ensureAccount({ login: nrp, name: str(u.name) ?? nrp, employee: e, company: e?.company });
    const perms = typeof u.permissions === "string" ? JSON.parse(u.permissions || "{}") : (u.permissions ?? {});
    grant(pid, "asset", /admin/i.test(u.role) ? "admin" : "staff", Object.fromEntries(PERM_KEYS.filter((k) => perms[k]).map((k) => [k, perms[k]])));
  }
  // Driver Fleet
  for (const d of drvRows) {
    const e = [...empByNrp.values()].find((x) => x.id === d.employee_id);
    if (!e) continue;
    const pid = await ensureAccount({ login: e.nrp, name: e.name, employee: e, company: e.company });
    grant(pid, "fleet", "driver");
  }
  // GOA
  const GOA_ROLE = { atasan: "supervisor", tim: "member", guest: "guest" };
  const goaUserIds = new Map();
  for (const u of G.users) {
    const username = str(u.username);
    if (!username) continue;
    const e = empByName.get(normName(u.name));
    const pid = await ensureAccount({ login: e?.nrp ?? username, name: str(u.name) ?? username, employee: e, company: e?.company ?? GOA_CO });
    goaUserIds.set(username.toLowerCase(), pid);
    grant(pid, "goa", GOA_ROLE[String(u.role).toLowerCase()] ?? "member");
  }
  if (!DRY) {
    const rows = [];
    for (const [pid, mods] of access) for (const [module, a] of Object.entries(mods)) rows.push({ user_id: pid, module, role: a.role, permissions: a.permissions ?? {} });
    const { error } = await db.from("module_access").upsert(rows, { onConflict: "user_id,module" });
    if (error) R.note(`Akses modul: ${error.message}`);
    R.count("akses modul", rows.length);
    // Data tim GOA
    const SP = { "SP 1": "sp1", "SP 2": "sp2", "SP 3": "sp3" };
    for (const u of G.users) {
      const pid = goaUserIds.get(String(u.username).toLowerCase());
      if (!pid) continue;
      const presence = String(u.status_kehadiran ?? "hadir").toLowerCase();
      await db.from("goa_members").upsert({
        profile_id: pid,
        title: str(u.jabatan),
        sp_level: SP[u.sp_level] ?? "none",
        sp_date: SP[u.sp_level] ? toDate(u.sp_date) : null,
        presence_status: ["hadir", "cuti", "sakit", "izin", "dinas"].includes(presence) ? presence : "hadir",
        backup_profile_id: u.backup_pic && u.backup_pic !== "General/Pending" ? (goaUserIds.get(String(u.backup_pic).toLowerCase()) ?? null) : null,
      });
      if (u.avatar) {
        const p = await uploadImage("avatars", `${pid}/legacy`, u.avatar);
        if (p) await db.from("profiles").update({ avatar_path: p }).eq("id", pid);
      }
    }
  }
  globalThis.goaUserIds = goaUserIds;
}

// ---------------------------------------------------------------------------
// 6. GOA: template rutin, tugas, KPI
// ---------------------------------------------------------------------------
R.section("GOA");
const goaUser = (u) => {
  const k = String(u ?? "").toLowerCase();
  if (!k || k === "general/pending") return null;
  return globalThis.goaUserIds?.get(k) ?? null;
};
const blocked = new Set(G.blocked.map((b) => `${normName(b.tugas)}|${String(b.tim).toLowerCase()}`));
const tplMap = new Map();
for (const t of G.tasks.filter((t) => String(t.tipe).toLowerCase() === "rutin" && str(t.routine_days) !== null)) {
  const k = `${normName(t.tugas)}|${String(t.tim).toLowerCase()}`;
  if (tplMap.has(k)) continue;
  tplMap.set(k, {
    company: GOA_CO,
    title: str(t.tugas),
    description: str(t.deskripsi),
    job_category: str(t.job_category),
    assignee_id: goaUser(t.tim),
    reviewer_id: goaUser(t.reviewer),
    frequency: "weekly",
    days: String(t.routine_days).split(",").map((x) => Number(x.trim())).filter((n) => n >= 0 && n <= 6),
    skip_holidays: t.skip_holidays === true || String(t.skip_holidays) === "true",
    is_active: !blocked.has(k),
    legacy_id: k,
  });
}
if (!DRY && tplMap.size) {
  const { data: existing } = await db.from("goa_task_templates").select("id, legacy_id").not("legacy_id", "is", null);
  const have = new Map((existing ?? []).map((x) => [x.legacy_id, x.id]));
  for (const t of tplMap.values()) {
    if (!t.title) continue;
    if (have.has(t.legacy_id)) await db.from("goa_task_templates").update(t).eq("id", have.get(t.legacy_id));
    else await db.from("goa_task_templates").insert(t);
  }
}
R.count("template rutin", tplMap.size);
R.count("template diblokir", [...tplMap.values()].filter((t) => !t.is_active).length);

const TS = { pending: "pending", "on progress": "in_progress", done: "done", undone: "undone", hangus: "expired" };
const taskRows = G.tasks
  .filter((t) => str(t.tugas))
  .map((t) => {
    const dur = num(t.total_duration);
    return {
      code: `TSK-LEGACY-${t.id}`,
      company: GOA_CO,
      title: str(t.tugas),
      description: str(t.deskripsi),
      type: String(t.tipe).toLowerCase() === "rutin" ? "routine" : "once",
      job_category: str(t.job_category),
      assignee_id: goaUser(t.tim),
      reviewer_id: goaUser(t.reviewer),
      status: TS[String(t.status ?? "").toLowerCase()] ?? "pending",
      rating: num(t.rating) && num(t.rating) >= 1 && num(t.rating) <= 5 ? Math.round(num(t.rating)) : null,
      start_time: toTs(t.start_time),
      created_at: toTs(t.created_at) ?? undefined,
      completed_at: toTs(t.completed_at),
      // total_duration lama dalam menit bila angka; teks lain dilewati
      duration_minutes: dur != null ? Math.round(dur) : null,
      undone_reason: str(t.undone_reason),
      done_notes: str(t.done_notes),
      legacy_id: str(t.id),
    };
  });
for (const t of G.tasks) if (str(t.tim) && t.tim !== "General/Pending" && !goaUser(t.tim)) R.note(`Tugas ${t.id}: PIC "${t.tim}" tidak ada di user GOA, jadi General Pool.`);
R.count("tugas", (await upsert("goa_tasks", taskRows, "code", "id")).length);

const PKEY = { P1: "speed", P2: "quality", P3: "done_ratio", P4: "active_ratio" };
const kpiRows = [];
for (const k of G.kpi) {
  const params = (typeof k.settings === "string" ? JSON.parse(k.settings) : k.settings ?? [])
    .map((p) => ({ key: PKEY[p.id] ?? (/p2h/i.test(p.parameter_name) ? "p2h" : null), label: p.parameter_name, weight: num(p.bobot, 1) }))
    .filter((p) => p.key);
  const target = k.target === "GLOBAL" ? "GLOBAL" : goaUser(k.target);
  if (target && params.length) kpiRows.push({ target, parameters: params });
}
R.count("pengaturan KPI", (await upsert("goa_kpi_settings", kpiRows, "target", "target")).length);

// ---------------------------------------------------------------------------
// Penutup
// ---------------------------------------------------------------------------
R.section("Catatan karyawan baru dari nama");
for (const p of pendingByName) R.note(p);
R.count("karyawan dibuat dari nama (NRP sementara)", pendingByName.length);

if (!DRY) {
  // Log aktivitas yang dibuat trigger selama import tidak bermakna -> dihapus.
  const { count } = await db.from("activity_logs").delete({ count: "exact" }).is("actor_id", null).gte("created_at", startedAt);
  R.section("Pembersihan");
  R.count("log aktivitas import dihapus", count ?? 0);
}

const md = R.toMarkdown([
  `- Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
  `- Mode: ${DRY ? "**DRY RUN** (tidak ada yang ditulis)" : "IMPORT"}`,
  `- PT default Fleet: ${FLEET_CO}, GOA: ${GOA_CO}`,
  `- Akun: ${ACCOUNTS}, password awal \`${PASSWORD}\``,
]);
await writeFile("migration-report.md", md);
console.log(md);
