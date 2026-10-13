"use client";

import type { GoaTask } from "./types";

const STATUS: Record<string, string> = { pending: "Pending", in_progress: "Dikerjakan", done: "Selesai", undone: "Tidak selesai", expired: "Hangus" };
const cell = (text: string) => ({ text });
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");

/** Laporan tugas tim ke PowerPoint (dimuat saat dipakai). */
export async function exportTasksPptx(tasks: GoaTask[], title: string) {
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
  await pptx.writeFile({ fileName: `laporan-tugas-${new Date().toISOString().slice(0, 10)}.pptx` });
}
