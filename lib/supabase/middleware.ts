import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeNextPath } from "@/lib/safe-next-path";

// Status aktif akun di-cache di cookie sebentar supaya middleware tidak query
// `profiles` di setiap request. Data tetap dijaga RLS (user nonaktif tidak
// bisa membaca apa pun), jadi cache ini hanya soal redirect.
const ACTIVE_COOKIE = "goa-active";
const ACTIVE_MAX_AGE = 60 * 2;
export const LAST_MODULE_COOKIE = "last-module";

const PUBLIC_PATHS = ["/login", "/sign-up", "/offline"];
const PENDING_PATH = "/pending";
const MODULE_SEGMENTS = ["asset", "fleet", "goa"];

function isPrefetch(request: NextRequest) {
  const h = request.headers;
  return (
    h.get("next-router-prefetch") === "1" ||
    h.get("purpose") === "prefetch" ||
    (h.get("sec-purpose") ?? "").includes("prefetch")
  );
}

export async function updateSession(request: NextRequest) {
  if (isPrefetch(request)) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // setAll dipanggil sekali dengan SEMUA cookie sesi; response cukup
        // dibuat ulang sekali supaya cookie refresh token tidak saling timpa.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Jangan taruh kode apa pun di antara createServerClient dan getClaims().
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;

  const { pathname } = request.nextUrl;
  // Halaman offline selalu bisa diakses (di-precache service worker).
  if (pathname === "/offline") return response;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isPending = pathname === PENDING_PATH;

  const redirectTo = (path: string, keepNext = false) => {
    const url = new URL(path, request.url);
    if (keepNext) {
      const next = getSafeNextPath(pathname + request.nextUrl.search);
      if (next && next !== "/") url.searchParams.set("next", next);
    }
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!userId) {
    return isPublic ? response : redirectTo("/login", true);
  }

  let active = request.cookies.get(ACTIVE_COOKIE)?.value === userId;
  if (!active) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();
    active = !!profile?.is_active;
    if (active) {
      response.cookies.set(ACTIVE_COOKIE, userId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ACTIVE_MAX_AGE,
      });
    }
  }

  if (!active) {
    return isPending ? response : redirectTo(PENDING_PATH);
  }

  if (isPublic || isPending) {
    const next = getSafeNextPath(request.nextUrl.searchParams.get("next"));
    return redirectTo(next ?? "/");
  }

  // Ingat modul terakhir untuk redirect dari "/".
  const seg = pathname.split("/")[1];
  if (MODULE_SEGMENTS.includes(seg) && request.cookies.get(LAST_MODULE_COOKIE)?.value !== seg) {
    response.cookies.set(LAST_MODULE_COOKIE, seg, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  return response;
}
