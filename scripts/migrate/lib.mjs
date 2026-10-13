// Helper bersama script migrasi data lama -> GOA HZ.
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve("migration-data");

/** Parser CSV sederhana (RFC 4180: kutip ganda, koma/newline di dalam kutip). */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ""));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => {
    const v = r[i] ?? "";
    // Kolom JSON dari export dashboard Supabase
    if (/^[[{]/.test(v)) { try { return [h, JSON.parse(v)]; } catch { /* biarkan teks */ } }
    return [h, v === "" ? null : v];
  })));
}

/** Baca migration-data/<system>/<table>.json|.csv -> array objek ([] kalau tidak ada). */
export async function load(system, table) {
  for (const ext of ["json", "csv"]) {
    const f = path.join(DATA_DIR, system, `${table}.${ext}`);
    if (!existsSync(f)) continue;
    const raw = await readFile(f, "utf8");
    if (ext === "json") {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : (j.data ?? j.rows ?? []);
    }
    return parseCsv(raw);
  }
  return [];
}

export async function listSystems() {
  if (!existsSync(DATA_DIR)) return [];
  return (await readdir(DATA_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
}

export function parseCompany(v, fallback = null) {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("lourdes")) return "LOURDES";
  if (s.includes("gmi") || s.includes("garuda")) return "GMI";
  if (s.includes("gis") || s.includes("global inti") || s.includes("inti sejati")) return "GIS";
  return fallback;
}

export const str = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
export const num = (v, d = null) => {
  if (v === null || v === undefined || v === "") return d;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : d;
};
export const normPlate = (p) => String(p ?? "").toUpperCase().replace(/\s+/g, " ").trim();
export const normName = (n) => String(n ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** "2026-10-01" / "2026-10-01T08:00" / ISO / "01/10/2026" -> "YYYY-MM-DD" */
export function toDate(v) {
  const s = str(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Waktu lokal tanpa zona dianggap WIB. */
export function toTs(v) {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s)) return `${s.replace(" ", "T")}${s.length === 16 ? ":00" : ""}+07:00`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00+07:00`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Ambil URL & key Supabase dari file HTML lama. */
export async function legacyCredentials() {
  const files = { asset: "legacy/asset-management.html", fleet: "legacy/fleet-management.html", goa: "legacy/goa-monitoring.html" };
  const out = {};
  for (const [sys, f] of Object.entries(files)) {
    const html = await readFile(f, "utf8");
    const url = html.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
    const key = html.match(/(?:supabaseKey|SUPABASE_KEY)\s*=\s*['"](eyJ[^'"]+)['"]/)?.[1];
    out[sys] = { url, key };
  }
  return out;
}

export class Report {
  constructor() { this.sections = []; this.cur = null; }
  section(title) { this.cur = { title, counts: {}, notes: [] }; this.sections.push(this.cur); }
  count(k, n = 1) { this.cur.counts[k] = (this.cur.counts[k] ?? 0) + n; }
  note(msg) { if (this.cur.notes.length < 300) this.cur.notes.push(msg); else this.count("catatan lain (tidak ditampilkan)"); }
  toMarkdown(meta) {
    const lines = [`# Laporan migrasi GOA HZ`, "", ...meta, ""];
    for (const s of this.sections) {
      lines.push(`## ${s.title}`, "");
      const c = Object.entries(s.counts);
      if (c.length) { lines.push("| Item | Jumlah |", "|---|---:|", ...c.map(([k, v]) => `| ${k} | ${v} |`), ""); }
      if (s.notes.length) lines.push(...s.notes.map((n) => `- ${n}`), "");
    }
    return lines.join("\n");
  }
}
