/**
 * Mobile PR Management additions (owner, 2026-11-26), the same as the
 * desktop (features/pr/AgentMonitor) on the shared logic
 * (src/company/services/agentMonitor, payoutMonths):
 *
 *  • PR agent monitor: who is slipping, gone quiet, inactive, never sent,
 *    growing or top, what to do about each, a check-up list and a visit plan
 *    by hospital. Logging a check-up (visit, call or message, how it went,
 *    the next date) turns the agent's flag off. Admin, manager, front desk.
 *  • Monthly payouts: mark a month paid per agent or for all (Branch
 *    Manager: own branch; Company Admin: any branch). Agents only see
 *    "Ended ✓" in their app; their reported issues with a month show here.
 */
import { useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, ChevronRight, ClipboardCheck, Flag, MapPinned, RotateCcw, Siren } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { hasPhone } from '@company/data/legacy';
import { isoDate } from '@company/data/demo/generator';
import { logAudit } from '@company/services/audit';
import { agentRanking, resolveRange } from '@company/services/analytics';
import { OUTCOMES, STATUS_HINT, STATUS_LABEL, addCheckUp, useAgentHealth, useCheckUps, type AgentHealth, type AgentStatus, type CheckKind, type Outcome } from '@company/services/agentMonitor';
import { useIssueReports } from '@company/services/issueReports';
import { canMarkPaid, lastMonths, markPaid, monthLabel, paidMark, unmarkPaid, usePaidMarks } from '@company/services/payoutMonths';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import { Sheet } from './ui';
import { Chips } from './branchFirst';
import { LongText } from './fields';
import { FieldErr, FieldLabel, inputCls } from './prManage';
import { useRight } from './access';
import { useStaffChrome } from '@/staff/chrome';

const PILL: Record<AgentStatus, string> = {
  slipping: 'bg-[#ffe4e4] text-[#b42318]',
  quiet: 'bg-[#fff1de] text-[#b45309]',
  inactive: 'bg-[#fff1de] text-[#9a5b00]',
  never: 'bg-page text-ink-2',
  top: 'bg-[#e9f9ef] text-good-ink',
  rising: 'bg-[#e9f9ef] text-good-ink',
  steady: 'bg-page text-ink-2',
};
const TILES: AgentStatus[] = ['slipping', 'quiet', 'inactive', 'never', 'top', 'rising'];
const day = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never');

function Spark({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <span className="flex h-6 items-end gap-[2px]" aria-hidden="true">
      {weeks.map((w, i) => (
        <i key={i} className={`w-[5px] rounded-sm ${i >= 8 ? 'bg-brand-600' : 'bg-[#c9d7ee]'}`} style={{ height: `${Math.max(2, Math.round((w / max) * 22))}px` }} />
      ))}
    </span>
  );
}

/* ─────────────── monitor ─────────────── */

