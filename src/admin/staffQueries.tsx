/**
 * Mobile staff profile cards (owner, 2026-11-26), same records as the desktop
 * (src/company/services/staffQueries and accountAccess):
 * - Queries: issue a query, record the response and the outcome, full history.
 * - Account: deactivate or reactivate a front desk or PR agent account, with a reason.
 * Branch Manager and Company Admin only.
 */
import { useState } from 'react';
import { CheckCircle2, ChevronRight, FileWarning, Plus, Power, PowerOff, RotateCcw, Send } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { setAccountOff, useAccountAccess } from '@company/services/accountAccess';
import { QUERY_OUTCOMES, QUERY_REASONS, STAGE_TEXT, closeQuery, issueQuery, queriesOf, recordResponse, reopenQuery, stageOf, useStaffQueries, type QueryOutcome, type QueryStage, type StaffQuery } from '@company/services/staffQueries';
import { useNav } from '@/app/store';
import { Sheet } from './ui';
import { LongText } from './fields';
import { FieldErr, FieldLabel, inputCls } from './prManage';

const today = () => new Date().toISOString().slice(0, 10);
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const stamp = (iso: string) => `${day(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
const STAGE_PILL: Record<QueryStage, string> = { awaiting: 'bg-[#fff1de] text-[#b45309]', responded: 'bg-brand-50 text-brand-700', closed: 'bg-page text-ink-2' };
const OUTCOME_PILL: Record<QueryOutcome, string> = { Cleared: 'bg-[#e6f8ee] text-good-ink', 'Verbal warning': 'bg-[#fff1de] text-[#b45309]', 'Written warning': 'bg-[#fff1de] text-[#b45309]', 'Final warning': 'bg-[#ffe4e4] text-[#b42318]', Suspended: 'bg-[#ffe4e4] text-[#b42318]', Dismissed: 'bg-[#ffe4e4] text-[#b42318]' };

function Pill({ q }: { q: StaffQuery }) {
  const stage = stageOf(q);
  const overdue = stage === 'awaiting' && q.replyBy && q.replyBy < today();
  if (q.outcome) return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${OUTCOME_PILL[q.outcome.value]}`}>{q.outcome.value}</span>;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${overdue ? 'bg-[#ffe4e4] text-[#b42318]' : STAGE_PILL[stage]}`}>{overdue ? 'Reply overdue' : STAGE_TEXT[stage]}</span>;
}

/* ─────────────── Queries ─────────────── */

export function QueriesCard({ staffId, staffName, branchId }: { staffId: string; staffName: string; branchId: string }) {
  const list = queriesOf(useStaffQueries(), staffId);
  const [issuing, setIssuing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? list.find((q) => q.id === openId) : undefined;
  const openCount = list.filter((q) => !q.outcome).length;
  return (
    <>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[13px] font-semibold text-ink-2">
          Queries {list.length > 0 && <span className="text-muted">· {list.length} on record{openCount ? `, ${openCount} open` : ''}</span>}
        </p>
        <button type="button" onClick={() => setIssuing(true)} className="press flex min-h-9 items-center gap-1 rounded-full bg-brand-50 px-3 text-[12.5px] font-semibold text-brand-700">
          <Plus size={14} /> Issue a query
        </button>
      </div>
      <div className="mb-3 rounded-[20px] bg-white p-2 ring-1 ring-line/70">
        {list.length ? (
          list.map((q) => (
            <button key={q.id} type="button" onClick={() => setOpenId(q.id)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff1de] text-[#b45309]">
                <FileWarning size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{q.reason}</span>
                <span className="block truncate text-[12px] text-muted">
                  {day(q.issuedOn)} · {q.issuedBy}
                </span>
              </span>
              <Pill q={q} />
              <ChevronRight size={16} className="shrink-0 text-faint" />
            </button>
          ))
        ) : (
          <p className="px-2 py-2 text-[13px] text-muted">No queries on record. When one is issued, record the date, reason, their response and the outcome here.</p>
        )}
      </div>
      {issuing && <IssueQuerySheet staffId={staffId} staffName={staffName} branchId={branchId} onClose={() => setIssuing(false)} onIssued={(id) => (setIssuing(false), setOpenId(id))} />}
      {open && <QuerySheet q={open} staffName={staffName} onClose={() => setOpenId(null)} />}
    </>
  );
}

function QuerySheet({ q, staffName, onClose }: { q: StaffQuery; staffName: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const [reply, setReply] = useState(q.response?.text ?? '');
  const [replyOn, setReplyOn] = useState(q.response?.on ?? today());
  const [editingReply, setEditingReply] = useState(!q.response);
  const [outcome, setOutcome] = useState<QueryOutcome>('Cleared');
  const [note, setNote] = useState('');
  const [why, setWhy] = useState('');
  const [reopening, setReopening] = useState(false);
  return (
    <Sheet back tall title={q.reason} subtitle={`${staffName} · ${q.id}`} onClose={onClose}>
      <div className="mb-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] text-muted">
            Issued <b className="text-ink">{day(q.issuedOn)}</b> by {q.issuedBy}
          </p>
          <Pill q={q} />
        </div>
        {q.replyBy && <p className="mt-1 text-[12.5px] text-muted">Reply asked for by {day(q.replyBy)}</p>}
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{q.details || q.reason}</p>
      </div>

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Their response</p>
      <div className="mb-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
        {q.response && !editingReply ? (
          <>
            <p className="whitespace-pre-wrap border-l-[3px] border-brand-400 pl-3 text-[14px] text-ink">{q.response.text}</p>
            <p className="mt-2 text-[12px] text-muted">
              Received {day(q.response.on)} · recorded by {q.response.recordedBy}
              {!q.outcome && (
                <button type="button" onClick={() => setEditingReply(true)} className="ml-2 font-semibold text-brand-600">
                  Edit
                </button>
              )}
            </p>
          </>
        ) : q.outcome ? (
          <p className="text-[13px] text-muted">No response was recorded.</p>
        ) : (
          <div className="space-y-3">
            <LongText label="What they said" value={reply} onChange={setReply} max={1500} placeholder="Their reply, in their words where possible" />
            <label className="block">
              <FieldLabel label="Received on" />
              <input type="date" value={replyOn} min={q.issuedOn} max={today()} onChange={(e) => setReplyOn(e.target.value)} className={inputCls()} />
            </label>
            <button
              type="button"
              disabled={reply.trim().length < 3}
              onClick={() => {
                recordResponse(q.id, reply, replyOn, user.name);
                logAudit({ category: 'Staff', action: 'Query response recorded', record: q.id, details: q.reason, branchId: q.branchId });
                setEditingReply(false);
                showToast('Response recorded');
              }}
              className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-50 text-[14.5px] font-semibold text-brand-700 disabled:opacity-40"
            >
              <Send size={16} /> Save response
            </button>
          </div>
        )}
      </div>

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Outcome</p>
      <div className="mb-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
        {q.outcome ? (
          <>
            <span className={`inline-block rounded-full px-2.5 py-1 text-[12.5px] font-bold ${OUTCOME_PILL[q.outcome.value]}`}>{q.outcome.value}</span>
            {q.outcome.note && <p className="mt-2 text-[14px] text-ink">{q.outcome.note}</p>}
            <p className="mt-2 text-[12px] text-muted">
              Decided {day(q.outcome.on)} by {q.outcome.by}
              {!reopening && (
                <button type="button" onClick={() => setReopening(true)} className="ml-2 font-semibold text-brand-600">
                  Reopen
                </button>
              )}
            </p>
            {reopening && (
              <div className="mt-3 space-y-2">
                <input value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} placeholder="Why reopen it (needed)" className={inputCls()} />
                <button
                  type="button"
                  disabled={why.trim().length < 3}
                  onClick={() => {
                    reopenQuery(q.id, user.name, why);
                    logAudit({ category: 'Staff', action: 'Query reopened', record: q.id, details: why.trim(), branchId: q.branchId });
                    setReopening(false);
                    setWhy('');
                  }}
                  className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-50 text-[14.5px] font-semibold text-brand-700 disabled:opacity-40"
                >
                  <RotateCcw size={16} /> Reopen
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Outcome">
              {QUERY_OUTCOMES.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value} onClick={() => setOutcome(o.value)} className={`press rounded-2xl p-2.5 text-left ring-1 ${outcome === o.value ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-line'}`}>
                  <span className={`block text-[13.5px] font-semibold ${outcome === o.value ? 'text-brand-700' : 'text-ink'}`}>{o.value}</span>
                  <span className="block text-[11.5px] leading-snug text-muted">{o.hint}</span>
                </button>
              ))}
            </div>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={outcome === 'Cleared' ? 'Note (optional)' : 'What was decided and why (needed)'} className={inputCls()} />
            <button
              type="button"
              disabled={outcome !== 'Cleared' && note.trim().length < 3}
              onClick={() => {
                closeQuery(q.id, outcome, note, user.name);
                logAudit({ category: 'Staff', action: `Query closed: ${outcome}`, record: q.id, details: `${q.reason}${note.trim() ? ` · ${note.trim()}` : ''}`, branchId: q.branchId });
                showToast(`Query closed: ${outcome}`);
                setNote('');
              }}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              <CheckCircle2 size={17} /> Close the query
            </button>
          </div>
        )}
      </div>

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">History</p>
      <History steps={[...q.history].reverse().map((h) => ({ title: h.action, note: h.note, when: `${stamp(h.at)} · ${h.by}` }))} />
    </Sheet>
  );
}

