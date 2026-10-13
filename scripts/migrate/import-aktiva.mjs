// Import "Ringkasan Daftar Aktiva Tetap" (export Accurate, .xls/.xlsx/.csv) ke tabel assets.
//
//   node --env-file=.env.local scripts/migrate/import-aktiva.mjs "Aktiva Tetap All.xls" --dry-run
//   node --env-file=.env.local scripts/migrate/import-aktiva.mjs "Aktiva Tetap All.xls"
//
// Opsi:
//   --company=GIS   PT pemilik (default: dibaca dari judul file, mis. "PT. Global Inti Sejati")
//   --update        aset yang sudah pernah diimport ikut diperbarui harga, tanggal beli & masa
//                   penyusutan (nama, site, status, catatan tidak disentuh karena bisa sudah diedit)
//   --fleet         kendaraan berplat juga dibuat di Fleet (plat yang sudah ada dilewati)
//
// Satu Kode Aktiva = satu aset, dicocokkan lewat accurate_code, jadi aman diulang.
// Laporan per baris ditulis ke aktiva-import-report.md.

import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { buildAssetCode, DEFAULT_CODE_FORMAT } from "../../lib/asset/code.ts";
import { Report, normName, normPlate, parseCompany } from "./lib.mjs";

const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, v]) => [k, v ?? true]));
const file = argv.find((a) => !a.startsWith("--"));
if (!file) {
  console.error('Pakai: node --env-file=.env.local scripts/migrate/import-aktiva.mjs "<file .xls>" [--dry-run] [--update] [--fleet] [--company=GIS]');
  process.exit(1);
}
const DRY = !!args["dry-run"];

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const R = new Report();

// ---------------------------------------------------------------------------
// Baca file
// ---------------------------------------------------------------------------
const wb = XLSX.read(await readFile(file), { cellDates: true });
const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
const headerAt = grid.findIndex((r) => r.some((c) => normName(c) === "kode aktiva"));
if (headerAt < 0) throw new Error('Kolom "Kode Aktiva" tidak ditemukan. Pastikan file adalah Ringkasan Daftar Aktiva Tetap.');
const head = grid[headerAt].map(normName);
const col = (name) => {
  const i = head.indexOf(name);
  if (i < 0) throw new Error(`Kolom "${name}" tidak ditemukan.`);
  return i;
};
const C = {
  code: col("kode aktiva"),
  name: col("nama aktiva"),
  type: col("nama tipe aktiva"),
  cost: col("harga perolehan"),
  used: col("tgl pemakaian"),
  bought: col("tgl pembelian"),
  life: col("estimasi umur"),
};
const company = parseCompany(args.company ?? grid.slice(0, headerAt).flat().filter(Boolean).join(" "), null);
if (company !== "GMI" && company !== "GIS") throw new Error("PT tidak terbaca dari judul file. Tambahkan --company=GIS atau --company=GMI.");

const BULAN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nop: 11, nov: 11, des: 12, dec: 12 };
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Date (sel tanggal) / serial Excel / "24 Okt 2018" -> "YYYY-MM-DD" */
function parseDate(v) {
  if (v instanceof Date) {
    // SheetJS membuat Date pada tengah malam waktu lokal; geser 12 jam supaya tidak mundur sehari.
    const d = new Date(v.getTime() + 12 * 3600000);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? ymd(d.y, d.m, d.d) : null;
  }
  const m = String(v ?? "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (m && BULAN[m[2].toLowerCase()]) return ymd(m[3], BULAN[m[2].toLowerCase()], m[1]);
  return null;
}

/** "5 Yr 0 Mth" -> 5, "1 Yr 11 Mth" -> 2 (kolom masa penyusutan berupa tahun bulat). */
function parseLife(v) {
  const s = String(v ?? "");
  const y = Number(s.match(/(\d+)\s*Yr/i)?.[1] ?? 0);
  const m = Number(s.match(/(\d+)\s*Mth/i)?.[1] ?? 0);
  return y || m ? Math.min(50, Math.round(y + m / 12)) : null;
}

// Keterangan lokasi/pemegang/kondisi yang ditulis di akhir nama, mis. "(Pemakaian Intan HR - KM 8A Lt. 1)".
// Kurung lain seperti "(4x4)" atau "(2 Unit)" tetap bagian dari nama.
const NOTE_WORDS =
  /\b(HO|BPN|IT|WHS|BOD|RM|HR|KM|Lt|Ruang|Ruangan|Rumah|Mess|Pemakaian|Pakai|Ex|Ada|Di|Dijual|Rusak|Hilang|Sewa|Server|Receptionist|Pantry|Rooftop|Rofftop|Kendaraan|Aplikasi|Sistem|Team|Tim|Untuk|Utk|Garansi)\b/i;

/** Pisahkan kurung keterangan di akhir baris dari nama barangnya. */
function splitLine(line) {
  let text = line.trim();
  const notes = [];
  // Salah ketik di Accurate: kurung tutup berlebih, mis. "(Rumah A1 - Lt. 2))"
  const count = (ch) => text.split(ch).length - 1;
  while (text.endsWith(")") && count(")") > count("(")) text = text.slice(0, -1).trimEnd();
  while (text.endsWith(")")) {
    let depth = 0;
    let open = -1;
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === ")") depth++;
      else if (text[i] === "(" && --depth === 0) {
        open = i;
        break;
      }
    }
    if (open <= 0) break;
    const inner = text.slice(open + 1, -1).trim();
    if (!NOTE_WORDS.test(inner)) break;
    notes.unshift(inner);
    text = text.slice(0, open).replace(/[\s&,-]+$/, "");
  }
  return { text: text.replace(/\s+/g, " "), notes };
}

