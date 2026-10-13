import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Service worker hanya di build production; di dev (turbopack) bikin cache basi.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // File (foto, lampiran) di-upload langsung dari browser ke Supabase
      // Storage, bukan lewat Server Action (limit body Vercel 4.5MB).
      bodySizeLimit: "4mb",
    },
  },
};

export default withSerwist(nextConfig);
