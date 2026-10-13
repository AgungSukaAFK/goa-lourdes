// Bikin ikon PNG (PWA, apple-touch, favicon) dari public/icon.svg.
// Jalankan ulang tiap kali logo diganti: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";

const svg = await readFile("public/icon.svg");
await mkdir("public/icons", { recursive: true });

for (const size of [192, 512]) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
// Maskable: logo diperkecil ke safe zone 80% dengan latar penuh.
const inner = await sharp(svg, { density: 512 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#18181b" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");
await sharp(svg, { density: 512 }).resize(180, 180).png().toFile("app/apple-icon.png");
console.log("icons generated");