const SITE_BY_KEY = { HO: "HO", BPN: "BPN", TBLG: "Tabalong" };
function guessSite(code, desc) {
  if (/ada di (bpn|balikpapan)|pemakaian di bpn/i.test(desc)) return "BPN";
  const seg = code.toUpperCase().split("-").find((s) => s in SITE_BY_KEY);
  return SITE_BY_KEY[seg] ?? "HO";
}

function guessStatus(desc) {
  if (/\bhilang\b/i.test(desc)) return "lost";
  if (/\brusak\b/i.test(desc)) return "damaged";
  return "ready";
}

const CAT_CODE = { "peralatan kantor": "KTR", "peralatan kerja": "KRJ", kendaraan: "KDR", bangunan: "BGN", tanah: "TNH" };
const categoryName = (t) => String(t ?? "").replace(/\s+\d+$/, "").trim() || "Lainnya";

const PLATE = /\b([A-Z]{1,2}) ?(\d{1,4}) ?([A-Z]{1,3})\b/g;

const rows = [];
for (const r of grid.slice(headerAt + 1)) {
  const code = String(r[C.code] ?? "").trim();
  const desc = String(r[C.name] ?? "").trim();
  if (!code || !desc) continue; // baris total / kosong
  const lines = desc.split(/\r?\n/).map(splitLine).filter((l) => l.text);
  const notes = lines.flatMap((l) => l.notes);
  let name = lines.map((l) => l.text).join("; ");
  const multi = lines.length > 1;
  if (name.length > 150) name = `${name.slice(0, 147).trimEnd()}...`;
  const purchase = parseDate(r[C.bought]) ?? parseDate(r[C.used]);
  const used = parseDate(r[C.used]);
  const cat = categoryName(r[C.type]);
  const cost = Number(r[C.cost]);
  const life = parseLife(r[C.life]);
  const plates = cat === "Kendaraan" ? [...desc.matchAll(PLATE)].map((m) => normPlate(`${m[1]} ${m[2]} ${m[3]}`)) : [];

  const noteLines = ["Import dari Accurate (Ringkasan Daftar Aktiva Tetap)."];
  if (notes.length) noteLines.push(`Keterangan: ${notes.join(" · ")}`);
  if (multi || name !== desc.replace(/\s+/g, " ")) noteLines.push(`Nama di Accurate: ${desc.replace(/\r?\n/g, " / ")}`);
  if (used && used !== purchase) noteLines.push(`Tanggal pemakaian: ${used}`);

  if (!purchase) R.note(`${code}: tanggal pembelian tidak terbaca (${r[C.bought]}).`);
  if (!Number.isFinite(cost)) R.note(`${code}: harga perolehan tidak terbaca (${r[C.cost]}).`);
  if (life === null) R.note(`${code}: estimasi umur tidak terbaca (${r[C.life]}), dipakai masa penyusutan kategori.`);

  rows.push({
    accurate_code: code,
    name,
    multi,
    category: cat,
    cost: Number.isFinite(cost) ? cost : 0,
    purchase_date: purchase,
    depreciation_years: life,
    site: guessSite(code, desc),
    status: guessStatus(desc),
    notes: noteLines.join("\n").slice(0, 1000),
    plates,
    year: Number(desc.match(/\b(?:th|tahun)\.?\s*(\d{4})\b/i)?.[1]) || null,
  });
}
const dup = rows.map((r) => r.accurate_code).filter((c, i, a) => a.indexOf(c) !== i);
if (dup.length) throw new Error(`Kode Aktiva ganda di file: ${[...new Set(dup)].join(", ")}`);

