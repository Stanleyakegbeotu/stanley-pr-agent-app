/**
 * Patient receipts in the staff workspace (owner, 2026-11-25): the SAME
 * receipt document as the desktop (BillingReceipt OrderReceiptDoc, the
 * desktop's receipt styles and its print / PDF / image output, synced in
 * src/company/features/receipts), shown on the phone: choose the paper
 * (58 mm, 80 mm or A5), see it, then Print, Download PDF or Save image.
 * Every output is written to the Audit Log, as on the desktop.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { getBranch } from '@company/data/company';
import { formatMoney } from '@company/shared/format';
import { BrandLogo, useCompanyName } from '@company/shell/BrandLogo';
import { logAudit } from '@company/services/audit';
import { useReceiptProfile, type ReceiptProfile } from '@company/services/receiptProfile';
import type { Order, PayChoice } from '@company/services/billing';
import { RECEIPT_CSS, RECEIPT_PAPERS, type ReceiptPaper } from '@company/features/receipts/Receipt';

const PAPER_STYLE: Record<ReceiptPaper, { pad: string; fs: string; logo: string }> = {
  '58': { pad: '3mm 3mm 4mm', fs: '7.6pt', logo: '11mm' },
  '80': { pad: '4mm 4.5mm 5mm', fs: '8.8pt', logo: '13mm' },
  a5: { pad: '10mm 12mm 12mm', fs: '10.5pt', logo: '17mm' },
};
const dateText = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeText = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const METHOD_NAME: Record<string, string> = { Cash: 'Cash', POS: 'POS', Transfer: 'Bank transfer' };
export const methodLabel = (m: PayChoice | null) => (m === null ? 'Not paid' : m === 'Split' ? 'Split payment' : (METHOD_NAME[m] ?? m));

/** The desktop's receipt for a saved bill, line for line. */
export function OrderReceiptDoc({ order, branch, profile, paper, printedAt }: { order: Order; branch: ReturnType<typeof getBranch>; profile: ReceiptProfile; paper: ReceiptPaper; printedAt: Date }) {
  const companyName = useCompanyName();
  const money = (n: number) => formatMoney(n, order.currency as 'NGN');
  const contact = (branch && profile.branches[branch.id]) || { address: '', phone: '' };
  const ps = PAPER_STYLE[paper];
  const width = RECEIPT_PAPERS.find((p) => p.id === paper)!.widthMm;
  const at = new Date(order.createdAt);
  return (
    <div className={`rc rc-${paper}`} style={{ width: `${width}mm`, padding: ps.pad, fontSize: ps.fs, ['--rc-logo' as string]: ps.logo }}>
      <header className="rc-head">
        <div className="rc-logo">
          <BrandLogo receipt />
        </div>
        <div className="rc-co">{companyName}</div>
        {profile.motto && <div className="rc-motto">“{profile.motto}”</div>}
        <div className="rc-line rc-branch">
          {order.branchName} Branch · {branch?.code}
        </div>
        <div className="rc-line">{contact.address || `${branch?.city}, ${branch?.country}`}</div>
        {contact.phone && <div className="rc-line">Tel: {contact.phone}</div>}
        {profile.email && <div className="rc-line">{profile.email}</div>}
      </header>
      <div className="rc-title">Payment receipt</div>
      <div className="rc-kv">
        <span>Receipt no.</span>
        <b className="rc-num">{order.invoiceNo}</b>
      </div>
      <div className="rc-kv">
        <span>Date</span>
        <b>
          {dateText(at)} · {timeText(at)}
        </b>
      </div>
      <section className="rc-sec">
        <div className="rc-sec-t">Patient</div>
        <div className="rc-kv">
          <span>Name</span>
          <b>{order.patient.name}</b>
        </div>
        <div className="rc-kv">
          <span>Patient ID</span>
          <b className="rc-num">{order.patient.patientId}</b>
        </div>
        <div className="rc-kv">
          <span>Phone</span>
          <b>{order.patient.phone || 'Not provided'}</b>
        </div>
        <div className="rc-kv">
          <span>Patient type</span>
          <b>{order.patient.type === 'REFERRED' ? 'Referred' : 'Walk-in'}</b>
        </div>
      </section>
      <section className="rc-sec">
        <div className="rc-sec-t">Referral &amp; visit</div>
        <div className="rc-kv">
          <span>Referred by</span>
          <b>{order.referral.agentName ?? 'Walk-in (no referrer)'}</b>
        </div>
        {order.referral.agentName && (
          <div className="rc-kv">
            <span>Hospital</span>
            <b>{order.referral.hospital}</b>
          </div>
        )}
        <div className="rc-kv">
          <span>Processed by</span>
          <b>{order.createdBy.name}</b>
        </div>
      </section>
      <section className="rc-sec">
        <div className="rc-sec-t">
          Tests &amp; services <span className="rc-count">({order.services.length})</span>
        </div>
        {order.services.map((s) => (
          <div className="rc-item" key={s.id}>
            <span className="rc-item-name">{s.name}</span>
            <span className="rc-num">{money(s.appliedPrice)}</span>
            <small>
              {s.category} · #{s.id}
            </small>
          </div>
        ))}
      </section>
      <section className="rc-sec rc-pay">
        <div className="rc-sec-t">Payment summary</div>
        <div className="rc-kv">
          <span>Subtotal</span>
          <b className="rc-num">{money(order.subtotal)}</b>
        </div>
        <div className="rc-kv">
          <span>Discount</span>
          <b>{order.discount > 0 ? `− ${money(order.discount)}` : 'No discount'}</b>
        </div>
        <div className="rc-kv rc-total">
          <span>Total</span>
          <b className="rc-num">{money(order.total)}</b>
        </div>
        <div className="rc-kv">
          <span>Amount paid</span>
          <b className="rc-num">{money(order.amountPaid)}</b>
        </div>
        <div className="rc-kv">
          <span>Payment method</span>
          <b>{methodLabel(order.method)}</b>
        </div>
        {order.split.map((x) => (
          <div className="rc-kv" key={x.method}>
            <span>· {METHOD_NAME[x.method]}</span>
            <b className="rc-num">{money(x.amount)}</b>
          </div>
        ))}
        {order.balance > 0 && (
          <div className="rc-kv rc-due">
            <span>Outstanding balance</span>
            <b className="rc-num">{money(order.balance)}</b>
          </div>
        )}
        {order.balance > 0 && order.balanceInfo.promiseDate && (
          <div className="rc-kv">
            <span>Balance due by</span>
            <b>{dateText(new Date(`${order.balanceInfo.promiseDate}T00:00:00`))}</b>
          </div>
        )}
        <div className={`rc-stamp ${order.balance > 0 ? 'is-due' : ''}`}>{order.balance <= 0 ? 'Fully paid' : order.amountPaid > 0 ? 'Part payment' : 'Not paid'}</div>
      </section>
      <footer className="rc-foot">
        <div className="rc-thanks">{profile.thankYou}</div>
        <div className="rc-small">
          Printed {dateText(printedAt)} · {timeText(printedAt)}
        </div>
        <div className="rc-small">Powered by STANLEY</div>
      </footer>
    </div>
  );
}

