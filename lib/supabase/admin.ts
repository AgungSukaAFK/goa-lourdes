import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service role: bypass RLS. Hanya untuk server action yang sudah memeriksa
// hak akses sendiri (User Management, daftar akun, migrasi data).
// Jangan pernah diimpor dari client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
