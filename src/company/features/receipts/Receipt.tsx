// GENERATED from the STANLEY desktop app (src/features/receipts/Receipt.tsx). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Patient receipt — one component for the preview, the printout, the PDF and
 * the image, so all four are identical. Sized in real millimetres for POS
 * till rolls (58 mm, 80 mm) or an A5 page. Black on white so thermal printers
 * reproduce it faithfully.
 *
 * Order (owner spec): company logo, name, motto, branch address and contacts →
 * patient → referral, hospital, staff and dates → services and prices →
 * payment summary (discount, method, paid / outstanding or FULLY PAID) →
 * thank-you message.
 */
import { SERVICES, type getBranch } from "@company/data/company";
import type { PatientVisit } from "@company/data/demo/dailyLines";
import { formatMoney } from "@company/shared/format";
import { BrandLogo, useCompanyName } from "@company/shell/BrandLogo";
import type { ReceiptProfile } from "@company/services/receiptProfile";

export type ReceiptPaper = "58" | "80" | "a5";

export const RECEIPT_PAPERS: { id: ReceiptPaper; label: string; note: string; widthMm: number }[] = [
  { id: "58", label: "58 mm till roll", note: "Small POS / thermal printers", widthMm: 58 },
  { id: "80", label: "80 mm till roll", note: "Standard POS / thermal printers", widthMm: 80 },
  { id: "a5", label: "A5 page", note: "Office printer · 148 × 210 mm", widthMm: 148 },
];

const PAPER_STYLE: Record<ReceiptPaper, { pad: string; fs: string; logo: string }> = {
  "58": { pad: "3mm 3mm 4mm", fs: "7.6pt", logo: "11mm" },
  "80": { pad: "4mm 4.5mm 5mm", fs: "8.8pt", logo: "13mm" },
  a5: { pad: "10mm 12mm 12mm", fs: "10.5pt", logo: "17mm" },
};

export interface ReceiptOptions {
  codes: boolean;
  printedOn: boolean;
}

export interface ReceiptData {
  visit: PatientVisit;
  branch: ReturnType<typeof getBranch>;
  agentName: string | null;
  hospital: string | null;
  profile: ReceiptProfile;
  paper: ReceiptPaper;
  options: ReceiptOptions;
  printedAt: Date;
}

const CATEGORY = new Map(SERVICES.map((s) => [s.id, s.category]));
const dateText = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeText = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function ReceiptDoc({ visit, branch, agentName, hospital, profile, paper, options, printedAt }: ReceiptData) {
  const companyName = useCompanyName();
  const c = branch?.currency ?? "NGN";
  const money = (n: number) => formatMoney(n, c);
  const contact = (branch && profile.branches[branch.id]) || { address: "", phone: "" };
  const balance = visit.billed - visit.paid;
  const discount = 0; // no discounts recorded on visits yet
  const ps = PAPER_STYLE[paper];
  const width = RECEIPT_PAPERS.find((p) => p.id === paper)!.widthMm;

  return (
    <div className={`rc rc-${paper}`} style={{ width: `${width}mm`, padding: ps.pad, fontSize: ps.fs, ["--rc-logo" as string]: ps.logo }}>
      {/* Company */}
      <header className="rc-head">
        <div className="rc-logo">
          <BrandLogo receipt />
        </div>
        <div className="rc-co">{companyName}</div>
        {profile.motto && <div className="rc-motto">“{profile.motto}”</div>}
        <div className="rc-line rc-branch">
          {branch?.name} Branch · {branch?.code}
        </div>
        <div className="rc-line">{contact.address || `${branch?.city}, ${branch?.country}`}</div>
        {contact.phone && <div className="rc-line">Tel: {contact.phone}</div>}
        {profile.email && <div className="rc-line">{profile.email}</div>}
      </header>

      <div className="rc-title">Payment receipt</div>
      <div className="rc-kv">
        <span>Receipt no.</span>
        <b className="rc-num">{visit.id}</b>
      </div>
      <div className="rc-kv">
        <span>Date</span>
        <b>
          {dateText(visit.at)} · {timeText(visit.at)}
        </b>
      </div>

      {/* Patient */}
      <section className="rc-sec">
        <div className="rc-sec-t">Patient</div>
        <div className="rc-kv">
          <span>Name</span>
          <b>{visit.patientName}</b>
        </div>
        <div className="rc-kv">
          <span>Patient ID</span>
          <b className="rc-num">{visit.patientRef}</b>
        </div>
        <div className="rc-kv">
          <span>Phone</span>
          <b>{visit.phone ?? "Not provided"}</b>
        </div>
        <div className="rc-kv">
          <span>Visit</span>
          <b>{visit.isNew ? "New patient" : "Returning patient"}</b>
        </div>
      </section>

      {/* Referral & processing */}
      <section className="rc-sec">
        <div className="rc-sec-t">Referral &amp; visit</div>
        <div className="rc-kv">
          <span>Referred by</span>
          <b>{agentName ?? "Walk-in (no referrer)"}</b>
        </div>
        {agentName && (
          <div className="rc-kv">
            <span>Hospital</span>
            <b>{hospital || "Not on record"}</b>
          </div>
        )}
        <div className="rc-kv">
          <span>Processed by</span>
          <b>{visit.processedBy.name ?? visit.processedBy.role}</b>
        </div>
        <div className="rc-kv">
          <span>Date of visit</span>
          <b>{dateText(visit.at)}</b>
        </div>
      </section>

      {/* Services */}
      <section className="rc-sec">
        <div className="rc-sec-t">
          Tests &amp; services <span className="rc-count">({visit.services.length})</span>
        </div>
        {visit.services.map((s, i) => (
          <div className="rc-item" key={`${s.id}-${i}`}>
            <span className="rc-item-name">{s.name}</span>
            <span className="rc-num">{money(s.price)}</span>
            {options.codes && (
              <small>
                {CATEGORY.get(s.id) ?? "Service"} · #{s.id}
              </small>
            )}
          </div>
        ))}
      </section>

      {/* Payment */}
      <section className="rc-sec rc-pay">
        <div className="rc-sec-t">Payment summary</div>
        <div className="rc-kv">
          <span>Subtotal</span>
          <b className="rc-num">{money(visit.billed)}</b>
        </div>
        <div className="rc-kv">
          <span>Discount</span>
          <b>{discount > 0 ? `− ${money(discount)}` : "No discount"}</b>
        </div>
        <div className="rc-kv rc-total">
          <span>Total</span>
          <b className="rc-num">{money(visit.billed - discount)}</b>
        </div>
        <div className="rc-kv">
          <span>Amount paid</span>
          <b className="rc-num">{money(visit.paid)}</b>
        </div>
        <div className="rc-kv">
          <span>Payment method</span>
          <b>{visit.method ?? "Not paid yet"}</b>
        </div>
        {balance > 0 && (
          <div className="rc-kv rc-due">
            <span>Outstanding balance</span>
            <b className="rc-num">{money(balance)}</b>
          </div>
        )}
        <div className={`rc-stamp ${balance > 0 ? "is-due" : ""}`}>{balance <= 0 ? "Fully paid" : visit.paid > 0 ? "Part payment" : "Not paid"}</div>
      </section>

      {/* Thank you */}
      <footer className="rc-foot">
        <div className="rc-thanks">{profile.thankYou}</div>
        {options.printedOn && (
          <div className="rc-small">
            Printed {dateText(printedAt)} · {timeText(printedAt)}
          </div>
        )}
        <div className="rc-small">Powered by STANLEY</div>
      </footer>
    </div>
  );
}

