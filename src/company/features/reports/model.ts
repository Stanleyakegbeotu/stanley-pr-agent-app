// GENERATED from the STANLEY desktop app (src/features/reports/model.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Report document model shared by the preview, print, PDF download and
 * spreadsheet export — so all four always contain exactly the same content.
 *
 * Text is never truncated: table cells wrap, pages are laid out from measured
 * row heights (see ReportPages.tsx), and the PDF uses line-wrapping tables.
 */

export type Align = "left" | "right";

/** A table cell: display text, optional raw number (used by the spreadsheet export) and emphasis. */
export interface Cell {
  t: string;
  n?: number;
  b?: boolean;
  tone?: "good" | "bad" | "muted";
  /** Export as text so spreadsheets keep leading zeros (account and phone numbers). */
  keepText?: boolean;
}

export interface Column {
  key: string;
  label: string;
  align?: Align;
  /** Relative width (default 1). */
  weight?: number;
}

export interface TableBlock {
  kind: "table";
  title?: string;
  subtitle?: string;
  columns: Column[];
  rows: Cell[][];
  total?: Cell[];
  empty?: string;
}

export interface SummaryBlock {
  kind: "summary";
  title?: string;
  items: { label: string; value: string; note?: string; tone?: "good" | "bad" }[];
}

export interface HeadingBlock {
  kind: "heading";
  text: string;
  sub?: string;
}

export interface NoteBlock {
  kind: "note";
  text: string;
}

export type Block = TableBlock | SummaryBlock | HeadingBlock | NoteBlock;

export interface ReportDoc {
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  blocks: Block[];
  /** Short line printed at the bottom of every page. */
  footnote: string;
  filename: string;
}

/* ─────────────── Paper ─────────────── */

export type PaperSize = "A4" | "A3" | "Letter";
export type Orientation = "portrait" | "landscape";

export interface Paper {
  size: PaperSize;
  orientation: Orientation;
}

/** Page size in CSS pixels at 96 dpi. */
const SIZES: Record<PaperSize, [number, number]> = { A4: [794, 1123], A3: [1123, 1587], Letter: [816, 1056] };
export const PAPER_LABEL: Record<PaperSize, string> = { A4: "A4 (210 × 297 mm)", A3: "A3 (297 × 420 mm)", Letter: "Letter (8.5 × 11 in)" };

export function paperPx(p: Paper): { w: number; h: number } {
  const [w, h] = SIZES[p.size];
  return p.orientation === "portrait" ? { w, h } : { w: h, h: w };
}

export const PAGE_MARGIN = 42;

export const paperName = (p: Paper) => `${p.size} ${p.orientation}`;

/* ─────────────── Cell helpers ─────────────── */

export const txt = (t: string, extra: Partial<Cell> = {}): Cell => ({ t, ...extra });
export const num = (t: string, n: number, extra: Partial<Cell> = {}): Cell => ({ t, n, ...extra });

export function tableRowCount(doc: ReportDoc): number {
  return doc.blocks.reduce((s, b) => s + (b.kind === "table" ? b.rows.length : 0), 0);
}

/* ─────────────── Spreadsheet (CSV) export ─────────────── */

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with a UTF-8 byte-order mark so Excel shows ₦ and accents correctly. Numbers are exported raw. */
export function toCsv(doc: ReportDoc): string {
  const lines: string[] = [esc(doc.title), esc(doc.subtitle), ...doc.meta.map((m) => `${esc(m.label)},${esc(m.value)}`), ""];
  for (const b of doc.blocks) {
    if (b.kind === "heading") lines.push(esc(b.text) + (b.sub ? `,${esc(b.sub)}` : ""));
    if (b.kind === "note") lines.push(esc(b.text));
    if (b.kind === "summary") {
      if (b.title) lines.push(esc(b.title));
      for (const i of b.items) lines.push(`${esc(i.label)},${esc(i.value)}`);
      lines.push("");
    }
    if (b.kind === "table") {
      if (b.title) lines.push(esc(b.title));
      lines.push(b.columns.map((c) => esc(c.label)).join(","));
      for (const r of b.rows) lines.push(r.map((c) => (c.keepText && /^[\d+]/.test(c.t) ? `="${c.t}"` : esc(c.n ?? c.t))).join(","));
      if (b.total) lines.push(b.total.map((c) => esc(c.n ?? c.t)).join(","));
      lines.push("");
    }
  }
  lines.push(esc(doc.footnote));
  return "﻿" + lines.join("\r\n");
}

