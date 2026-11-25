// GENERATED from the STANLEY desktop app (src/features/receipts/receiptOutput.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Output for till-roll documents (patient receipts, price quotes): Print, PDF
 * and PNG are all produced from the on-screen preview element, so each one
 * matches the preview exactly.
 */
import { saveFile } from "@company/features/reports/model";
import { REPORT_FONT_URL } from "@company/features/reports/reportCss";
import { RECEIPT_CSS, RECEIPT_PAPERS, type ReceiptPaper } from "./Receipt";

const PX_PER_MM = 96 / 25.4;
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] as string);
const paperDef = (paper: ReceiptPaper) => RECEIPT_PAPERS.find((p) => p.id === paper)!;

/** Renders with the browser's own layout engine (SVG foreignObject) — fonts included. */
async function capture(el: HTMLElement) {
  const { toCanvas } = await import("html-to-image");
  await document.fonts?.ready;
  return toCanvas(el, { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true });
}

/** Prints the element on paper sized to it (till rolls: width × measured height). */
export async function printDocument(el: HTMLElement, paper: ReceiptPaper, title: string) {
  const heightMm = Math.ceil(el.getBoundingClientRect().height / PX_PER_MM) + 2;
  const size = paper === "a5" ? "A5 portrait" : `${paperDef(paper).widthMm}mm ${heightMm}mm`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${REPORT_FONT_URL}"><style>${RECEIPT_CSS}
@page{size:${size};margin:0}html,body{margin:0;padding:0;background:#fff}</style></head><body>${el.outerHTML}</body></html>`;
  const frame = document.createElement("iframe");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  await new Promise((r) => setTimeout(r, 300));
  try {
    await Promise.race([w.document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]);
  } catch {
    /* offline: system font, same as preview */
  }
  w.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 500), { once: true });
  setTimeout(() => frame.remove(), 120_000);
  w.focus();
  w.print();
}

/** Saves the element as a PDF the width of the paper. */
export async function downloadPdf(el: HTMLElement, paper: ReceiptPaper, fileBase: string) {
  const canvas = await capture(el);
  const { jsPDF } = await import("jspdf");
  const wMm = paperDef(paper).widthMm;
  const hMm = (canvas.height / canvas.width) * wMm;
  const pdf = new jsPDF({ unit: "mm", format: paper === "a5" ? "a5" : [wMm, hMm], orientation: "portrait" });
  // High-quality JPEG keeps text crisp at print resolution while keeping the file small.
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, wMm, hMm);
  pdf.save(`${fileBase}.pdf`);
}

/** Saves the element as a PNG image (for WhatsApp / email). Returns false if it failed. */
export async function exportPng(el: HTMLElement, fileBase: string): Promise<boolean> {
  const canvas = await capture(el);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  saveFile(`${fileBase}.png`, blob, "image/png");
  return true;
}