/**
 * The receipt on the phone: VIEW ONLY (owner, 2026-11-25, patient privacy).
 * Same layout as the desktop receipt; no print, PDF, image, copy or screen
 * capture on the mobile app. Patients get their printed receipt from the
 * branch computer (Electron), where printing is allowed.
 */
export function ReceiptPanel({ order, branch }: { order: Order; branch: NonNullable<ReturnType<typeof getBranch>> }) {
  const profile = useReceiptProfile();
  const [paper, setPaper] = useState<ReceiptPaper>('80');
  const printedAt = useMemo(() => new Date(), []);
  const box = useRef<HTMLDivElement>(null);
  const doc = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState(400);
  const paperDef = RECEIPT_PAPERS.find((p) => p.id === paper)!;
  useEffect(() => {
    logAudit({ category: 'Receipts', action: 'Receipt viewed on the mobile app', record: `${order.invoiceNo} · ${order.patient.patientId}`, details: 'View only', branchId: order.branchId });
  }, [order.invoiceNo, order.patient.patientId, order.branchId]);
  // Fit the receipt to the phone's width (A5 is wider than a phone).
  useEffect(() => {
    const fit = () => {
      const el = doc.current?.querySelector<HTMLElement>('.rc');
      const w = box.current?.clientWidth ?? 320;
      if (!el) return;
      const sc = Math.min(1, (w - 16) / el.offsetWidth);
      setScale(sc);
      setH(el.offsetHeight * sc + 16);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    if (doc.current) ro.observe(doc.current);
    return () => ro.disconnect();
  }, [paper, order]);
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-white p-1 ring-1 ring-line" role="radiogroup" aria-label="Receipt size">
        {RECEIPT_PAPERS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={paper === p.id} onClick={() => setPaper(p.id)} className={`press min-h-9 rounded-full text-[13px] font-semibold ${paper === p.id ? 'bg-brand-600 text-white' : 'text-ink-2'}`}>
            {p.id === 'a5' ? 'A5 paper' : `${p.id} mm roll`}
          </button>
        ))}
      </div>
      <div ref={box} className="relative overflow-hidden rounded-[22px] bg-[#eef2f8] p-2 ring-1 ring-line/70" style={{ height: h }}>
        <style>{RECEIPT_CSS}</style>
        <div ref={doc} className="absolute left-1/2 top-2 w-max shadow-[0_8px_24px_rgba(11,23,48,0.15)]" style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}>
          <OrderReceiptDoc order={order} branch={branch} profile={profile} paper={paper} printedAt={printedAt} />
        </div>
      </div>
      <p className="mt-1.5 text-center text-[11.5px] text-muted">{paperDef.label} · how it prints at the branch</p>
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-[#eef4ff] p-3.5 ring-1 ring-[#d6e4ff]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
          <ShieldCheck size={20} />
        </span>
        <span className="min-w-0">
          <b className="block text-[14px] text-ink">View only on the phone</b>
          <span className="block text-[12.5px] leading-snug text-ink-2">To protect patient privacy, receipts cannot be printed, downloaded, copied or captured on the mobile app. Print the patient's receipt from a branch computer.</span>
        </span>
      </div>
    </div>
  );
}