function History({ steps }: { steps: { title: string; note?: string; when: string }[] }) {
  return (
    <ol className="mb-3 ml-2 border-l-2 border-line pl-4">
      {steps.map((s, i) => (
        <li key={i} className="relative pb-3">
          <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
          <p className="text-[13.5px] font-semibold text-ink">{s.title}</p>
          {s.note && <p className="text-[13px] text-ink-2">{s.note}</p>}
          <p className="text-[11.5px] text-muted">{s.when}</p>
        </li>
      ))}
    </ol>
  );
}

function IssueQuerySheet({ staffId, staffName, branchId, onClose, onIssued }: { staffId: string; staffName: string; branchId: string; onClose: () => void; onIssued: (id: string) => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const [on, setOn] = useState(today());
  const [reason, setReason] = useState<string>(QUERY_REASONS[0]);
  const [other, setOther] = useState('');
  const [details, setDetails] = useState('');
  const [replyBy, setReplyBy] = useState('');
  const [tried, setTried] = useState(false);
  const why = reason === 'Other' ? other.trim() : reason;
  const bad = { why: !why ? 'Say what the query is about' : '', details: details.trim().length < 5 ? 'Describe what happened' : '' };
  return (
    <Sheet
      back
      tall
      title="Issue a query"
      subtitle={staffName}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (bad.why || bad.details) return;
            const q = issueQuery({ staffId, branchId, issuedOn: on, issuedBy: user.name, reason: why, details, replyBy: replyBy || undefined });
            logAudit({ category: 'Staff', action: 'Query issued', record: `${staffName} · ${q.id}`, details: why, branchId });
            showToast(`Query issued to ${staffName}`);
            onIssued(q.id);
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          <FileWarning size={18} /> Issue query
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <FieldLabel label="Date issued" />
            <input type="date" value={on} max={today()} onChange={(e) => setOn(e.target.value)} className={inputCls()} />
          </label>
          <label className="block">
            <FieldLabel label="Reply by" optional />
            <input type="date" value={replyBy} min={on} onChange={(e) => setReplyBy(e.target.value)} className={inputCls()} />
          </label>
        </div>
        <div>
          <FieldLabel label="Reason" required />
          <div className="flex flex-wrap gap-2">
            {QUERY_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`press min-h-10 rounded-xl px-3 text-[13.5px] font-semibold ${reason === r ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {reason === 'Other' && (
          <label className="block">
            <FieldLabel label="What it is about" required />
            <input value={other} maxLength={80} onChange={(e) => setOther(e.target.value)} placeholder="A short reason" className={inputCls(tried ? bad.why : null)} />
            <FieldErr msg={tried ? bad.why : ''} />
          </label>
        )}
        <LongText label="What happened" required value={details} onChange={setDetails} max={1500} error={tried ? bad.details || null : null} placeholder="Dates, what was seen or reported, anything already said" />
      </div>
    </Sheet>
  );
}

/* ─────────────── Account access ─────────────── */

export function AccountCard({ accountKey, name, what, branchId }: { accountKey: string; name: string; what: string; branchId: string | null }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const access = useAccountAccess()[accountKey];
  const off = !!access?.off;
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState('');
  return (
    <>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Account</p>
      <div className={`mb-3 rounded-[20px] p-3.5 ring-1 ${off ? 'bg-[#fff6f6] ring-[#f6caca]' : 'bg-white ring-line/70'}`}>
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${off ? 'bg-[#ffe4e4] text-[#b42318]' : 'bg-[#e6f8ee] text-good-ink'}`}>{off ? <PowerOff size={18} /> : <Power size={18} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink">{off ? 'Deactivated' : 'Active'}</span>
            <span className="block text-[12.5px] leading-snug text-muted">{off ? `${name} can't sign in. Their record and history are kept.` : `${name} can sign in as ${what}.`}</span>
          </span>
        </div>
        <button type="button" onClick={() => (setWhy(''), setAsking(true))} className={`press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14.5px] font-semibold ${off ? 'bg-brand-600 text-white' : 'bg-[#fdecec] text-[#b42318]'}`}>
          {off ? <Power size={16} /> : <PowerOff size={16} />} {off ? 'Reactivate account' : 'Deactivate account'}
        </button>
        {access?.history.length ? (
          <div className="mt-3">
            <History steps={access.history.map((h) => ({ title: h.action, note: h.reason, when: `${stamp(h.at)} · ${h.by}` }))} />
          </div>
        ) : null}
      </div>
      {asking && (
        <Sheet
          back
          title={off ? `Reactivate ${name}?` : `Deactivate ${name}?`}
          subtitle={off ? 'They can sign in again' : "Nothing is deleted. You can turn it back on."}
          onClose={() => setAsking(false)}
          footer={
            <button
              type="button"
              disabled={why.trim().length < 3}
              onClick={() => {
                setAccountOff(accountKey, !off, user.name, why);
                logAudit({ category: accountKey.startsWith('agent:') ? 'PR agents' : 'Staff', action: off ? 'Account reactivated' : 'Account deactivated', record: name, details: why.trim(), branchId });
                showToast(off ? `${name}'s account is active again` : `${name}'s account is deactivated`);
                setAsking(false);
              }}
              className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white disabled:opacity-40 ${off ? 'bg-brand-600' : 'bg-[#d93036]'}`}
            >
              {off ? 'Reactivate' : 'Deactivate'}
            </button>
          }
        >
          <div className="px-1 pb-2">
            <LongText label="Why" required value={why} onChange={setWhy} max={300} placeholder={off ? 'For example: back from suspension' : 'For example: left the company, suspended pending a query'} hint="Recorded on the profile and in the Audit Log." />
          </div>
        </Sheet>
      )}
    </>
  );
}