// ---------------------------------------------------------------------------
// Master: site & kategori (dipakai ulang kalau sudah ada)
// ---------------------------------------------------------------------------
R.section("Master data");
const { data: siteList, error: siteErr } = await db.from("sites").select("id, name, company").in("company", [company, "LOURDES"]);
if (siteErr) throw new Error(`sites: ${siteErr.message}`);
const siteId = new Map(siteList.map((s) => [normName(s.name), s.id]));
for (const name of new Set(rows.map((r) => r.site))) {
  if (siteId.has(normName(name))) continue;
  if (DRY) siteId.set(normName(name), null);
  else {
    const { data, error } = await db.from("sites").insert({ name, company }).select("id").single();
    if (error) throw new Error(`site ${name}: ${error.message}`);
    siteId.set(normName(name), data.id);
  }
  R.count("site baru");
  R.note(`Site baru: ${name} (${company})`);
}

const { data: catList, error: catErr } = await db.from("asset_categories").select("id, name, code, depreciation_years");
if (catErr) throw new Error(`asset_categories: ${catErr.message}`);
const cats = new Map(catList.map((c) => [normName(c.name), c]));
for (const name of new Set(rows.map((r) => r.category))) {
  if (cats.has(normName(name))) continue;
  // Masa penyusutan kategori = nilai yang paling sering muncul di file
  const lives = rows.filter((r) => r.category === name && r.depreciation_years !== null).map((r) => r.depreciation_years);
  const mode = lives.sort((a, b) => lives.filter((x) => x === b).length - lives.filter((x) => x === a).length)[0] ?? 4;
  const row = { name, code: CAT_CODE[normName(name)] ?? null, depreciation_years: mode };
  if (DRY) cats.set(normName(name), { id: null, ...row });
  else {
    const { data, error } = await db.from("asset_categories").insert(row).select("id, name, code, depreciation_years").single();
    if (error) throw new Error(`kategori ${name}: ${error.message}`);
    cats.set(normName(name), data);
  }
  R.count("kategori baru");
  R.note(`Kategori baru: ${name} (kode ${row.code ?? "otomatis"}, penyusutan ${mode} th)`);
}

// ---------------------------------------------------------------------------
// Aset
// ---------------------------------------------------------------------------
R.section("Aset");
const existing = new Map();
for (let i = 0; i < rows.length; i += 200) {
  const { data, error } = await db
    .from("assets")
    .select("id, code, accurate_code")
    .in("accurate_code", rows.slice(i, i + 200).map((r) => r.accurate_code));
  if (error) throw new Error(`assets: ${error.message}`);
  for (const a of data) existing.set(a.accurate_code, a);
}

const { data: fmtRow } = await db.from("app_settings").select("value").eq("key", "asset_code_format").eq("company", company).maybeSingle();
const pattern = fmtRow ? String(fmtRow.value) : DEFAULT_CODE_FORMAT[company];

async function newCode(r, cat) {
  const parts = { company, siteName: r.site, categoryCode: cat.code, categoryName: cat.name, purchaseDate: r.purchase_date, depreciationYears: r.depreciation_years, name: r.name };
  if (DRY) return buildAssetCode(pattern, parts, 0).replace(/000$/, "###");
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: num, error } = await db.rpc("next_counter", { p_key: `asset:${company}` });
    if (error) throw new Error(`next_counter: ${error.message}`);
    const code = buildAssetCode(pattern, parts, num);
    const { data: taken } = await db.from("assets").select("id").eq("code", code).maybeSingle();
    if (!taken) return code;
  }
  throw new Error("Gagal membuat kode aset unik.");
}

