"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetCan, requireModule } from "@/lib/auth/session";
import { dbError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { generateAssetCode, getCodeFormats } from "@/lib/asset/server";
import { parseCompany } from "@/lib/company-parse";
import type { AssetStatus } from "@/lib/asset/types";
import { getCompanyFilter } from "@/lib/company";
import { ilikeTerm } from "@/lib/list";

const opt = (max = 120) => z.string().trim().max(max).optional();

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  code: opt(80),
  name: z.string().trim().min(2, "Nama aset minimal 2 karakter.").max(150),
  company: z.enum(["GMI", "GIS"], { message: "Pilih PT." }),
  category_id: z.string().uuid().optional().or(z.literal("")),
  site_id: z.string().uuid().optional().or(z.literal("")),
  owner_employee_id: z.string().uuid().optional().or(z.literal("")),
  brand: opt(),
  model: opt(),
  serial_number: opt(),
  accurate_code: opt(),
  mr_number: opt(),
  po_number: opt(),
  purchase_date: z.string().optional(),
  cost: z.coerce.number().min(0, "Harga tidak boleh negatif.").default(0),
  depreciation_years: z.coerce.number().int().min(0).max(50).default(4),
  is_borrowable: z.enum(["on"]).optional(),
  notes: opt(1000),
  photo_path: opt(300),
});

const n = (v?: string) => (v ? v : null);

export async function saveAsset(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireModule("asset");
  if (!assetCan(session, "assets", "write")) return fail("Anda tidak punya akses menulis aset.");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const supabase = await createClient();

  const row = {
    name: d.name,
    company: d.company,
    category_id: n(d.category_id),
    site_id: n(d.site_id),
    owner_employee_id: n(d.owner_employee_id),
    brand: n(d.brand),
    model: n(d.model),
    serial_number: n(d.serial_number),
    accurate_code: n(d.accurate_code),
    mr_number: n(d.mr_number),
    po_number: n(d.po_number),
    purchase_date: n(d.purchase_date),
    cost: d.cost,
    depreciation_years: d.depreciation_years,
    is_borrowable: d.is_borrowable === "on",
    notes: n(d.notes),
    photo_path: n(d.photo_path),
  };

  if (d.id) {
    const update = d.code ? { ...row, code: d.code } : row;
    const { error } = await supabase.from("assets").update(update).eq("id", d.id);
    if (error) return fail(error.code === "23505" ? "Kode aset sudah dipakai aset lain." : dbError(error));
    revalidatePath(`/asset/assets/${d.id}`);
    return ok("Aset diperbarui.", { id: d.id });
  }

  let code = d.code;
  if (!code) {
    const [{ data: site }, { data: cat }] = await Promise.all([
      row.site_id ? supabase.from("sites").select("name").eq("id", row.site_id).single() : Promise.resolve({ data: null }),
      row.category_id ? supabase.from("asset_categories").select("name, code").eq("id", row.category_id).single() : Promise.resolve({ data: null }),
    ]);
    try {
      code = await generateAssetCode(supabase, await getCodeFormats(supabase), {
        company: d.company,
        siteName: site?.name,
        categoryCode: cat?.code,
        categoryName: cat?.name,
        purchaseDate: row.purchase_date,
        depreciationYears: row.depreciation_years,
        name: d.name,
      });
    } catch {
      return fail("Gagal membuat kode aset.");
    }
  }
  const { data, error } = await supabase
    .from("assets")
    .insert({ ...row, code, created_by: session.userId })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "Kode aset sudah dipakai." : dbError(error));
  return ok(`Aset ${code} ditambahkan.`, { id: data.id });
}

export async function setAssetStatus(id: string, status: AssetStatus): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (session.role !== "admin") return fail("Hanya admin Asset yang bisa mengubah status manual.");
  if (status === "loaned") return fail("Status Dipinjam diatur lewat menu Peminjaman.");
  const supabase = await createClient();
  const { data: active } = await supabase.from("asset_loans").select("id").eq("asset_id", id).eq("status", "approved").maybeSingle();
  if (active) return fail("Aset sedang dipinjam. Proses pengembalian dulu.");
  const { error } = await supabase.from("assets").update({ status }).eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath(`/asset/assets/${id}`);
  return ok("Status aset diperbarui.");
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  const session = await requireModule("asset");
  if (!assetCan(session, "assets", "delete")) return fail("Anda tidak punya akses menghapus aset.");
  const supabase = await createClient();
  const { data: a } = await supabase.from("assets").select("photo_path").eq("id", id).maybeSingle();
  const { error, count } = await supabase.from("assets").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(dbError(error));
  if (!count) return fail("Aset tidak ditemukan.");
  if (a?.photo_path) await supabase.storage.from("asset-photos").remove([a.photo_path]);
  return ok("Aset dihapus.");
}