export function MonitorCard({ branchId }: { branchId: string }) {
  const list = useAgentHealth(branchId);
  const [open, setOpen] = useState<AgentStatus | 'due' | null>(null);
  if (!list.length) return null;
  const due = list.filter((a) => a.due).length;
  const count = (s: AgentStatus) => list.filter((a) => a.status === s).length;
  return (
    <section className="mt-4 rounded-[24px] bg-white p-4 ring-1 ring-line/70">
      <button type="button" onClick={() => setOpen('due')} className="press flex w-full items-center gap-3 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
          <ClipboardCheck size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] text-ink">PR agent monitor</b>
          <span className="block text-[12.5px] text-muted">Who to check up on, and why</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-bold ${due ? 'bg-[#ffe4e4] text-[#b42318]' : 'bg-[#e9f9ef] text-good-ink'}`}>{due ? `${formatCount(due)} to check` : 'All checked'}</span>
      </button>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {TILES.map((s) => (
          <button key={s} type="button" onClick={() => setOpen(s)} className={`press shrink-0 rounded-2xl px-3 py-2 text-left ${PILL[s]}`}>
            <b className="block text-[17px] leading-tight">{formatCount(count(s))}</b>
            <span className="text-[11.5px] font-semibold">{STATUS_LABEL[s]}</span>
          </button>
        ))}
      </div>
      {open && <MonitorSheet branchId={branchId} initial={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function MonitorSheet({ branchId, initial, onClose }: { branchId: string; initial: AgentStatus | 'due'; onClose: () => void }) {
  const list = useAgentHealth(branchId);
  const [view, setView] = useState<'due' | 'plan' | 'all'>(initial === 'due' ? 'due' : 'all');
  const [status, setStatus] = useState<AgentStatus | 'any'>(initial === 'due' ? 'any' : initial);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(30);
  const [log, setLog] = useState<AgentHealth | null>(null);
  const t = q.trim().toLowerCase();
  const due = list.filter((a) => a.due);
  const rows = (view === 'due' ? due : list).filter((a) => (status === 'any' || a.status === status) && (!t || `${a.agent.name} ${a.hospital} ${a.agent.phone}`.toLowerCase().includes(t)));
  const plan = useMemo(() => {
    const m = new Map<string, AgentHealth[]>();
    for (const a of due) m.set(a.hospital, [...(m.get(a.hospital) ?? []), a]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [due]);
  return (
    <Sheet title="PR agent monitor" subtitle={`${formatCount(due.length)} to check up on · ${getBranch(branchId)?.name ?? ''} branch`} onClose={onClose} tall search={view === 'plan' ? undefined : { value: q, onChange: setQ, placeholder: 'Agent, hospital or phone' }}>
      <div className="px-1 pb-4">
        <div className="mb-2.5">
          <Chips
            label="View"
            value={view}
            onChange={(v) => (setView(v), setShown(30))}
            options={[
              { value: 'due', label: 'Check up on', count: due.length },
              { value: 'plan', label: 'Visit plan' },
              { value: 'all', label: 'All', count: list.length },
            ]}
          />
        </div>
        {view !== 'plan' && (
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
            {(['any', ...TILES, 'steady'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`press min-h-8 shrink-0 rounded-full px-3 text-[12.5px] font-semibold ${status === s ? 'bg-ink text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                {s === 'any' ? 'Any status' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        {status !== 'any' && view !== 'plan' && <p className="mb-2 px-1 text-[12.5px] text-muted">{STATUS_HINT[status]}</p>}
        {view === 'plan' ? (
          plan.length ? (
            <div className="space-y-3">
              {plan.map(([h, agents]) => (
                <div key={h} className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
                  <p className="mb-1.5 flex items-center gap-2 text-[14.5px] font-bold text-ink">
                    <MapPinned size={17} className="text-brand-600" /> {h}
                    <span className="ml-auto text-[12px] font-medium text-muted">{agents.length} to see</span>
                  </p>
                  <ul className="divide-y divide-line">
                    {agents.map((a) => (
                      <li key={a.agent.id}>
                        <button type="button" onClick={() => setLog(a)} className="press flex w-full items-center gap-2 py-2.5 text-left">
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-[14px] text-ink">{a.agent.name}</b>
                            <span className="block text-[12px] leading-snug text-muted">{a.action}</span>
                          </span>
                          <ChevronRight size={16} className="shrink-0 text-faint" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-[14px] text-muted">Nobody to check up on. Every slipping or quiet agent has a recent check-up.</p>
          )
        ) : rows.length ? (
          <>
            <ul className="space-y-2.5">
              {rows.slice(0, shown).map((a) => (
                <li key={a.agent.id}>
                  <button type="button" onClick={() => setLog(a)} className="press w-full rounded-[20px] bg-white p-3.5 text-left ring-1 ring-line/70">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <b className="block truncate text-[15px] text-ink">{a.agent.name}</b>
                        <span className="block truncate text-[12.5px] text-muted">
                          {a.hospital}
                          {hasPhone(a.agent.phone) ? ` · ${a.agent.phone}` : ''}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${PILL[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </span>
                    <span className="mt-2 flex items-end justify-between gap-3">
                      <span className="text-[12.5px] text-ink-2">
                        <b className="text-[15px] text-ink">{a.last28}</b> in 4 weeks <span className={a.last28 < a.prev28 ? 'text-[#b42318]' : a.last28 > a.prev28 ? 'text-good-ink' : 'text-muted'}>({a.last28 === a.prev28 ? 'same' : `${a.last28 > a.prev28 ? 'up' : 'down'} from ${a.prev28}`})</span>
                        <span className="block text-[12px] text-muted">Last referral {day(a.lastAt)}</span>
                      </span>
                      <Spark weeks={a.weeks} />
                    </span>
                    <span className="mt-2 block rounded-xl bg-page px-3 py-2 text-[12.5px] leading-snug text-ink-2">{a.action}</span>
                    {a.lastCheck && (
                      <span className="mt-1.5 block text-[12px] text-muted">
                        Last check-up: {a.lastCheck.kind}, {new Date(a.lastCheck.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {a.lastCheck.outcome}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {rows.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + 40)} className="press mt-3 min-h-12 w-full rounded-2xl bg-white text-[14px] font-semibold text-brand-600 ring-1 ring-line">
                Show more ({formatCount(rows.length - shown)} more)
              </button>
            )}
          </>
        ) : (
          <p className="py-10 text-center text-[14px] text-muted">{view === 'due' ? 'Nobody to check up on.' : 'No agent matches.'}</p>
        )}
      </div>
      {log && <CheckUpSheet a={log} branchId={branchId} onClose={() => setLog(null)} />}
    </Sheet>
  );
}

function CheckUpSheet({ a, branchId, onClose }: { a: AgentHealth; branchId: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const history = useCheckUps().filter((c) => c.agentId === a.agent.id && c.branchId === branchId);
  const [kind, setKind] = useState<CheckKind>('Visit');
  const [outcome, setOutcome] = useState<Outcome>('Will send patients');
  const [note, setNote] = useState('');
  const [next, setNext] = useState(isoDate(new Date(Date.now() + 14 * 86_400_000)));
  const save = () => {
    addCheckUp({ agentId: a.agent.id, branchId, by: { name: user.name, role: user.role }, kind, outcome, note: note.trim() || undefined, next: next || undefined });
    logAudit({ category: 'PR agents', action: `Check-up logged: ${kind}`, record: a.agent.name, details: [outcome, note.trim(), next ? `next ${next}` : ''].filter(Boolean).join(' · '), branchId });
    showToast(`Saved. ${a.agent.name} leaves the check-up list until ${next || 'two weeks from now'}.`);
    onClose();
  };
  return (
    <Sheet back title={a.agent.name} subtitle={`${a.hospital} · ${STATUS_LABEL[a.status]}`} onClose={onClose} tall footer={<button type="button" onClick={save} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"><CheckCircle2 size={18} /> Save check-up</button>}>
      <div className="space-y-3.5 px-1 pb-3">
        <p className={`flex items-start gap-2 rounded-2xl px-3.5 py-3 text-[13.5px] ${PILL[a.status]}`}>
          <Siren size={16} className="mt-0.5 shrink-0" /> {a.action}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Last 7 days', a.last7],
            ['Last 4 weeks', a.last28],
            ['4 weeks before', a.prev28],
          ].map(([l, v]) => (
            <span key={l} className="rounded-2xl bg-page px-3 py-2.5">
              <span className="block text-[11.5px] text-muted">{l}</span>
              <b className="block text-[17px] text-ink">{v}</b>
            </span>
          ))}
        </div>
        <div>
          <FieldLabel label="How" required />
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-page p-1">
            {(['Visit', 'Call', 'Message'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${kind === k ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel label="How it went" required />
          <div className="flex flex-wrap gap-1.5">
            {OUTCOMES.map((o) => (
              <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(o)} className={`press min-h-9 rounded-full px-3 text-[12.5px] font-semibold ${outcome === o ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <LongText label="Note" optional value={note} onChange={setNote} max={500} minRows={2} placeholder={'What they said, what they need from the branch.\nPress Enter for a new line.'} />
        <label className="block">
          <FieldLabel label="Next check-up" />
          <input type="date" value={next} min={isoDate(new Date())} onChange={(e) => setNext(e.target.value)} className={inputCls()} />
        </label>
        <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">Earlier check-ups</p>
          {history.length ? (
            <ol className="relative ml-2 border-l-2 border-line pl-4">
              {history.map((c) => (
                <li key={c.id} className="relative pb-3 last:pb-0">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" />
                  <p className="text-[13.5px] font-semibold text-ink">
                    {c.kind} · {c.outcome}
                  </p>
                  <p className="text-[12px] text-muted">
                    {c.by.name}, {c.by.role} · {new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  {c.note && <p className="mt-1 rounded-xl bg-page px-3 py-2 text-[13px] text-ink-2">{c.note}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">No check-up logged yet.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ─────────────── monthly payouts ─────────────── */

export function PayoutsCard({ branchId }: { branchId: string }) {
  const { user } = useCompany();
  const { branchId: myBranch } = useStaffChrome();
  const right = useRight();
  const marks = usePaidMarks();
  const reports = useIssueReports();
  const [open, setOpen] = useState(false);
  const last = lastMonths(2)[1]!;
  const range = useMemo(() => resolveRange({ key: 'custom', from: `${last}-01`, to: isoDate(new Date(Number(last.slice(0, 4)), Number(last.slice(5)), 0)) }), [last]);
  const rows = useMemo(() => agentRanking([branchId], range).filter((a) => a.referrals > 0), [branchId, range]);
  if (!right('referral.commission') || !canMarkPaid(user, myBranch || null, branchId)) return null;
  const paid = rows.filter((a) => paidMark(marks, branchId, last, a.id)).length;
  const issues = reports.filter((r) => r.aboutKind === 'payout' && r.branchId === branchId && r.status !== 'resolved').length;
  return (
    <section className="mt-3">
      <button type="button" onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 rounded-[24px] bg-linear-to-br from-[#f0fbf5] to-[#dff5e9] p-4 text-left ring-1 ring-[#c8efd7]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-good shadow-sm">
          <CalendarCheck size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] text-ink">Monthly payouts</b>
          <span className="block text-[12.5px] text-ink-2">
            {monthLabel(last)}: {paid} of {rows.length} agents marked paid
          </span>
          {issues > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#ffe4e4] px-2 py-0.5 text-[11.5px] font-bold text-[#b42318]">
              <Flag size={11} /> {issues} issue{issues === 1 ? '' : 's'} reported
            </span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-good" />
      </button>
      {open && <PayoutSheet branchId={branchId} onClose={() => setOpen(false)} />}
    </section>
  );
}

function PayoutSheet({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const { user, agents, navigate } = useCompany();
  const { branchId: myBranch } = useStaffChrome();
  const { showToast } = useNav();
  const marks = usePaidMarks();
  const reports = useIssueReports();
  const months = lastMonths(13).slice(1);
  const [month, setMonth] = useState(months[0]!);
  const [picked, setPicked] = useState<number[]>([]);
  const [ref, setRef] = useState('');
  const [q, setQ] = useState('');
  const [undo, setUndo] = useState<{ id: number; name: string } | null>(null);
  const [why, setWhy] = useState('');
  const range = useMemo(() => resolveRange({ key: 'custom', from: `${month}-01`, to: isoDate(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0)) }), [month]);
  const rows = useMemo(() => agentRanking([branchId], range).filter((a) => a.referrals > 0), [branchId, range]);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const c = getBranch(branchId)?.currency ?? 'NGN';
  const unpaid = rows.filter((a) => !paidMark(marks, branchId, month, a.id));
  const issues = reports.filter((r) => r.aboutKind === 'payout' && r.month === month && r.branchId === branchId && r.status !== 'resolved');
  const t = q.trim().toLowerCase();
  const shown = rows.filter((a) => !t || `${a.name} ${a.hospitalKey}`.toLowerCase().includes(t));
  const mark = (ids: number[]) => {
    if (!ids.length) return;
    markPaid(branchId, month, ids, { name: user.name, role: user.role }, ref);
    logAudit({ category: 'Commission', action: `Month marked paid: ${monthLabel(month)}`, record: `${ids.length} PR agent${ids.length === 1 ? '' : 's'}`, details: [ids.map((i) => byId.get(i)?.name ?? i).join(', '), ref.trim() ? `ref ${ref.trim()}` : ''].filter(Boolean).join(' · '), branchId });
    showToast(`${monthLabel(month)} marked paid for ${ids.length} agent${ids.length === 1 ? '' : 's'}. They see Ended ✓.`);
    setPicked([]);
  };
  return (
    <Sheet
      title="Monthly payouts"
      subtitle={`${monthLabel(month)} · ${rows.length - unpaid.length} of ${rows.length} marked paid`}
      onClose={onClose}
      tall
      search={{ value: q, onChange: setQ, placeholder: 'Agent or hospital' }}
      footer={
        <div className="space-y-2">
          <input value={ref} onChange={(e) => setRef(e.target.value.slice(0, 40))} placeholder="Transfer reference (optional)" className={inputCls()} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!picked.length} onClick={() => mark(picked)} className="press min-h-12 rounded-2xl bg-white text-[14px] font-semibold text-ink ring-1 ring-line disabled:opacity-40">
              Mark selected ({picked.length})
            </button>
            <button type="button" disabled={!unpaid.length} onClick={() => mark(unpaid.map((a) => a.id))} className="press min-h-12 rounded-2xl bg-brand-600 text-[14px] font-semibold text-white disabled:opacity-40">
              Mark all paid
            </button>
          </div>
        </div>
      }
    >
      <div className="px-1 pb-4">
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          {months.map((m) => (
            <button key={m} type="button" aria-pressed={month === m} onClick={() => (setMonth(m), setPicked([]))} className={`press min-h-9 shrink-0 rounded-full px-3 text-[12.5px] font-semibold ${month === m ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
        <p className="mb-3 rounded-2xl bg-page px-3.5 py-2.5 text-[12.5px] text-ink-2">
          {formatMoney(
            rows.reduce((s, a) => s + (a.commission[c] ?? 0), 0),
            c,
          )}{' '}
          commission for {monthLabel(month)}. {user.kind === 'admin' ? 'As Company Admin you can mark any branch.' : 'You can mark your own branch.'} Agents see the month as Ended ✓, never the amount.
        </p>
        {issues.length > 0 && (
          <button type="button" onClick={() => navigate(myBranch ? `/branch/${branchId}/reports` : '/reports')} className="press mb-3 flex w-full items-center gap-2 rounded-2xl bg-[#ffe4e4] px-3.5 py-3 text-left text-[13px] font-semibold text-[#b42318]">
            <Flag size={16} /> {issues.length} agent{issues.length === 1 ? ' has' : 's have'} reported an issue with this month. Open Reports
          </button>
        )}
        {shown.length ? (
          <ul className="space-y-2">
            {shown.map((a) => {
              const p = paidMark(marks, branchId, month, a.id);
              const bank = byId.get(a.id)?.bank;
              const issue = issues.find((r) => r.from.agentId === a.id);
              const on = picked.includes(a.id);
              return (
                <li key={a.id} className={`flex items-center gap-3 rounded-[18px] bg-white p-3 ring-1 ${on ? 'ring-2 ring-brand-500' : 'ring-line/70'}`}>
                  {!p ? (
                    <button type="button" role="checkbox" aria-checked={on} aria-label={`Select ${a.name}`} onClick={() => setPicked((x) => (on ? x.filter((i) => i !== a.id) : [...x, a.id]))} className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${on ? 'bg-brand-600 text-white' : 'ring-2 ring-[#cfd8e6]'}`}>
                      {on && <CheckCircle2 size={14} />}
                    </button>
                  ) : (
                    <CheckCircle2 size={22} className="shrink-0 text-good" />
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14px] text-ink">{a.name}</b>
                    <span className="block truncate text-[12px] text-muted">
                      {a.referrals} referrals · {bank ? `${bank.bankName} ${bank.accountNumber}` : 'No bank details'}
                    </span>
                    {issue ? (
                      <span className="mt-0.5 inline-flex rounded-full bg-[#ffe4e4] px-2 py-0.5 text-[11px] font-bold text-[#b42318]">Issue reported</span>
                    ) : p ? (
                      <span className="mt-0.5 block text-[11.5px] text-good-ink">
                        Paid · {p.by.name}, {new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="block text-[14px] text-ink">{formatMoney(a.commission[c] ?? 0, c)}</b>
                    {p && (
                      <button type="button" onClick={() => (setWhy(''), setUndo({ id: a.id, name: a.name }))} className="press mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-muted">
                        <RotateCcw size={12} /> Undo
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-10 text-center text-[14px] text-muted">No referrals that month.</p>
        )}
      </div>
      {undo && (
        <Sheet
          back
          title={`Undo "paid" for ${undo.name}?`}
          subtitle={`${monthLabel(month)} goes back to Not marked`}
          onClose={() => setUndo(null)}
          footer={
            <button
              type="button"
              disabled={why.trim().length < 3}
              onClick={() => {
                unmarkPaid(branchId, month, undo.id);
                logAudit({ category: 'Commission', action: `Paid mark removed: ${monthLabel(month)}`, record: undo.name, details: why.trim(), branchId });
                showToast('Paid mark removed');
                setUndo(null);
              }}
              className="press min-h-12 w-full rounded-2xl bg-[#d93036] text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Undo paid
            </button>
          }
        >
          <div className="px-1 pb-3">
            <LongText label="Why" required value={why} onChange={setWhy} max={300} minRows={2} placeholder="For example: marked by mistake, the transfer failed" />
            {why.trim().length > 0 && why.trim().length < 3 && <FieldErr msg="Say why." />}
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

