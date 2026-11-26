/**
 * PR agent's reports (owner, 2026-11-26): the agent tells the branch about a
 * problem (often what a patient said): the front desk was rude, a result
 * was not clear, a long wait, a price that did not match, no power, the
 * app … and follows what happened to it: Sent, Being looked into, Resolved
 * (with what the branch did). Same reports as the branch and the Company
 * Admin see (src/company/services/issueReports); who sees each one follows
 * what it is about (a report about the front desk goes to the manager and
 * the admin, never the front desk).
 *
 * Also the month log on the Referrals page (MonthLog): each month Ongoing,
 * Ended, Ended ✓, Under review or Resolved, with "Report an issue with
 * this month". Never money words: the agent sees no payout or commission.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, CircleDot, Flag, Plus, Send } from 'lucide-react';
import { useApp } from '@/app/store';
import { BRANCH } from '@/config/org';
import { useProfile } from '@/domain/profile';
import { MY_AGENT_ID } from '@/domain/agentIdentity';
import { addReport, reportsOfAgent, useIssueReports, type AboutKind, type IssueReport, type ReportPriority, type ReportStatus } from '@company/services/issueReports';
import { monthLabel } from '@company/services/payoutMonths';
import { Sheet } from '@/admin/ui';
import { Button, ScreenHeader, Sticker, inputClass } from '@/ui/kit';

/** What the agent can report about (the month issues come from the month log). */
const ABOUT_AGENT: { kind: AboutKind; label: string; who: string }[] = [
  { kind: 'frontdesk', label: 'The front desk (a receptionist)', who: 'The Branch Manager and the Company Admin see it. The front desk does not.' },
  { kind: 'staff', label: 'Another staff member (lab, imaging …)', who: 'The Branch Manager and the Company Admin see it.' },
  { kind: 'manager', label: 'The Branch Manager', who: 'Only the Company Admin sees it.' },
  { kind: 'service', label: 'A result or a test', who: 'The branch team sees it.' },
  { kind: 'waiting', label: 'Waiting time', who: 'The branch team sees it.' },
  { kind: 'billing', label: 'A price that did not match', who: 'The Branch Manager and the Company Admin see it.' },
  { kind: 'facility', label: 'The building, power or equipment', who: 'The branch team sees it.' },
  { kind: 'app', label: 'This app', who: 'The Company Admin and the Branch Manager see it.' },
  { kind: 'other', label: 'Something else', who: 'The branch team sees it.' },
];
const TO_FOR: Record<AboutKind, 'admin' | 'manager' | 'frontdesk'> = { frontdesk: 'manager', staff: 'manager', manager: 'admin', service: 'frontdesk', waiting: 'manager', billing: 'manager', facility: 'manager', app: 'admin', payout: 'manager', other: 'manager' };
export const AGENT_STATUS: Record<ReportStatus, { label: string; pill: string }> = {
  new: { label: 'Sent', pill: 'bg-[#eef4ff] text-brand-700' },
  attended: { label: 'Being looked into', pill: 'bg-[#fff1de] text-[#b45309]' },
  resolved: { label: 'Resolved', pill: 'bg-[#e9f9ef] text-good-ink' },
};
const stamp = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function MyReports() {
  const all = useIssueReports();
  const mine = useMemo(() => reportsOfAgent(all, MY_AGENT_ID).sort((a, b) => b.at.localeCompare(a.at)), [all]);
  const [writing, setWriting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (mine.find((r) => r.id === openId) ?? null) : null;
  return (
    <div className="pb-6">
      <ScreenHeader title="Reports" />
      <section className="mb-4 overflow-hidden rounded-[24px] bg-linear-to-br from-[#1b5fd6] to-[#4f8ff0] p-5 text-white shadow-[0_14px_30px_rgba(31,111,232,0.3)]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-extrabold leading-tight">Tell the branch about a problem</p>
            <p className="mt-1 text-[13.5px] text-white/85">What a patient told you, a result that was not clear, a long wait … The right person at the branch sees it and tells you what was done.</p>
          </div>
          <Sticker name="megaphone" size={64} />
        </div>
        <button type="button" onClick={() => setWriting(true)} className="press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-brand-700">
          <Plus size={19} /> Report a problem
        </button>
      </section>
      <p className="mb-2 px-1 text-[13px] font-bold text-ink-2">Your reports</p>
      {mine.length ? (
        <ul className="space-y-2.5">
          {mine.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpenId(r.id)} className="press flex w-full items-center gap-3 rounded-[20px] bg-white p-3.5 text-left ring-1 ring-line/70">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${r.status === 'resolved' ? 'bg-[#e9f9ef] text-good' : 'bg-brand-50 text-brand-600'}`}>{r.status === 'resolved' ? <CheckCircle2 size={20} /> : r.status === 'attended' ? <CircleDot size={20} /> : <Flag size={19} />}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px] text-ink">{r.subject}</b>
                  <span className="block truncate text-[12.5px] text-muted">
                    {r.month ? stamp(r.at) : `${r.category} · ${stamp(r.at)}`}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${AGENT_STATUS[r.status].pill}`}>{AGENT_STATUS[r.status].label}</span>
                <ChevronRight size={17} className="shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-[22px] bg-white px-5 py-8 text-center ring-1 ring-line/70">
          <Sticker name="check" size={56} />
          <p className="mt-2 text-[15px] font-semibold text-ink">No reports yet</p>
          <p className="text-[13px] text-muted">When you report a problem, you can follow it here.</p>
        </div>
      )}
      {writing && <ReportForm onClose={() => setWriting(false)} onSent={(id) => (setWriting(false), setOpenId(id))} />}
      {open && <AgentReportSheet r={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** One of the agent's reports: what they sent, where it is and what the branch did (internal notes stay at the branch). */
export function AgentReportSheet({ r, onClose }: { r: IssueReport; onClose: () => void }) {
  const done = [...r.history].reverse().find((h) => h.action === 'Resolved');
  return (
    <Sheet title={r.subject} subtitle={`${r.id} · ${stamp(r.at)}`} onClose={onClose} tall>
      <div className="space-y-3 px-1 pb-4">
        <span className={`inline-flex rounded-full px-3 py-1 text-[13px] font-bold ${AGENT_STATUS[r.status].pill}`}>{AGENT_STATUS[r.status].label}</span>
        {r.month && <p className="text-[13.5px] text-ink-2">About {monthLabel(r.month)}</p>}
        <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted">What you reported</p>
          <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">{r.details}</p>
          {r.patientRef && <p className="mt-2 font-mono text-[13px] text-brand-700">{r.patientRef}</p>}
        </div>
        {done?.note && (
          <div className="rounded-[20px] bg-[#e9f9ef] p-3.5 ring-1 ring-[#c8efd7]">
            <p className="text-[12px] font-bold uppercase tracking-wide text-good-ink">What the branch did</p>
            <p className="mt-1 text-[14.5px] text-ink">{done.note}</p>
          </div>
        )}
        <ol className="relative ml-2 border-l-2 border-line pl-4">
          {r.history
            .filter((h) => h.action !== 'Note added' && !h.action.startsWith('Priority'))
            .map((h, i) => (
              <li key={i} className="relative pb-3 last:pb-0">
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" />
                <p className="text-[13.5px] font-semibold text-ink">{h.action === 'Report sent' ? 'You sent it' : h.action === 'Marked attended' ? 'The branch is looking into it' : h.action === 'Reopened' ? 'Opened again' : h.action}</p>
                <p className="text-[12px] text-muted">{stamp(h.at)}</p>
              </li>
            ))}
        </ol>
        <p className="text-[12px] text-muted">If you are not happy with the answer, message the branch from your Inbox.</p>
      </div>
    </Sheet>
  );
}

/** The report form; `month` makes it a report about that month (from the month log). */
export function ReportForm({ month, onClose, onSent }: { month?: string; onClose: () => void; onSent: (id: string) => void }) {
  const me = useProfile();
  const { showToast } = useApp();
  const name = [me.title, me.firstName, me.lastName].filter(Boolean).join(' ') || 'PR agent';
  const [about, setAbout] = useState<AboutKind>(month ? 'payout' : 'frontdesk');
  const [priority, setPriority] = useState<ReportPriority>(month ? 'high' : 'normal');
  const [subject, setSubject] = useState(month ? `About ${monthLabel(month)}` : '');
  const [details, setDetails] = useState('');
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const errs = { subject: subject.trim().length < 5 ? 'Give it a short title.' : null, details: details.trim().length < 10 ? 'Say what happened.' : null };
  const send = () => {
    setTried(true);
    if (errs.subject || errs.details) return;
    const r = addReport({ branchId: BRANCH.id, from: { kind: 'agent', name, role: 'PR agent', agentId: MY_AGENT_ID }, to: TO_FOR[about], aboutKind: about, priority, subject: subject.trim(), details: details.trim(), patientRef: ref.trim().toUpperCase() || undefined, month }, name);
    showToast(month ? `Sent. ${monthLabel(month)} shows Under review until the branch answers.` : 'Report sent. You can follow it in Reports.');
    onSent(r.id);
  };
  const def = ABOUT_AGENT.find((a) => a.kind === about);
  return (
    <Sheet
      title={month ? `Report an issue with ${monthLabel(month)}` : 'Report a problem'}
      subtitle={month ? 'The Branch Manager and the Company Admin see it' : 'The right person at the branch sees it'}
      onClose={onClose}
      tall
      footer={
        <Button block onClick={send}>
          <Send size={18} /> Send report
        </Button>
      }
    >
      <div className="space-y-4 px-1 pb-3">
        {!month && (
          <div>
            <p className="mb-1.5 text-[14px] font-semibold text-ink">What is it about?</p>
            <div className="space-y-1.5">
              {ABOUT_AGENT.map((a) => (
                <button key={a.kind} type="button" role="radio" aria-checked={about === a.kind} onClick={() => setAbout(a.kind)} className={`press flex w-full items-center rounded-2xl px-3.5 py-3 text-left text-[14.5px] font-semibold ${about === a.kind ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white text-ink ring-1 ring-line'}`}>
                  {a.label}
                </button>
              ))}
            </div>
            {def && <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800">{def.who}</p>}
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[14px] font-semibold text-ink">How urgent is it?</p>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 ring-1 ring-line" role="radiogroup" aria-label="How urgent">
            {(
              [
                ['normal', 'Normal'],
                ['high', 'Urgent'],
                ['critical', 'Critical'],
              ] as const
            ).map(([p, l]) => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)} className={`press min-h-11 rounded-xl text-[13.5px] font-semibold ${priority === p ? (p === 'critical' ? 'bg-[#ef4444] text-white' : 'bg-brand-600 text-white') : 'text-ink-2'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Title</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 120))} placeholder="For example: My patient waited two hours" className={inputClass()} />
          {tried && errs.subject && <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{errs.subject}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">What happened</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 2000))} rows={5} placeholder={month ? 'What is wrong with this month? Press Enter for a new line.' : 'Who, when and what happened. Press Enter for a new line.'} className={`${inputClass()} min-h-32 py-3`} />
          {tried && errs.details && <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{errs.details}</span>}
        </label>
        {!month && (
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-ink">
              Referral ID <span className="font-normal text-muted">(optional)</span>
            </span>
            <input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase().slice(0, 20))} placeholder="ABJ-R000123" className={`${inputClass()} font-mono`} />
          </label>
        )}
      </div>
    </Sheet>
  );
}
