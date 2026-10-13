import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GOA HZ",
    short_name: "GOA HZ",
    description: "Sistem General Affair Lourdes Group: aset, armada & P2H, dan tugas tim GA.",
    start_url: "/",
    display: "standalone",
    background_color: "#18181b",
    theme_color: "#18181b",
    lang: "id",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
