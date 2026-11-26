/**
 * Reports on mobile (owner, 2026-11-26): complaints and issues from PR
 * agents and staff, the same reports and rules as the desktop
 * (src/company/services/issueReports): who sees one follows what it is about
 * (a report about the front desk reaches the manager and the admin, never
 * the front desk; one about the manager reaches the admin only). Critical
 * and open reports come first. Tap one for its details and history; whoever
 * may see it can mark it attended, resolve it (saying what was done),
 * reopen it, change its priority or add a note. "New" sends a report.
 *
 * Company Admin: "#/admin/reports". Branch: "#/admin/branch/<id>/reports".
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, CircleDot, Plus, RotateCcw, Send, Siren } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, getBranch } from '@company/data/company';
import { logAudit } from '@company/services/audit';
import { ABOUT, PRIORITY_TEXT, STATUS_TEXT, TO_TEXT, addReport, addReportNote, byAttention, setReportPriority, setReportStatus, useIssueReports, visibleReports, type AboutKind, type IssueReport, type ReportPriority, type ReportStatus } from '@company/services/issueReports';
import { lastMonths, monthLabel } from '@company/services/payoutMonths';
import { useNav } from '@/app/store';
import { SearchField } from '@/ui/kit';
import { Sheet } from './ui';
import { AdminTopBar, EmptyCard, PageGlow, StickyTools } from './kit';
import { Chips, PageTitle } from './branchFirst';
import { LongText } from './fields';
import { FieldErr, FieldLabel, inputCls } from './prManage';
import { useStaffChrome } from '@/staff/chrome';

const STATUS_PILL: Record<ReportStatus, string> = { new: 'bg-[#fff1de] text-[#b45309]', attended: 'bg-[#e8f1ff] text-brand-700', resolved: 'bg-[#e9f9ef] text-good-ink' };
const PRIO_PILL: Record<ReportPriority, string> = { critical: 'bg-[#ffe4e4] text-[#b42318]', high: 'bg-[#fff1de] text-[#b45309]', normal: 'bg-page text-ink-2' };
const STRIP: Record<ReportPriority, string> = { critical: 'bg-[#ef4444]', high: 'bg-[#f59e0b]', normal: 'bg-brand-300' };
const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

function useWho() {
  const { user, context } = useCompany();
  const { branchId } = useStaffChrome();
  const kind: 'admin' | 'manager' | 'staff' = !branchId ? 'admin' : user.role === 'Branch Manager' ? 'manager' : 'staff';
  const scope = branchId ? [branchId] : context === 'all' ? null : [context];
  return { user, kind, branchId: branchId || null, scope };
}

export function ReportsPageMobile() {
  const all = useIssueReports();
  const { kind, branchId, scope } = useWho();
  const mine = useMemo(() => visibleReports(all, { kind, branchId }, scope).sort(byAttention), [all, kind, branchId, scope?.join(',')]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'open' | 'critical' | 'resolved' | 'all'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const t = q.trim().toLowerCase();
  const shown = mine.filter(
    (r) =>
      (tab === 'all' || (tab === 'open' && r.status !== 'resolved') || (tab === 'resolved' && r.status === 'resolved') || (tab === 'critical' && r.priority === 'critical' && r.status !== 'resolved')) &&
      (!t || `${r.id} ${r.subject} ${r.details} ${r.from.name} ${r.about ?? ''} ${r.patientRef ?? ''} ${r.category}`.toLowerCase().includes(t)),
  );
  const open = openId ? (mine.find((r) => r.id === openId) ?? null) : null;
  const count = { open: mine.filter((r) => r.status !== 'resolved').length, critical: mine.filter((r) => r.priority === 'critical' && r.status !== 'resolved').length, resolved: mine.filter((r) => r.status === 'resolved').length };
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle
          title="Reports"
          sub={kind === 'admin' ? 'Complaints and issues from PR agents and staff' : kind === 'manager' ? 'About this branch. Reports about you go to the Company Admin.' : 'What the front desk handles. Reports about the front desk go to the manager.'}
          action={
            <button type="button" onClick={() => setWriting(true)} aria-label="Send a report" className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand-600 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
              <Plus size={18} /> New
            </button>
          }
        />
        <StickyTools>
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search report, person or referral ID" aria-label="Search reports" />
          <div className="mt-2">
            <Chips
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'open', label: 'Open', count: count.open },
                { value: 'critical', label: 'Critical', count: count.critical },
                { value: 'resolved', label: 'Resolved', count: count.resolved },
                { value: 'all', label: 'All', count: mine.length },
              ]}
            />
          </div>
        </StickyTools>
        {shown.length ? (
          <ul className="space-y-2.5">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setOpenId(r.id)} className="press relative flex w-full gap-3 overflow-hidden rounded-[20px] bg-white p-3.5 pl-4 text-left ring-1 ring-line/70">
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${STRIP[r.priority]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <b className="min-w-0 text-[15px] leading-snug text-ink">{r.subject}</b>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_PILL[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                      {r.from.name}, {r.from.role} · {stamp(r.at)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${PRIO_PILL[r.priority]}`}>
                        {r.priority === 'critical' && <Siren size={11} />} {PRIORITY_TEXT[r.priority]}
                      </span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700">{r.category}</span>
                      {r.month && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{monthLabel(r.month)}</span>}
                      {!branchId && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{getBranch(r.branchId)?.name}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyCard sticker="check" text={tab === 'open' ? 'No open reports. Everything has been resolved.' : 'No reports here.'} />
        )}
      </div>
      {open && <ReportSheet r={open} kind={kind} onClose={() => setOpenId(null)} />}
      {writing && <NewReportSheet onClose={() => setWriting(false)} onSent={(id) => (setWriting(false), setOpenId(id))} />}
    </div>
  );
}

function ReportSheet({ r, kind, onClose }: { r: IssueReport; kind: 'admin' | 'manager' | 'staff'; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const canAct = kind === 'admin' || r.seenBy.includes(kind === 'manager' ? 'manager' : 'frontdesk');
  const by = `${user.name}, ${user.role}`;
  const act = (s: ReportStatus) => {
    if (s === 'resolved' && note.trim().length < 5) return setErr('Say what was done to resolve it.');
    setReportStatus(r.id, s, by, note);
    logAudit({ category: 'Reports', action: s === 'attended' ? 'Report attended' : s === 'resolved' ? 'Report resolved' : 'Report reopened', record: `${r.id} · ${r.subject}`, details: [note.trim(), `from ${r.from.name}`].filter(Boolean).join(' · '), branchId: r.branchId });
    showToast(s === 'attended' ? 'Marked attended' : s === 'resolved' ? 'Report resolved' : 'Report reopened');
    setNote('');
    setErr(null);
  };
  return (
    <Sheet
      title={r.subject}
      subtitle={`${r.id} · ${r.category} · ${getBranch(r.branchId)?.name ?? ''} branch`}
      onClose={onClose}
      tall
      footer={
        canAct ? (
          <div className="grid grid-cols-2 gap-2">
            {r.status === 'new' ? (
              <button type="button" onClick={() => act('attended')} className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[14.5px] font-semibold text-ink ring-1 ring-line">
                <CircleDot size={17} /> Attended
              </button>
            ) : r.status === 'resolved' ? (
              <button type="button" onClick={() => act('new')} className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[14.5px] font-semibold text-ink ring-1 ring-line">
                <RotateCcw size={17} /> Reopen
              </button>
            ) : (
              <button type="button" onClick={() => (note.trim().length < 3 ? setErr('Write the note first.') : (addReportNote(r.id, by, note), setNote(''), showToast('Note added')))} className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[14.5px] font-semibold text-ink ring-1 ring-line">
                Add note
              </button>
            )}
            {r.status !== 'resolved' ? (
              <button type="button" onClick={() => act('resolved')} className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white">
                <CheckCircle2 size={17} /> Resolve
              </button>
            ) : (
              <button type="button" onClick={onClose} className="press min-h-12 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white">
                Done
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3 px-1 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['From', `${r.from.name}, ${r.from.role}`],
            ['Received', stamp(r.at)],
            ['Status', STATUS_TEXT[r.status]],
            ['Seen by', r.seenBy.map((x) => TO_TEXT[x]).join(', ')],
            ...(r.patientRef ? [['Referral / patient', r.patientRef]] : []),
            ...(r.about ? [['About', r.about]] : []),
            ...(r.month ? [['Month', monthLabel(r.month)]] : []),
          ].map(([l, v]) => (
            <span key={l} className="rounded-2xl bg-page px-3 py-2.5">
              <span className="block text-[11.5px] text-muted">{l}</span>
              <b className="block text-[13.5px] text-ink">{v}</b>
            </span>
          ))}
        </div>
        <div>
          <FieldLabel label="Priority" />
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-page p-1" role="radiogroup" aria-label="Priority">
            {(['critical', 'high', 'normal'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={r.priority === p}
                disabled={!canAct}
                onClick={() => (setReportPriority(r.id, p, by), showToast(`Priority set to ${PRIORITY_TEXT[p]}`))}
                className={`press min-h-10 rounded-xl text-[13px] font-semibold ${r.priority === p ? (p === 'critical' ? 'bg-[#ef4444] text-white' : 'bg-white text-ink shadow-sm') : 'text-muted'}`}
              >
                {PRIORITY_TEXT[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted">What was reported</p>
          <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">{r.details}</p>
        </div>
        <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">History</p>
          <ol className="relative ml-2 border-l-2 border-line pl-4">
            {r.history.map((h, i) => (
              <li key={i} className="relative pb-3 last:pb-0">
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" />
                <p className="text-[13.5px] font-semibold text-ink">{h.action}</p>
                <p className="text-[12px] text-muted">
                  {h.by} · {stamp(h.at)}
                </p>
                {h.note && <p className="mt-1 rounded-xl bg-page px-3 py-2 text-[13px] text-ink-2">{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>
        {canAct && (
          <div>
            <LongText label={r.status === 'resolved' ? 'Note' : 'What was done (needed to resolve)'} value={note} onChange={(v) => (setNote(v), setErr(null))} max={600} minRows={2} placeholder={'For example: spoke with the receptionist and called the patient.\nPress Enter for a new line.'} />
            <FieldErr msg={err} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function NewReportSheet({ onClose, onSent }: { onClose: () => void; onSent: (id: string) => void }) {
  const { user, kind, branchId } = useWho();
  const { showToast } = useNav();
  const choices = ABOUT.filter((a) => !(kind === 'manager' && a.kind === 'manager'));
  const [branch, setBranch] = useState(branchId ?? ACTIVE_BRANCHES[0]?.id ?? '');
  const [about, setAbout] = useState<AboutKind>(choices[0]!.kind);
  const [priority, setPriority] = useState<ReportPriority>('normal');
  const [month, setMonth] = useState(lastMonths(2)[1]!);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const def = ABOUT.find((a) => a.kind === about)!;
  const errs = { subject: subject.trim().length < 5 ? 'Give the report a short title.' : null, details: details.trim().length < 10 ? 'Describe what happened.' : null };
  const send = () => {
    setTried(true);
    if (errs.subject || errs.details) return;
    const r = addReport({ branchId: branch, from: { kind: 'staff', name: user.name, role: user.role }, to: def.to, aboutKind: about, priority, subject: subject.trim(), details: details.trim(), patientRef: ref.trim().toUpperCase() || undefined, month: about === 'payout' ? month : undefined }, `${user.name}, ${user.role}`);
    logAudit({ category: 'Reports', action: 'Report sent', record: `${r.id} · ${r.subject}`, details: `${r.category} · ${PRIORITY_TEXT[priority]}`, branchId: branch });
    showToast('Report sent');
    onSent(r.id);
  };
  return (
    <Sheet title="Send a report" subtitle="Who sees it depends on what it is about" onClose={onClose} tall footer={<button type="button" onClick={send} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"><Send size={17} /> Send report</button>}>
      <div className="space-y-3.5 px-1 pb-3">
        {!branchId && (
          <div>
            <FieldLabel label="Branch" required />
            <div className="flex flex-wrap gap-2">
              {ACTIVE_BRANCHES.map((b) => (
                <button key={b.id} type="button" aria-pressed={branch === b.id} onClick={() => setBranch(b.id)} className={`press min-h-10 rounded-full px-3.5 text-[13.5px] font-semibold ${branch === b.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                  {b.name} branch
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <FieldLabel label="What is it about?" required />
          <div className="space-y-1.5">
            {choices.map((a) => (
              <button key={a.kind} type="button" role="radio" aria-checked={about === a.kind} onClick={() => setAbout(a.kind)} className={`press flex w-full items-center rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-semibold ${about === a.kind ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-[#f8fafd] text-ink ring-1 ring-[#e3eaf4]'}`}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800">{def.hint}</p>
        </div>
        {about === 'payout' && (
          <label className="block">
            <FieldLabel label="Which month" required />
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls()}>
              {lastMonths(12).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div>
          <FieldLabel label="Priority" required />
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-page p-1" role="radiogroup" aria-label="Priority">
            {(['normal', 'high', 'critical'] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)} className={`press min-h-10 rounded-xl text-[13px] font-semibold ${priority === p ? (p === 'critical' ? 'bg-[#ef4444] text-white' : 'bg-white text-ink shadow-sm') : 'text-muted'}`}>
                {PRIORITY_TEXT[p]}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <FieldLabel label="Title" required />
          <input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 120))} placeholder="For example: Patient waited two hours" className={inputCls(tried ? errs.subject : null)} />
          {tried && <FieldErr msg={errs.subject} />}
        </label>
        <LongText label="What happened" required value={details} onChange={setDetails} max={2000} minRows={3} placeholder={'Who, when and what happened.\nPress Enter for a new line.'} error={tried ? errs.details : null} />
        <label className="block">
          <FieldLabel label="Referral or patient ID" optional />
          <input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase().slice(0, 20))} placeholder="ABJ-R000123" className={`${inputCls()} font-mono`} />
        </label>
      </div>
    </Sheet>
  );
}

