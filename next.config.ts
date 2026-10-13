import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Halaman fallback offline harus ada di precache.
  additionalPrecacheEntries: [{ url: "/offline", revision: `${Date.now()}` }],
  // Service worker hanya di build production; di dev (turbopack) bikin cache basi.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // pptxgenjs mengimpor modul Node ("node:https", "node:fs") yang tidak dipakai
  // di browser. Webpack tidak membaca skema "node:", jadi prefix-nya dibuang
  // lalu modul itu dikosongkan di bundle client.
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (res: { request: string }) => {
          res.request = res.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, http: false, os: false, path: false, stream: false, zlib: false };
    }
    return config;
  },
  experimental: {
    serverActions: {
      // File (foto, lampiran) di-upload langsung dari browser ke Supabase
      // Storage, bukan lewat Server Action (limit body Vercel 4.5MB).
      bodySizeLimit: "4mb",
    },
  },
};

export default withSerwist(nextConfig);
