import { DEFAULT_KPI, SP_PENALTY, type GoaTask, type KpiKey, type KpiParam, type TeamMember } from "./types";

export type KpiResult = {
  score: number | null;
  raw: number | null;
  spPenalty: number;
  params: { key: KpiKey; label: string; weight: number; value: number | null; basis: string }[];
  counts: { total: number; done: number; open: number; failed: number; rated: number; avgRating: number | null; overdueOpen: number };
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/**
 * KPI satu anggota dari tugas periode berjalan. Semua parameter dihitung
 * dari data nyata (sistem lama memakai angka tetap untuk beberapa
 * parameter). Parameter tanpa data (null) tidak ikut dibobot.
 */
export function computeKpi(member: Pick<TeamMember, "sp_level" | "sp_date">, tasks: GoaTask[], params: KpiParam[] = DEFAULT_KPI): KpiResult {
  const done = tasks.filter((t) => t.status === "done");
  const failed = tasks.filter((t) => t.status === "undone" || t.status === "expired");
  const open = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const closed = done.length + failed.length;
  const rated = done.filter((t) => t.rating);
  const avgRating = rated.length ? rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length : null;

  const onTime = done.filter((t) => {
    if (!t.completed_at) return false;
    if (t.due_at) return new Date(t.completed_at) <= new Date(t.due_at);
    return new Date(t.completed_at).getTime() - new Date(t.created_at).getTime() <= 86400000;
  }).length;
  const touched = tasks.filter((t) => t.status !== "pending").length;
  const p2h = tasks.filter((t) => t.source === "p2h");
  const p2hClosed = p2h.filter((t) => t.status !== "pending" && t.status !== "in_progress");

  const values: Record<KpiKey, { value: number | null; basis: string }> = {
    speed: { value: pct(onTime, done.length), basis: `${onTime}/${done.length} tepat waktu` },
    quality: { value: avgRating !== null ? Math.round((avgRating / 5) * 100) : null, basis: rated.length ? `rata-rata ${avgRating!.toFixed(1)} dari ${rated.length} nilai` : "belum ada nilai" },
    done_ratio: { value: pct(done.length, closed), basis: `${done.length}/${closed} ditutup selesai` },
    active_ratio: { value: pct(touched, tasks.length), basis: `${touched}/${tasks.length} dikerjakan` },
    p2h: { value: pct(p2hClosed.filter((t) => t.status === "done").length, p2hClosed.length), basis: `${p2hClosed.filter((t) => t.status === "done").length}/${p2hClosed.length} P2H` },
  };

  const rows = params.map((p) => ({ ...p, ...values[p.key] }));
  const counted = rows.filter((r) => r.value !== null && r.weight > 0);
  const totalW = counted.reduce((a, r) => a + r.weight, 0);
  const raw = totalW ? Math.round(counted.reduce((a, r) => a + (r.value as number) * r.weight, 0) / totalW) : null;

  const spActive = member.sp_level !== "none" && member.sp_date && Date.now() - new Date(member.sp_date).getTime() <= 180 * 86400000;
  const spPenalty = spActive ? SP_PENALTY[member.sp_level] : 0;

  return {
    raw,
    spPenalty,
    score: raw === null ? null : Math.max(0, raw - spPenalty),
    params: rows,
    counts: {
      total: tasks.length,
      done: done.length,
      open: open.length,
      failed: failed.length,
      rated: rated.length,
      avgRating,
      overdueOpen: open.filter((t) => t.is_overdue).length,
    },
  };
}

/** Parameter KPI yang berlaku untuk anggota (override per orang > GLOBAL). */
export function paramsFor(memberId: string, settings: { target: string; parameters: KpiParam[] }[]) {
  return settings.find((s) => s.target === memberId)?.parameters ?? settings.find((s) => s.target === "GLOBAL")?.parameters ?? DEFAULT_KPI;
}

export type Insight = { tone: "good" | "warn" | "bad"; title: string; detail: string };

/**
 * Saran performa rule-based. Setiap saran menyebut angka yang mendasarinya,
 * supaya bisa ditelusuri (bukan "AI" kotak hitam).
 */
export function insightsFor(k: KpiResult, prev: KpiResult | null): Insight[] {
  const out: Insight[] = [];
  if (k.counts.total === 0) return [{ tone: "warn", title: "Belum ada tugas di periode ini", detail: "KPI belum bisa dihitung. Pastikan anggota mendapat tugas atau mengklaim dari General Pool." }];

  const weakest = [...k.params].filter((p) => p.value !== null).sort((a, b) => (a.value as number) - (b.value as number))[0];
  if (weakest && (weakest.value as number) < 70) {
    const tips: Record<string, string> = {
      speed: "Tugas sering selesai melewati batas. Pecah tugas besar, mulai lebih awal, atau minta batas waktu realistis.",
      quality: "Nilai atasan rendah. Diskusikan ekspektasi hasil sebelum mulai dan lampirkan catatan penyelesaian yang jelas.",
      done_ratio: "Banyak tugas ditutup tidak selesai / hangus. Cek beban kerja dan alasan yang paling sering muncul.",
      active_ratio: "Banyak tugas dibiarkan pending. Tekan Mulai saat mengerjakan supaya progres terlihat.",
      p2h: "Ada P2H mingguan yang tidak diselesaikan. Jadwalkan P2H di awal minggu.",
    };
    out.push({ tone: "bad", title: `Fokus perbaikan: ${weakest.label} (${weakest.value})`, detail: `${weakest.basis}. ${tips[weakest.key]}` });
  }
  if (k.counts.overdueOpen > 0) {
    out.push({ tone: "warn", title: `${k.counts.overdueOpen} tugas terbuka sudah lewat batas`, detail: "Selesaikan atau tutup dengan alasan supaya tidak menurunkan rasio selesai." });
  }
  if (k.counts.done > 3 && k.counts.rated / k.counts.done < 0.5) {
    out.push({ tone: "warn", title: "Banyak tugas selesai belum dinilai", detail: `${k.counts.done - k.counts.rated} dari ${k.counts.done} tugas belum diberi rating, sehingga KPI kualitas kurang akurat.` });
  }
  if (k.spPenalty > 0) {
    out.push({ tone: "bad", title: `Penalti SP aktif −${k.spPenalty}`, detail: "SP berlaku 6 bulan sejak tanggal terbit." });
  }
  if (prev?.score != null && k.score != null) {
    const diff = k.score - prev.score;
    if (diff >= 5) out.push({ tone: "good", title: `KPI naik ${diff} poin dari periode sebelumnya`, detail: `${prev.score} → ${k.score}.` });
    if (diff <= -5) out.push({ tone: "bad", title: `KPI turun ${Math.abs(diff)} poin dari periode sebelumnya`, detail: `${prev.score} → ${k.score}. Bandingkan parameter mana yang turun.` });
  }
  const strongest = [...k.params].filter((p) => p.value !== null).sort((a, b) => (b.value as number) - (a.value as number))[0];
  if (strongest && (strongest.value as number) >= 90) {
    out.push({ tone: "good", title: `Kekuatan: ${strongest.label} (${strongest.value})`, detail: strongest.basis });
  }
  return out.length ? out : [{ tone: "good", title: "Performa stabil", detail: "Tidak ada parameter di bawah 70." }];
}
