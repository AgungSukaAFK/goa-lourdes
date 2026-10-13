// Pembuat kode aset dari pola per PT (app_settings.asset_code_format).
// Token sama dengan sistem lama: {PT} {SITE} {CAT} {DATE} {DEP} {NAME} {NUM}.

export const DEFAULT_CODE_FORMAT = {
  GMI: "GMI-{SITE}-{CAT}-{DATE}-{DEP}-{NAME}-{NUM}",
  GIS: "GIS-{SITE}-{CAT}-{DATE}-{DEP}-{NAME}-{NUM}",
} as const;

export const CODE_TOKENS = [
  { token: "{PT}", desc: "GMI / GIS" },
  { token: "{SITE}", desc: "Nama site, spasi jadi strip" },
  { token: "{CAT}", desc: "Kode kategori (3 huruf)" },
  { token: "{DATE}", desc: "Tahun+bulan beli, mis. 202610" },
  { token: "{DEP}", desc: "Masa penyusutan (tahun)" },
  { token: "{NAME}", desc: "3 huruf pertama nama aset" },
  { token: "{NUM}", desc: "Nomor urut per PT (001, 002, ...)" },
];

const clean = (v: string) =>
  v
    .toUpperCase()
    .normalize("NFD")
    .replace(/[^A-Z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export function buildAssetCode(
  pattern: string,
  a: {
    company: string;
    siteName?: string | null;
    categoryCode?: string | null;
    categoryName?: string | null;
    purchaseDate?: string | null;
    depreciationYears?: number | null;
    name: string;
  },
  num: number,
) {
  const cat = clean(a.categoryCode || (a.categoryName ?? "GEN")).replace(/-/g, "").slice(0, 3) || "GEN";
  const date = a.purchaseDate ? a.purchaseDate.replace(/-/g, "").slice(0, 6) : new Date().toISOString().slice(0, 7).replace("-", "");
  return pattern
    .replaceAll("{PT}", a.company)
    .replaceAll("{SITE}", clean(a.siteName || "GEN") || "GEN")
    .replaceAll("{CAT}", cat)
    .replaceAll("{DATE}", date)
    .replaceAll("{DEP}", String(a.depreciationYears ?? 4))
    .replaceAll("{NAME}", clean(a.name).replace(/-/g, "").slice(0, 3) || "AST")
    .replaceAll("{NUM}", String(num).padStart(3, "0"));
}

export const ASSET_IMPORT_HEADERS = [
  "Kode Aset",
  "Nama Aset",
  "PT",
  "Kategori",
  "Merek",
  "Model",
  "Serial Number",
  "Site",
  "NRP Pemegang",
  "Tanggal Pembelian",
  "Harga Perolehan",
  "Masa Penyusutan (Tahun)",
  "Dapat Dipinjam (YA/TIDAK)",
  "Kode Accurate",
  "Nomor MR",
  "Nomor PO",
] as const;
