/**
 * Monthly history log on the Referrals page (owner, 2026-11-26). One row a
 * month: Ongoing (this month), Ended, Ended ✓ (the branch has settled the
 * month), Under review (the agent reported an issue with it) or Resolved
 * (the branch answered). Never the words paid, payout or commission.
 *
 * Tap a month: what went through that month (tests done and their value,
 * tests not yet done, patients who did not come), and for a past month
 * "Report an issue with <month>", which goes to the Branch Manager and the
 * Company Admin as a report; the month shows Under review until resolved.
 */
import { useMemo, useState } from 'react';
import { CalendarCheck2, CalendarClock, ChevronRight, CircleCheckBig, Flag, SearchCheck } from 'lucide-react';
import { useApp } from '@/app/store';
import { BRANCH } from '@/config/org';
import { naira } from '@/domain/format';
import { MY_AGENT_ID } from '@/domain/agentIdentity';
import { servicesOf, statusOf, type Referral } from '@/domain/referrals';
import { reportsOfAgent, useIssueReports } from '@company/services/issueReports';
import { MONTH_STATE_TEXT, lastMonths, monthLabel, monthOf, monthStateFor, usePaidMarks, type MonthState } from '@company/services/payoutMonths';
import { Sheet } from '@/admin/ui';
import { Button } from '@/ui/kit';
import { AgentReportSheet, ReportForm } from '../MyReports';

const LOOK: Record<MonthState, { pill: string; icon: typeof Flag }> = {
  ongoing: { pill: 'bg-[#eef4ff] text-brand-700', icon: CalendarClock },
  ended: { pill: 'bg-page text-ink-2', icon: CalendarCheck2 },
  ticked: { pill: 'bg-[#e9f9ef] text-good-ink', icon: CircleCheckBig },
  review: { pill: 'bg-[#fff1de] text-[#b45309]', icon: SearchCheck },
  resolved: { pill: 'bg-[#e9f9ef] text-good-ink', icon: CircleCheckBig },
};

const went = (r: Referral) => ['Arrived', 'TestsDone', 'ResultsReady'].includes(statusOf(r));

/** What the month looked like for the agent. */
function monthFigures(list: Referral[]) {
  let doneValue = 0;
  let notDoneValue = 0;
  let notDone = 0;
  for (const r of list) {
    const tests = servicesOf(r);
    if (went(r)) {
      const done = r.doneServiceIds ? tests.filter((x) => r.doneServiceIds!.includes(x.id)) : tests;
      doneValue += done.reduce((n, x) => n + (x.price ?? 0), 0);
      const left = tests.filter((x) => !done.includes(x));
      notDone += left.length;
      notDoneValue += left.reduce((n, x) => n + (x.price ?? 0), 0);
    } else if (statusOf(r) === 'Requested') {
      notDone += tests.length;
      notDoneValue += tests.reduce((n, x) => n + (x.price ?? 0), 0);
    }
  }
  return { sent: list.length, went: list.filter(went).length, didNotCome: list.filter((r) => statusOf(r) === 'NotAttended').length, doneValue, notDoneValue, notDone };
}

export function MonthLog() {
  const { referrals } = useApp();
  const marks = usePaidMarks();
  const reports = useIssueReports();
  const [open, setOpen] = useState<string | null>(null);
  const months = lastMonths(6);
  const byMonth = useMemo(() => {
    const m = new Map<string, Referral[]>();
    for (const r of referrals) m.set(monthOf(new Date(r.createdAt)), [...(m.get(monthOf(new Date(r.createdAt))) ?? []), r]);
    return m;
  }, [referrals]);
  return (
    <section className="mb-5">
      <p className="mb-2 px-1 text-[13px] font-bold text-ink-2">Monthly history</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70">
        {months.map((m) => {
          const st = monthStateFor(marks, reports, BRANCH.id, MY_AGENT_ID, m);
          const L = LOOK[st];
          const n = byMonth.get(m)?.length ?? 0;
          return (
            <li key={m}>
              <button type="button" onClick={() => setOpen(m)} className="press flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${L.pill}`}>
                  <L.icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[14.5px] text-ink">{monthLabel(m)}</b>
                  <span className="block text-[12.5px] text-muted">
                    {n} referral{n === 1 ? '' : 's'}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${L.pill}`}>
                  {MONTH_STATE_TEXT[st]}
                  {st === 'ticked' ? ' ✓' : ''}
                </span>
                <ChevronRight size={17} className="shrink-0 text-faint" />
              </button>
            </li>
          );
        })}
      </ul>
      {open && <MonthSheet month={open} list={byMonth.get(open) ?? []} onClose={() => setOpen(null)} />}
    </section>
  );
}

function MonthSheet({ month, list, onClose }: { month: string; list: Referral[]; onClose: () => void }) {
  const marks = usePaidMarks();
  const reports = useIssueReports();
  const [writing, setWriting] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const st = monthStateFor(marks, reports, BRANCH.id, MY_AGENT_ID, month);
  const f = monthFigures(list);
  const mine = reportsOfAgent(reports, MY_AGENT_ID).filter((r) => r.month === month);
  const viewing = view ? (mine.find((r) => r.id === view) ?? null) : null;
  const text: Record<MonthState, string> = {
    ongoing: 'This month is still going on.',
    ended: 'This month has ended.',
    ticked: 'This month has ended and the branch has settled it.',
    review: 'You reported an issue with this month. The branch is looking into it.',
    resolved: 'The branch has answered the issue you reported with this month.',
  };
  return (
    <Sheet
      title={monthLabel(month)}
      subtitle={`${MONTH_STATE_TEXT[st]}${st === 'ticked' ? ' ✓' : ''}`}
      onClose={onClose}
      tall
      footer={
        st !== 'ongoing' ? (
          <Button block variant={st === 'review' ? 'secondary' : undefined} onClick={() => setWriting(true)}>
            <Flag size={18} /> Report an issue with {monthLabel(month)}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 px-1 pb-4">
        <p className={`rounded-2xl px-3.5 py-3 text-[13.5px] ${LOOK[st].pill}`}>{text[st]}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Referrals sent', String(f.sent)],
            ['Went through', String(f.went)],
            ['Tests done', naira(f.doneValue)],
            ['Tests not yet done', `${naira(f.notDoneValue)} · ${f.notDone} test${f.notDone === 1 ? '' : 's'}`],
            ['Did not come', String(f.didNotCome)],
          ].map(([l, v]) => (
            <span key={l} className="rounded-2xl bg-white px-3.5 py-3 ring-1 ring-line/70">
              <span className="block text-[12px] text-muted">{l}</span>
              <b className="block text-[16px] text-ink">{v}</b>
            </span>
          ))}
        </div>
        {mine.length > 0 && (
          <div>
            <p className="mb-1.5 px-1 text-[13px] font-bold text-ink-2">Your reports about this month</p>
            <ul className="space-y-2">
              {mine.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setView(r.id)} className="press flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] text-ink">{r.subject}</b>
                      <span className="text-[12px] text-muted">{new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${r.status === 'resolved' ? 'bg-[#e9f9ef] text-good-ink' : 'bg-[#fff1de] text-[#b45309]'}`}>{r.status === 'resolved' ? 'Resolved' : 'Under review'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {writing && <ReportForm month={month} onClose={() => setWriting(false)} onSent={() => setWriting(false)} />}
      {viewing && <AgentReportSheet r={viewing} onClose={() => setView(null)} />}
    </Sheet>
  );
}
