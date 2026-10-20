"use client";

import type { GoaTask } from "./types";

export type PptxPhoto = { code: string; title: string; assignee_name: string | null; completed_at: string | null; url: string };

const STATUS: Record<string, string> = { pending: "Pending", in_progress: "Dikerjakan", done: "Selesai", undone: "Tidak selesai", expired: "Hangus" };
const cell = (text: string) => ({ text });
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");

/**
 * Foto storage (webp) -> JPEG data URL. PowerPoint tidak mendukung webp,
 * jadi digambar ulang lewat canvas. Mengembalikan null kalau gagal dimuat.
 */
async function toJpeg(url: string, max = 1280): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return { data: canvas.toDataURL("image/jpeg", 0.8), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

/** Laporan tugas tim ke PowerPoint (dimuat saat dipakai). */
export async function exportTasksPptx(tasks: GoaTask[], title: string, photos: PptxPhoto[] = []) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;
  const ink = "18181B";
  const muted = "71717A";

  const cover = pptx.addSlide();
  cover.addText(title, { x: 0.6, y: 2.4, w: 12, h: 0.8, fontSize: 32, bold: true, color: ink, fontFace: "Arial" });
  cover.addText(`GOA HZ · ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })} · ${tasks.length} tugas`, {
    x: 0.6, y: 3.2, w: 12, h: 0.5, fontSize: 16, color: muted, fontFace: "Arial",
  });

  // Ringkasan per PIC
  const byMember = new Map<string, { total: number; done: number; failed: number; open: number; rating: number[] }>();
  for (const t of tasks) {
    const k = t.assignee_name ?? "General Pool";
    const m = byMember.get(k) ?? { total: 0, done: 0, failed: 0, open: 0, rating: [] };
    m.total++;
    if (t.status === "done") m.done++;
    else if (t.status === "undone" || t.status === "expired") m.failed++;
    else m.open++;
    if (t.rating) m.rating.push(t.rating);
    byMember.set(k, m);
  }
  const sum = pptx.addSlide();
  sum.addText("Ringkasan per PIC", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, color: ink, fontFace: "Arial" });
  const head = ["PIC", "Total", "Selesai", "Tidak selesai/Hangus", "Terbuka", "Rata-rata nilai"].map((text) => ({
    text,
    options: { bold: true, fill: { color: "F4F4F5" }, color: ink },
  }));
  sum.addTable(
    [
      head,
      ...[...byMember.entries()].map(([name, m]) =>
        [
          name,
          String(m.total),
          String(m.done),
          String(m.failed),
          String(m.open),
          m.rating.length ? (m.rating.reduce((a, b) => a + b, 0) / m.rating.length).toFixed(1) : "-",
        ].map(cell),
      ),
    ],
    { x: 0.5, y: 1.1, w: 12.3, fontSize: 12, fontFace: "Arial", border: { type: "solid", color: "E4E4E7", pt: 0.5 }, autoPage: true },
  );

  // Rincian, 14 baris per slide
  for (let i = 0; i < tasks.length; i += 14) {
    const s = pptx.addSlide();
    s.addText(`Rincian tugas (${i + 1}–${Math.min(i + 14, tasks.length)})`, { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 18, bold: true, color: ink, fontFace: "Arial" });
    s.addTable(
      [
        ["Kode", "Tugas", "PIC", "Kategori", "Dibuat", "Status", "Nilai"].map((text) => ({ text, options: { bold: true, fill: { color: "F4F4F5" } } })),
        ...tasks.slice(i, i + 14).map((t) =>
          [
            t.code,
            t.title,
            t.assignee_name ?? "Pool",
            t.job_category ?? "-",
            fmt(t.created_at),
            STATUS[t.status] ?? t.status,
            t.rating ? `${t.rating}/5` : "-",
          ].map(cell),
        ),
      ],
      { x: 0.4, y: 0.9, w: 12.5, colW: [1.6, 4.3, 1.9, 1.7, 1.2, 1.1, 0.7], fontSize: 10, fontFace: "Arial", border: { type: "solid", color: "E4E4E7", pt: 0.5 } },
    );
  }
  // Dokumentasi bukti selesai, 4 foto per slide (2x2)
  const images = (await Promise.all(photos.map(async (p) => ({ p, img: await toJpeg(p.url) })))).filter((x) => x.img);
  for (let i = 0; i < images.length; i += 4) {
    const s = pptx.addSlide();
    s.addText("Dokumentasi bukti selesai", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 18, bold: true, color: ink, fontFace: "Arial" });
    images.slice(i, i + 4).forEach(({ p, img }, j) => {
      const x = 0.5 + (j % 2) * 6.3;
      const y = 0.95 + Math.floor(j / 2) * 3.25;
      // Muat di kotak 6.0 x 2.5 inci dengan rasio asli
      const boxW = 6.0;
      const boxH = 2.5;
      const r = Math.min(boxW / img!.w, boxH / img!.h);
      const w = img!.w * r;
      const h = img!.h * r;
      s.addImage({ data: img!.data, x: x + (boxW - w) / 2, y: y + (boxH - h) / 2, w, h });
      s.addText(`${p.code} · ${p.title}\nPIC: ${p.assignee_name ?? "-"} · Selesai ${fmt(p.completed_at)}`, {
        x, y: y + 2.5, w: boxW, h: 0.6, fontSize: 10, color: muted, fontFace: "Arial", valign: "top",
      });
    });
  }

  await pptx.writeFile({ fileName: `laporan-tugas-${new Date().toISOString().slice(0, 10)}.pptx` });
}
