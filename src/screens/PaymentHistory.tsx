/**
 * Payment history (owner, 2026-11-24): one statement per month, saying which
 * months are paid and which are not yet paid, with "Report a payment issue".
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Flag, Hourglass } from 'lucide-react';
import { useApp } from '@/app/store';
import { naira, shortDate } from '@/domain/format';
import { ISSUE_REASONS, monthName, monthStatements, reportIssue, usePaymentIssues, type Statement } from '@/domain/payouts';
import { commissionOf } from '@/domain/referrals';
import { Button, Card, inputClass } from '@/ui/kit';

const PAGE = 6;

export function PaymentHistory() {
  const { referrals } = useApp();
  const issues = usePaymentIssues();
  const all = monthStatements(referrals);
  const [shown, setShown] = useState(PAGE);
  const [reporting, setReporting] = useState<Statement | null>(null);
  const paidCount = all.filter((s) => s.state === 'paid').length;
  const unpaid = all.filter((s) => s.state !== 'paid');

  return (
    <section className="mb-4">
      <h2 className="mb-1 text-[17px] font-bold text-ink">Payment history</h2>
      <p className="mb-3 text-[13.5px] leading-snug text-muted">Commission is paid once a month, on the 1st, for the month before. You’ll get a notification each time a payment is made.</p>

      {all.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-[18px] bg-tint-green p-3">
            <p className="text-[12px] font-medium text-good-ink">Months paid</p>
            <p className="text-[20px] font-bold text-good-ink">{paidCount}</p>
          </div>
          <div className="rounded-[18px] bg-[#fff3e2] p-3">
            <p className="text-[12px] font-medium text-[#b45309]">Not paid yet</p>
            <p className="text-[20px] font-bold text-[#b45309]">
              {unpaid.length} <span className="text-[13px] font-semibold">({naira(unpaid.reduce((s, x) => s + x.amount, 0))})</span>
            </p>
          </div>
        </div>
      )}

      {all.length === 0 ? (
        <p className="text-[14px] text-muted">No commission earned yet. Completed referrals are paid at the start of the next month.</p>
      ) : (
        <ul className="space-y-2.5">
          {all.slice(0, shown).map((s) => (
            <li key={s.month}>
              <MonthCard s={s} issue={issues[s.month]} onReport={() => setReporting(s)} />
            </li>
          ))}
        </ul>
      )}
      {shown < all.length && (
        <Button variant="secondary" block className="mt-3" onClick={() => setShown((n) => n + PAGE)}>
          Show earlier months
        </Button>
      )}

      {reporting && <ReportSheet s={reporting} onClose={() => setReporting(null)} />}
    </section>
  );
}

function MonthCard({ s, issue, onReport }: { s: Statement; issue?: { ref: string; reason: string; at: string; status: string }; onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const state =
    s.state === 'paid'
      ? { icon: <CheckCircle2 size={20} />, tone: 'bg-tint-green text-good', badge: 'Paid', badgeTone: 'bg-tint-green text-good-ink', line: `Paid on ${shortDate(s.paidAt!)} into your bank account` }
      : s.state === 'open'
        ? { icon: <Hourglass size={19} />, tone: 'bg-tint-blue text-brand-600', badge: 'This month', badgeTone: 'bg-brand-50 text-brand-700', line: `Still earning. Paid on ${shortDate(s.payday.toISOString())}` }
        : { icon: <Clock3 size={19} />, tone: 'bg-[#fff1e0] text-[#c2410c]', badge: 'Not paid yet', badgeTone: 'bg-[#fff1e0] text-[#b45309]', line: `Due on ${shortDate(s.payday.toISOString())}` };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${state.tone}`}>{state.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-bold leading-snug text-ink">Commission for {monthName(s.month)}</p>
            <p className="shrink-0 text-[16px] font-bold text-ink">{naira(s.amount)}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold ${state.badgeTone}`}>{state.badge}</span>
            {issue && <span className="rounded-md bg-[#fdecec] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#b42318]">{issue.status}</span>}
            <span className="text-[12.5px] text-muted">
              {s.patients.length} patient{s.patients.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">{state.line}</p>
          {issue && (
            <p className="mt-2 rounded-xl bg-[#fff6f6] px-3 py-2 text-[12.5px] leading-snug text-[#7a271a]">
              <b>Issue reported, {issue.ref}:</b> {issue.reason}. Reported {shortDate(issue.at)}. The finance team is looking into it.
            </p>
          )}
        </div>
      </div>
      {open && (
        <ul className="border-t border-line bg-page/50 px-4 py-2">
          {s.patients.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-1.5 text-[13.5px]">
              <span className="min-w-0 truncate text-ink">
                {r.patient.name} <span className="text-muted">{r.id}</span>
              </span>
              <span className="shrink-0 font-semibold text-ink">{naira(commissionOf(r))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex border-t border-line">
        <button type="button" onClick={() => setOpen((v) => !v)} className="press flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13.5px] font-semibold text-brand-600">
          {open ? 'Hide patients' : 'See patients'} <ChevronDown size={15} className={open ? 'rotate-180' : ''} />
        </button>
        {s.state !== 'open' && !issue && (
          <button type="button" onClick={onReport} className="press flex flex-1 items-center justify-center gap-1.5 border-l border-line py-2.5 text-[13.5px] font-semibold text-[#d93036]">
            <Flag size={14} /> Report an issue
          </button>
        )}
      </div>
    </Card>
  );
}

function ReportSheet({ s, onClose }: { s: Statement; onClose: () => void }) {
  const { showToast } = useApp();
  const [reason, setReason] = useState(s.state === 'due' ? ISSUE_REASONS[3]! : ISSUE_REASONS[0]!);
  const [details, setDetails] = useState('');
  const send = () => {
    try {
      const i = reportIssue(s.month, reason, details);
      showToast(`Issue reported (${i.ref}). It’s now under investigation.`);
      onClose();
    } catch {
      showToast('Couldn’t save the report on this phone. Try again.');
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white px-5 pb-[max(18px,var(--safe-bottom))] pt-3 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        <p className="flex items-center gap-2 text-[19px] font-bold text-ink">
          <AlertTriangle size={20} className="text-[#d93036]" /> Report a payment issue
        </p>
        <p className="mb-4 mt-1 text-[13.5px] text-muted">
          Commission for {monthName(s.month)}, {naira(s.amount)}
          {s.paidAt ? `, marked paid on ${shortDate(s.paidAt)}` : ''}.
        </p>
        <p className="mb-2 text-[15px] font-semibold text-ink">What’s wrong?</p>
        <div className="mb-4 space-y-2" role="radiogroup">
          {ISSUE_REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={`press flex w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-[14.5px] ${reason === r ? 'border-brand-500 bg-brand-50 font-semibold text-ink' : 'border-line bg-white text-ink-2'}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${reason === r ? 'border-brand-600' : 'border-[#b6c2d4]'}`}>{reason === r && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
              {r}
            </button>
          ))}
        </div>
        <p className="mb-2 text-[15px] font-semibold text-ink">
          More details <span className="font-normal text-muted">(optional)</span>
        </p>
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 400))} rows={3} placeholder="For example, the date you checked your account..." className={`${inputClass()} mb-4 resize-none py-3`} />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send}>Send report</Button>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">The report goes to the finance team with your bank details. It’s saved on this phone and sent once the cloud connection is on.</p>
      </div>
    </div>
  );
}
