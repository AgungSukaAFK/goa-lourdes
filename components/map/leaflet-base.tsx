"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";

/** Ikon titik bulat (warna lewat CSS var token) - tanpa file gambar marker. */
export function dotIcon(kind: "primary" | "muted" | "destructive" = "primary", size = 16) {
  const color =
    kind === "primary" ? "hsl(var(--primary))" : kind === "destructive" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid hsl(var(--background));box-shadow:0 0 0 1px hsl(var(--border))"></span>`,
  });
}

/** Tile CARTO terang/gelap mengikuti tema (seperti sistem lama). */
export function ThemedTiles() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains("dark") || el.classList.contains("soft-dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return (
    <TileLayer
      key={dark ? "d" : "l"}
      url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      subdomains="abcd"
      maxZoom={19}
    />
  );
}