export function saveFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ─────────────── PDF download ─────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "2a746e", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The PDF's built-in font has no ₦ glyph, so amounts read "NGN 12,000" in the PDF only. */
const pdfText = (s: string) => s.replace(/₦\s?/g, "NGN ").replace(/[^\x00-\xFF–—‘’“”•…€]/g, "");

export async function savePdf(doc: ReportDoc, paper: Paper, brandHex: string, company: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: paper.orientation, unit: "pt", format: paper.size.toLowerCase() });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 34;
  const brand = hexToRgb(brandHex);
  const last = () => (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? M;
  let y = M + 8;
  const room = (need: number) => {
    if (y + need > H - M - 18) {
      pdf.addPage();
      y = M + 8;
    }
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(25, 35, 35);
  pdf.text(pdfText(doc.title), M, y + 10);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90, 105, 105);
  const sub = pdf.splitTextToSize(pdfText(doc.subtitle), W - 2 * M);
  pdf.text(sub, M, y + 26);
  y += 30 + sub.length * 12;
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [40, 50, 50] },
    columnStyles: { 0: { fontStyle: "bold", textColor: [100, 115, 115], cellWidth: 120 } },
    body: doc.meta.map((m) => [pdfText(m.label), pdfText(m.value)]),
  });
  y = last() + 14;

  for (const b of doc.blocks) {
    if (b.kind === "heading") {
      room(60);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...brand);
      pdf.text(pdfText(b.text), M, y + 10);
      y += 16;
      if (b.sub) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 115, 115);
        pdf.text(pdf.splitTextToSize(pdfText(b.sub), W - 2 * M), M, y + 6);
        y += 14;
      }
      y += 4;
    }
    if (b.kind === "note") {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 115, 115);
      const lines = pdf.splitTextToSize(pdfText(b.text), W - 2 * M);
      room(lines.length * 11 + 6);
      pdf.text(lines, M, y + 8);
      y += lines.length * 11 + 8;
    }
    if (b.kind === "summary") {
      room(40);
      autoTable(pdf, {
        startY: y,
        margin: { left: M, right: M },
        head: b.title ? [[{ content: pdfText(b.title), colSpan: 2 }]] : undefined,
        body: b.items.map((i) => [pdfText(i.label + (i.note ? ` (${i.note})` : "")), pdfText(i.value)]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4, lineColor: [225, 232, 232] },
        headStyles: { fillColor: brand, textColor: 255 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      });
      y = last() + 12;
    }
    if (b.kind === "table") {
      room(50);
      if (b.title) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(30, 40, 40);
        pdf.text(pdfText(b.title), M, y + 8);
        y += 14;
      }
      const totalW = b.columns.reduce((s, c) => s + (c.weight ?? 1), 0);
      const columnStyles: Record<number, { halign?: "right" | "left"; cellWidth?: number }> = {};
      b.columns.forEach((c, i) => (columnStyles[i] = { halign: c.align === "right" ? "right" : "left", cellWidth: ((W - 2 * M) * (c.weight ?? 1)) / totalW }));
      autoTable(pdf, {
        startY: y,
        margin: { left: M, right: M, bottom: M + 14 },
        head: [b.columns.map((c) => pdfText(c.label))],
        body: b.rows.length ? b.rows.map((r) => r.map((c) => pdfText(c.t))) : [[{ content: pdfText(b.empty ?? "No records in this period."), colSpan: b.columns.length }]],
        foot: b.total ? [b.total.map((c) => pdfText(c.t))] : undefined,
        showHead: "everyPage",
        showFoot: "lastPage",
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 3.5, overflow: "linebreak", valign: "top", textColor: [35, 45, 45] },
        headStyles: { fillColor: brand, textColor: 255, fontSize: 7.5 },
        footStyles: { fillColor: [236, 241, 241], textColor: [20, 30, 30], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 250, 250] },
        columnStyles,
      });
      y = last() + 14;
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 132, 132);
    pdf.text(pdfText(`${company} · ${doc.title}`), M, H - M + 10);
    pdf.text(`Page ${i} of ${pages}`, W - M, H - M + 10, { align: "right" });
  }
  pdf.save(`${doc.filename}.pdf`);
}