/** Stylesheet shared verbatim by the preview and the print document. */
export const RECEIPT_CSS = `
.rc{box-sizing:border-box;background:#fff;color:#111;font-family:"IBM Plex Sans",Arial,Helvetica,sans-serif;line-height:1.38;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rc *{box-sizing:border-box}
.rc-head{text-align:center;padding-bottom:2.4mm;border-bottom:1px dashed #111}
.rc-logo{width:var(--rc-logo);height:var(--rc-logo);margin:0 auto 1.6mm}
.rc-logo svg,.rc-logo img{display:block;width:100%;height:100%;object-fit:contain}
.rc-co{font-weight:700;font-size:1.22em;line-height:1.2;text-transform:uppercase;letter-spacing:.01em}
.rc-motto{font-style:italic;margin-top:.6mm}
.rc-line{margin-top:.5mm;overflow-wrap:anywhere}
.rc-branch{font-weight:600}
.rc-title{text-align:center;margin:2.4mm 0 1.6mm;font-weight:800;letter-spacing:.22em;text-transform:uppercase;font-size:1.05em}
.rc-sec{padding:2mm 0;border-top:1px dashed #111;margin-top:1.6mm}
.rc-sec-t{font-weight:800;text-transform:uppercase;letter-spacing:.09em;font-size:.86em;margin-bottom:1.1mm}
.rc-count{font-weight:600;letter-spacing:0}
.rc-kv{display:flex;justify-content:space-between;align-items:baseline;gap:2mm;padding:.35mm 0}
.rc-kv>span{color:#333;flex:none}
.rc-kv>b{font-weight:600;text-align:right;overflow-wrap:anywhere;min-width:0}
.rc-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.3mm 2mm;padding:.9mm 0;border-bottom:1px dotted #bbb}
.rc-item:last-child{border-bottom:0}
.rc-item-name{font-weight:600;overflow-wrap:anywhere}
.rc-item small{grid-column:1/-1;color:#555;font-size:.84em}
.rc-num{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;font-weight:600;white-space:nowrap}
.rc-total{font-size:1.16em;font-weight:800;border-top:1px solid #111;border-bottom:1px solid #111;padding:1mm 0;margin:.8mm 0}
.rc-total>span{color:#111}
.rc-total b{font-weight:800}
.rc-due>span,.rc-due>b{font-weight:800;color:#111}
.rc-stamp{margin:2.6mm auto .4mm;width:fit-content;padding:1.2mm 3.2mm;border:2px solid #111;border-radius:1.5mm;font-weight:800;letter-spacing:.2em;text-transform:uppercase}
.rc-stamp.is-due{border-style:dashed}
.rc-foot{text-align:center;padding-top:2.6mm;border-top:1px dashed #111;margin-top:1.6mm}
.rc-thanks{font-weight:600;line-height:1.45}
.rc-small{margin-top:1.4mm;font-size:.8em;color:#555}
.rc-note{margin-top:1.6mm;text-align:center;font-size:.84em;line-height:1.4;color:#333}
`;
