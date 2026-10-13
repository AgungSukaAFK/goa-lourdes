"use client";

// Ekspor/impor Excel di browser memakai exceljs (dimuat saat dipakai saja).

export type ExcelColumn<T> = { header: string; key: keyof T | string; width?: number; value?: (row: T) => unknown };

export async function exportExcel<T>(
  filename: string,
  sheets: { name: string; columns: ExcelColumn<T>[]; rows: T[] }[],
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GOA HZ";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: String(c.key), width: c.width ?? 18 }));
    for (const row of s.rows) {
      const out: Record<string, unknown> = {};
      for (const c of s.columns) {
        out[String(c.key)] = c.value ? c.value(row) : (row as Record<string, unknown>)[String(c.key)];
      }
      ws.addRow(out);
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Template kosong berisi header (+ contoh baris). */
export async function downloadTemplate(filename: string, headers: string[], example?: (string | number)[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Template");
  ws.addRow(headers).font = { bold: true };
  if (example) ws.addRow(example);
  ws.columns.forEach((c) => (c.width = 22));
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return cellText(o.result);
  }
  return String(v).trim();
}

/** Baca sheet pertama -> array objek { [header]: teks }. */
export async function readExcel(file: File): Promise<Record<string, string>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => (headers[col] = cellText(cell.value)));
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const obj: Record<string, string> = {};
    let any = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = headers[col];
      if (!h) return;
      obj[h] = cellText(cell.value);
      if (obj[h]) any = true;
    });
    if (any) rows.push(obj);
  });
  return rows;
}
