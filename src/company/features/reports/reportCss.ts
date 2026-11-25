// GENERATED from the STANLEY desktop app (src/features/reports/reportCss.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Stylesheet for report pages. Used verbatim by the in-app preview and by the
 * print document, so the printout matches the preview exactly. Colours follow
 * the selected app theme through --rp-brand / --rp-brand-ink.
 *
 * Text is never cut: cells wrap (overflow-wrap: anywhere) and layout is fixed
 * per table so measured row heights equal printed row heights.
 */
export const REPORT_FONT_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";

export const REPORT_CSS = `
.rp-page{box-sizing:border-box;background:#fff;color:#1d2a2a;font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:10.5px;line-height:1.45;display:flex;flex-direction:column;overflow:hidden;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rp-page *{box-sizing:border-box}
.rp-run{display:flex;justify-content:space-between;gap:16px;align-items:center;font-size:9px;color:#6b7b7b;padding-bottom:7px;border-bottom:1px solid #e1e8e8;margin-bottom:12px}
.rp-run b{color:var(--rp-brand,#2a746e);font-weight:700;letter-spacing:.02em}
.rp-body{flex:1;min-height:0}
.rp-foot{display:flex;justify-content:space-between;gap:16px;font-size:8.5px;color:#7a8a8a;padding-top:7px;border-top:1px solid #e1e8e8}
.rp-block{padding-bottom:12px}
.rp-head{padding:2px 0 2px 12px;border-left:4px solid var(--rp-brand,#2a746e)}
.rp-head h1{margin:0;font-size:19px;line-height:1.25;font-weight:700;color:#14201f}
.rp-head p{margin:3px 0 0;color:#566767;font-size:11px}
.rp-meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 16px;margin:12px 0 0;padding:10px 12px;border-radius:6px;background:#f3f7f7;border:1px solid #e3eaea}
.rp-meta div{min-width:0}
.rp-meta dt{font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a8a8a}
.rp-meta dd{margin:1px 0 0;font-weight:600;color:#1d2a2a;overflow-wrap:anywhere}
.rp-h2{font-size:12.5px;font-weight:700;color:var(--rp-brand-ink,#185753);padding-top:4px}
.rp-h2 small{display:block;font-size:9.5px;font-weight:400;color:#647575;margin-top:2px;overflow-wrap:anywhere}
.rp-summary{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.rp-summary-title{font-weight:700;font-size:11px;margin-bottom:6px}
.rp-sum{padding:8px 10px;border:1px solid #e1e8e8;border-radius:6px;border-top:3px solid var(--rp-brand,#2a746e)}
.rp-sum span{display:block;font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7b7b}
.rp-sum b{display:block;font-size:13px;margin-top:2px;color:#14201f;overflow-wrap:anywhere}
.rp-sum b.bad{color:#c0392b}
.rp-sum small{display:block;font-size:8.5px;color:#7a8a8a}
.rp-tt{font-weight:700;font-size:11px;color:#14201f;padding-bottom:5px}
.rp-tt small{font-weight:400;color:#6b7b7b;margin-left:6px}
.rp-cont{font-size:8.5px;color:#7a8a8a;padding-bottom:4px;font-style:italic}
.rp-table{width:100%;border-collapse:collapse;table-layout:fixed}
.rp-table th{text-align:left;vertical-align:bottom;padding:5px 6px;font-size:8.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--rp-brand-ink,#185753);background:color-mix(in srgb,var(--rp-brand,#2a746e) 11%,#fff);border-bottom:1.5px solid var(--rp-brand,#2a746e);overflow-wrap:anywhere}
.rp-table td{padding:4.5px 6px;vertical-align:top;border-bottom:1px solid #e6eded;overflow-wrap:anywhere;word-break:break-word}
.rp-table tbody tr:nth-child(even) td{background:#f8fbfb}
.rp-table .r{text-align:right}
.rp-table td.b{font-weight:700}
.rp-table td.muted{color:#8a9999}
.rp-table td.bad{color:#c0392b}
.rp-table td.good{color:#1e7d52}
.rp-table tfoot td{font-weight:700;background:#eef4f4;border-top:1.5px solid #1d2a2a;border-bottom:0}
.rp-empty{padding:10px 6px;color:#7a8a8a;font-style:italic}
.rp-note{font-size:9.5px;color:#5a6b6b;font-style:italic;padding:2px 0 10px}
`;
