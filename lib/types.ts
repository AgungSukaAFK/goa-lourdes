// Tipe domain yang dipakai lintas modul. Ditulis manual mengikuti
// supabase/migrations/* (tidak ada Docker untuk `supabase gen types`).

export type CompanyCode = "GMI" | "GIS";
export type ProfileCompany = CompanyCode | "LOURDES";
export type AppModule = "asset" | "fleet" | "goa";

export type AssetRole = "admin" | "staff";
export type FleetRole = "admin" | "driver" | "employee";
export type GoaRole = "supervisor" | "member" | "guest";

export type ModuleRoleMap = {
  asset: AssetRole;
  fleet: FleetRole;
  goa: GoaRole;
};

/** Hak per menu Asset: { assets: { read, write, delete }, ... } */
export type MenuPermissions = Record<string, { read?: boolean; write?: boolean; delete?: boolean }>;

export type ModuleAccess = {
  [M in AppModule]?: { role: ModuleRoleMap[M]; permissions: MenuPermissions };
};

export type Profile = {
  id: string;
  employee_id: string | null;
  nrp: string | null;
  name: string;
  email: string | null;
  company: ProfileCompany | null;
  avatar_path: string | null;
  is_active: boolean;
  is_moderator: boolean;
  created_at: string;
  updated_at: string;
};

export type Site = {
  id: string;
  name: string;
  company: ProfileCompany;
  address: string | null;
  is_active: boolean;
};

export type Employee = {
  id: string;
  nrp: string;
  name: string;
  company: ProfileCompany;
  position: string | null;
  division: string | null;
  site_id: string | null;
  join_date: string | null;
  phone: string | null;
  email: string | null;
  photo_path: string | null;
  is_active: boolean;
  created_at: string;
};

export const COMPANY_LABELS: Record<ProfileCompany, string> = {
  GMI: "PT. Garuda Mart Indonesia",
  GIS: "PT. Global Inti Sejati",
  LOURDES: "Lourdes Group",
};

export const MODULE_ROLE_LABELS: { [M in AppModule]: Record<ModuleRoleMap[M], string> } = {
  asset: { admin: "Admin", staff: "Staff" },
  fleet: { admin: "Admin", driver: "Driver", employee: "Karyawan" },
  goa: { supervisor: "Atasan", member: "Tim", guest: "Guest" },
};
