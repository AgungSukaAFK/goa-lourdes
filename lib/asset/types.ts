import type { CompanyCode } from "@/lib/types";

export type AssetStatus = "ready" | "loaned" | "damaged" | "lost" | "disposed";
export type AssetRequestStatus = "pending" | "approved" | "rejected" | "returned";

export type AssetRow = {
  id: string;
  code: string;
  accurate_code: string | null;
  name: string;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: AssetStatus;
  cost: number;
  purchase_date: string | null;
  depreciation_years: number;
  site_id: string | null;
  owner_employee_id: string | null;
  is_borrowable: boolean;
  mr_number: string | null;
  po_number: string | null;
  company: CompanyCode;
  photo_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // dari assets_view
  book_value: number;
  category_name: string | null;
  site_name: string | null;
  owner_name: string | null;
  owner_nrp: string | null;
};

export type Category = { id: string; name: string; code: string | null; depreciation_years: number };

/** Pinjaman berjalan yang lewat tanggal kembali. */
export function isOverdue(status: string, expected: string | null) {
  if (status !== "approved" || !expected) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  return expected < today;
}
