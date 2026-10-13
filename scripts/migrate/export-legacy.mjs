// Tarik semua tabel dari 3 project Supabase lama ke migration-data/<sistem>/<tabel>.json.
// URL & anon key dibaca dari file HTML di legacy/ (key yang sama yang dipakai web lama).
// Tabel yang dilindungi RLS di project lama akan kosong; export manual lewat
// dashboard Supabase (CSV) lalu taruh di folder yang sama.
//
//   node scripts/migrate/export-legacy.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, legacyCredentials } from "./lib.mjs";

const TABLES = {
  asset: ["sites", "categories", "employees", "assets", "loans", "mutations", "audits", "system_users", "system_configs", "logs"],
  fleet: ["operational_sites", "employees", "vehicles", "drivers", "assignments", "inspectors", "part_settings", "bookings", "p2h_history", "repair_list", "fuel_consumption"],
  goa: ["users", "tasks", "goa_blocked_plans", "kpi_settings", "p2h_drivers", "p2h_vehicles", "p2h_assignments", "p2h_completed_logs", "global_notifications"],
};

const creds = await legacyCredentials();
for (const [sys, tables] of Object.entries(TABLES)) {
  const { url, key } = creds[sys];
  if (!url || !key) { console.log(`[${sys}] URL/key tidak ditemukan di HTML, lewati.`); continue; }
  await mkdir(path.join(DATA_DIR, sys), { recursive: true });
  for (const t of tables) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${url}/rest/v1/${t}?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
      });
      if (!res.ok) { console.log(`[${sys}] ${t}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`); break; }
      const page = await res.json();
      rows.push(...page);
      if (page.length < 1000) break;
    }
    await writeFile(path.join(DATA_DIR, sys, `${t}.json`), JSON.stringify(rows, null, 1));
    console.log(`[${sys}] ${t}: ${rows.length} baris`);
  }
}