const STATUS_LABEL = { ready: "Ready", damaged: "Rusak", lost: "Hilang" };
const table = [];
for (const r of rows) {
  const cat = cats.get(normName(r.category));
  const dep = r.depreciation_years ?? cat.depreciation_years;
  const found = existing.get(r.accurate_code);
  let code = found?.code;
  let action;
  if (found) {
    if (args.update) {
      if (!DRY) {
        const { error } = await db.from("assets").update({ cost: r.cost, purchase_date: r.purchase_date, depreciation_years: dep }).eq("id", found.id);
        if (error) throw new Error(`${r.accurate_code}: ${error.message}`);
      }
      action = "diperbarui";
    } else action = "sudah ada";
  } else {
    code = await newCode({ ...r, depreciation_years: dep }, cat);
    if (!DRY) {
      const { error } = await db.from("assets").insert({
        code,
        accurate_code: r.accurate_code,
        name: r.name,
        category_id: cat.id,
        status: r.status,
        cost: r.cost,
        purchase_date: r.purchase_date,
        depreciation_years: dep,
        site_id: siteId.get(normName(r.site)),
        company,
        notes: r.notes,
        legacy_id: `accurate:${r.accurate_code}`,
      });
      if (error) throw new Error(`${r.accurate_code}: ${error.message}`);
    }
    action = "baru";
  }
  R.count(`aset ${action}`);
  if (r.status !== "ready") R.count(`status ${STATUS_LABEL[r.status]}`);
  if (r.multi) R.count("aset berisi beberapa barang (1 Kode Aktiva)");
  table.push({ ...r, code, action, dep });
}
R.count("total harga perolehan (Rp)", Math.round(rows.reduce((a, r) => a + r.cost, 0)));

// ---------------------------------------------------------------------------
// Kendaraan -> Fleet (opsional)
// ---------------------------------------------------------------------------
R.section("Kendaraan");
const vehicles = table.flatMap((r) => r.plates.map((plate) => ({ plate, r })));
if (!vehicles.length) R.note("Tidak ada kendaraan berplat.");
if (vehicles.length && !args.fleet) {
  R.note("Kendaraan berikut tercatat sebagai aset saja. Jalankan ulang dengan --fleet untuk membuatnya juga di modul Fleet.");
}
const { data: fleet } = vehicles.length ? await db.from("fleet_vehicles").select("plate").in("plate", vehicles.map((v) => v.plate)) : { data: [] };
const fleetPlates = new Set((fleet ?? []).map((v) => v.plate));
for (const { plate, r } of vehicles) {
  const inFleet = fleetPlates.has(plate);
  if (args.fleet && !inFleet) {
    if (!DRY) {
      const { error } = await db.from("fleet_vehicles").insert({
        plate,
        model: r.name.replace(PLATE, "").replace(/\b(mobil|motor|th|tahun)\b\.?\s*(\d{4})?/gi, "").replace(/\s+/g, " ").trim().slice(0, 80),
        year: r.year,
        company,
        site_id: siteId.get(normName(r.site)),
        notes: `Aset ${r.code} (Accurate ${r.accurate_code}).`,
      });
      if (error) R.note(`${plate}: gagal dibuat di Fleet → ${error.message}`);
      else R.count("kendaraan baru di Fleet");
    } else R.count("kendaraan baru di Fleet");
  }
  R.note(`${plate} — ${r.name} (${r.accurate_code})${inFleet ? " · sudah ada di Fleet" : ""}`);
}

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const md = [
  R.toMarkdown([
    `- File: ${file}`,
    `- PT: ${company}`,
    `- Mode: ${DRY ? "**DRY RUN** (tidak ada yang ditulis; ### = nomor urut saat import)" : "import"}`,
    `- Waktu: ${new Date().toISOString()}`,
  ]).replace("# Laporan migrasi GOA HZ", "# Laporan import Aktiva Tetap"),
  "## Rincian per aset",
  "",
  "| Kode Accurate | Kode aset | Nama | Kategori | Site | Status | Harga | Beli | Susut | Hasil |",
  "|---|---|---|---|---|---|---:|---|---:|---|",
  ...table.map((r) =>
    `| ${esc(r.accurate_code)} | ${esc(r.code)} | ${esc(r.name)} | ${esc(r.category)} | ${r.site} | ${STATUS_LABEL[r.status]} | ${r.cost.toLocaleString("id-ID")} | ${r.purchase_date ?? "-"} | ${r.dep} th | ${r.action} |`,
  ),
  "",
].join("\n");
await writeFile("aktiva-import-report.md", md);
console.log(md.split("## Rincian per aset")[0]);
console.log(`Laporan lengkap: aktiva-import-report.md${DRY ? " (dry run, belum ada yang ditulis)" : ""}`);