export async function importAssets(rows: Record<string, string>[]): Promise<ActionResult<{ errors?: string[] }>> {
  const session = await requireModule("asset");
  if (!assetCan(session, "assets", "write")) return fail("Anda tidak punya akses menulis aset.");
  if (rows.length > 3000) return fail("Maksimal 3.000 baris per import.");
  const supabase = await createClient();

  const [{ data: cats }, { data: sites }, { data: emps }, formats] = await Promise.all([
    supabase.from("asset_categories").select("id, name, code, depreciation_years"),
    supabase.from("sites").select("id, name, company"),
    supabase.from("employees").select("id, nrp"),
    getCodeFormats(supabase),
  ]);
  const catMap = new Map((cats ?? []).map((c) => [c.name.toLowerCase(), c]));
  const siteMap = new Map((sites ?? []).map((s) => [`${s.company}|${s.name.toLowerCase()}`, s]));
  const empMap = new Map((emps ?? []).map((e) => [e.nrp, e.id]));

  const errors: string[] = [];
  let saved = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const name = (r["Nama Aset"] ?? "").trim();
    const company = parseCompany(r["PT"]);
    if (!name) {
      errors.push(`Baris ${line}: Nama Aset wajib diisi.`);
      continue;
    }
    if (company !== "GMI" && company !== "GIS") {
      errors.push(`Baris ${line}: PT harus GMI atau GIS.`);
      continue;
    }

    let cat = catMap.get((r["Kategori"] ?? "").trim().toLowerCase());
    if (!cat && r["Kategori"]?.trim()) {
      const { data } = await supabase
        .from("asset_categories")
        .insert({ name: r["Kategori"].trim(), depreciation_years: Number(r["Masa Penyusutan (Tahun)"]) || 4 })
        .select("id, name, code, depreciation_years")
        .single();
      if (data) {
        cat = data;
        catMap.set(data.name.toLowerCase(), data);
      }
    }
    const siteName = (r["Site"] ?? "").trim();
    let site = siteMap.get(`${company}|${siteName.toLowerCase()}`) ?? siteMap.get(`LOURDES|${siteName.toLowerCase()}`);
    if (!site && siteName) {
      const { data } = await supabase.from("sites").insert({ name: siteName, company }).select("id, name, company").single();
      if (data) {
        site = data;
        siteMap.set(`${company}|${siteName.toLowerCase()}`, data);
      }
    }
    const nrp = (r["NRP Pemegang"] ?? "").trim();
    const owner = nrp ? empMap.get(nrp) : undefined;
    if (nrp && !owner) errors.push(`Baris ${line}: NRP ${nrp} tidak ada di master karyawan (pemegang dikosongkan).`);

    const pd = (r["Tanggal Pembelian"] ?? "").trim();
    const purchase_date = /^\d{4}-\d{2}-\d{2}$/.test(pd) ? pd : null;
    const dep = Number(r["Masa Penyusutan (Tahun)"]) || cat?.depreciation_years || 4;
    let code = (r["Kode Aset"] ?? "").trim();
    try {
      if (!code) {
        code = await generateAssetCode(supabase, formats, {
          company,
          siteName: site?.name,
          categoryCode: cat?.code,
          categoryName: cat?.name,
          purchaseDate: purchase_date,
          depreciationYears: dep,
          name,
        });
      }
    } catch {
      errors.push(`Baris ${line}: gagal membuat kode.`);
      continue;
    }

    const { error } = await supabase.from("assets").upsert(
      {
        code,
        name,
        company,
        category_id: cat?.id ?? null,
        site_id: site?.id ?? null,
        owner_employee_id: owner ?? null,
        brand: r["Merek"] || null,
        model: r["Model"] || null,
        serial_number: r["Serial Number"] || null,
        purchase_date,
        cost: Number(String(r["Harga Perolehan"] ?? "0").replace(/[^\d.]/g, "")) || 0,
        depreciation_years: dep,
        is_borrowable: /^(ya|y|yes|true|1)$/i.test(r["Dapat Dipinjam (YA/TIDAK)"] ?? ""),
        accurate_code: r["Kode Accurate"] || null,
        mr_number: r["Nomor MR"] || null,
        po_number: r["Nomor PO"] || null,
        created_by: session.userId,
      },
      { onConflict: "code" },
    );
    if (error) errors.push(`Baris ${line} (${code}): ${dbError(error)}`);
    else saved++;
  }
  return ok(`${saved} aset tersimpan${errors.length ? `, ${errors.length} catatan` : ""}.`, { errors });
}

export async function exportAssets(params: Record<string, string>): Promise<ActionResult<Record<string, unknown>[]>> {
  const session = await requireModule("asset");
  const supabase = await createClient();
  const filter = await getCompanyFilter(session);
  let q = supabase.from("assets_view").select("*").order("code");
  if (filter) q = q.eq("company", filter);
  if (params.q) {
    const t = ilikeTerm(params.q);
    q = q.or(`code.ilike.${t},name.ilike.${t},brand.ilike.${t},serial_number.ilike.${t},owner_name.ilike.${t},accurate_code.ilike.${t}`);
  }
  if (params.status) q = q.eq("status", params.status);
  if (params.category_id) q = q.eq("category_id", params.category_id);
  if (params.site_id) q = q.eq("site_id", params.site_id);
  if (params.borrowable) q = q.eq("is_borrowable", params.borrowable === "yes");
  const { data, error } = await q.limit(20000);
  if (error) return fail(dbError(error));
  return ok(undefined, data as Record<string, unknown>[]);
}
