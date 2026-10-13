import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Semua path kecuali aset statis, ikon, manifest & service worker.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker-.*|manifest.webmanifest|.*\\.[^.]+$).*)",
  ],
};
