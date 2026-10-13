// Buat akun Moderator (sekali saja di awal).
// node --env-file=.env.local scripts/create-moderator.mjs <NRP> "<Nama>" [password]
import { createClient } from "@supabase/supabase-js";

const [nrp = "20260101", name = "Moderator", password = "demo1234"] = process.argv.slice(2);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = `${nrp.toLowerCase()}@demo.com`;
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name, nrp },
});
if (error) {
  console.error("Gagal membuat user:", error.message);
  process.exit(1);
}
const { error: pErr } = await admin
  .from("profiles")
  .update({ nrp, name, company: "LOURDES", is_active: true, is_moderator: true })
  .eq("id", data.user.id);
if (pErr) {
  console.error("Gagal update profil:", pErr.message);
  process.exit(1);
}
console.log(`Moderator dibuat: login NRP ${nrp} / ${password}`);
