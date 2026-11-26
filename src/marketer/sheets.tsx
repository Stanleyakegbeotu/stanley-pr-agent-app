/**
 * Marketer slide-ups: one PR agent (call, WhatsApp, chat, copy the number,
 * how their patients are doing, follow-up), one hospital, Log (+), and the
 * forms (visit, new PR agent, register a hospital). Search sits in the sheet's
 * header and filters stay pinned at the top while the list scrolls.
 * Follow-ups are the PR monitor's check-ups, so the manager and admin see them.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronRight, Clock3, Compass, Copy, Hospital, MessageCircle, MessagesSquare, Plus, Stethoscope, UserPlus, XCircle } from 'lucide-react';
import { getBranch } from '@company/data/company';
import { hasPhone } from '@company/data/legacy';
import { postText } from '@/domain/chat';
import { copyText } from '@/ui/privacy';
import { approachFor, templatesFor } from './guide';
import { marketerAgentChat } from './chat';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { OUTCOMES, STATUS_HINT, addCheckUp, useCheckUps, type AgentHealth, type CheckKind, type Outcome } from '@company/services/agentMonitor';
import { PARTNER_KINDS, addEntry, possibleDuplicates, registerPartner, type HospitalInfo, type PartnerKind } from '@company/services/marketing';
import { formatCount } from '@company/shared/format';
import { useNav } from '@/app/store';
import { Sheet } from '@/admin/ui';
import { LongText } from '@/admin/fields';
import { FieldErr, FieldLabel, inputCls, nameCase } from '@/admin/prManage';
import { Chips } from '@/admin/branchFirst';
import { AgentAvatar } from '@/admin/agentPhotos';
import { Sticker } from '@/ui/kit';
import { useIncoming } from '@/staff/incoming';
import { daysText, plural, stamp, waLink } from './data';
import { AgentActions, AgentRow, GOOD, NEEDS, StatusPill, useMk } from './ui';

function Spark({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 1);
  return (
    <span className="flex h-9 items-end gap-[2px] overflow-hidden" aria-hidden="true">
      {weeks.map((w, i) => (
        <i key={i} className={`w-[5px] rounded-sm ${i >= 8 ? 'bg-brand-500' : 'bg-brand-200'}`} style={{ height: `${Math.max(3, (w / max) * 34)}px` }} />
      ))}
    </span>
  );
}
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/* ─────────────── one PR agent ─────────────── */

export function AgentSheet({ a, onClose }: { a: AgentHealth; onClose: () => void }) {
  const { m } = useMk();
  const { user } = useCompany();
  const { showToast } = useNav();
  const checkUps = useCheckUps();
  const incoming = useIncoming(m.branchId);
  const [logging, setLogging] = useState(false);
  const [kind, setKind] = useState<CheckKind>('Visit');
  const [outcome, setOutcome] = useState<Outcome>('Will send patients');
  const [note, setNote] = useState('');
  const [next, setNext] = useState(inDays(14));
  const mine = checkUps.filter((c) => c.agentId === a.agent.id && c.branchId === m.branchId);
  const thisWeek = mine.some((c) => Date.now() - new Date(c.at).getTime() < 7 * 86_400_000);
  const trend = a.last28 - a.prev28;
  // How their patients are doing (last 30 days): counts only, never names.
  const since = Date.now() - 30 * 86_400_000;
  const theirs = incoming.filter((r) => r.agentId === a.agent.id && r.sentAt.getTime() >= since);
  // Came: patients who actually attended (billed visits); waiting and didn't come: their referrals.
  const came = a.last28;
  const waiting = theirs.filter((r) => !r.closed && (r.status === 'waiting' || r.status === 'billing' || r.status === 'coming')).length;
  const missed = theirs.filter((r) => r.closed || r.status === 'no_show' || r.status === 'cancelled').length;
  const save = () => {
    addCheckUp({ agentId: a.agent.id, branchId: m.branchId, by: { name: user.name, role: user.role }, kind, outcome, note: note.trim() || undefined, next });
    logAudit({ category: 'PR agents', action: `Follow-up: ${kind}`, record: a.agent.name, details: `${outcome}${note.trim() ? ` · ${note.trim()}` : ''} · by ${user.name}`, branchId: m.branchId });
    showToast('Follow-up saved');
    onClose();
  };
  return (
    <Sheet
      back
      tall
      title={a.agent.name}
      subtitle={`${a.hospital} · PR agent #${a.agent.id}`}
      onClose={onClose}
      footer={
        <button type="button" onClick={logging ? save : () => setLogging(true)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
          {logging ? <CalendarCheck size={18} /> : <Plus size={18} />} {logging ? 'Save follow-up' : 'Log a follow-up'}
        </button>
      }
    >
      <div className="mb-3 overflow-hidden rounded-[24px] bg-linear-to-br from-[#eef4ff] via-[#e3edff] to-[#d3e3ff] p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full ring-[3px] ring-white">
            <AgentAvatar id={a.agent.id} name={a.agent.name} phone={a.agent.phone} size={58} />
          </span>
          <span className="min-w-0 flex-1">
            <StatusPill s={a.status} />
            <span className="mt-1 block text-[13px] leading-snug text-ink-2">{STATUS_HINT[a.status]}</span>
          </span>
        </div>
        <div className="mt-3">
          <AgentActions a={a} big />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-2.5 text-center ring-1 ring-line/70">
          <p className="text-[11px] text-muted">Last referral</p>
          <p className="text-[15px] font-bold text-ink">{a.daysSince === null ? 'None' : a.daysSince === 0 ? 'Today' : `${a.daysSince}d ago`}</p>
        </div>
        <div className="rounded-2xl bg-white p-2.5 text-center ring-1 ring-line/70">
          <p className="text-[11px] text-muted">Last 4 weeks</p>
          <p className="text-[15px] font-bold text-ink">
            {formatCount(a.last28)} {trend !== 0 && <span className={`text-[11.5px] ${trend < 0 ? 'text-[#b42318]' : 'text-good-ink'}`}>{`${trend > 0 ? '+' : ''}${trend}`}</span>}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-2.5 ring-1 ring-line/70">
          <p className="text-center text-[11px] text-muted">12 weeks</p>
          <div className="mt-0.5 flex justify-center">
            <Spark weeks={a.weeks} />
          </div>
        </div>
      </div>

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Their patients · last 4 weeks</p>
      <div className="mb-2 grid grid-cols-3 gap-2">
        {[
          { l: 'Came', v: came, i: <CheckCircle2 size={18} />, c: 'bg-tint-green text-good-ink' },
          { l: 'Waiting', v: waiting, i: <Clock3 size={18} />, c: 'bg-tint-blue text-brand-700' },
          { l: "Didn't come", v: missed, i: <XCircle size={18} />, c: 'bg-[#fdecec] text-[#b42318]' },
        ].map((x) => (
          <div key={x.l} className={`rounded-2xl p-2.5 ${x.c}`}>
            {x.i}
            <b className="mt-1 block text-[20px] leading-none">{formatCount(x.v)}</b>
            <span className="text-[11.5px] font-semibold">{x.l}</span>
          </div>
        ))}
      </div>
      <p className="mb-3 px-1 text-[11.5px] text-muted">Counts only. Patient names, what this agent generated and commission are never shown to marketers.</p>

      <Approach a={a} />
      <Composer a={a} />

      {logging && (
        <div className="mb-3 space-y-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          {thisWeek && <p className="rounded-xl bg-[#fff6ec] px-3 py-2 text-[12.5px] font-medium text-[#8a4b00]">Already followed up this week. You can still add one.</p>}
          <div>
            <FieldLabel label="How" />
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-page p-1">
              {(['Visit', 'Call', 'Message'] as CheckKind[]).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`press min-h-10 rounded-xl text-[14px] font-semibold ${kind === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-2'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel label="How it went" />
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(o)} className={`press min-h-9 rounded-xl px-3 text-[13px] font-semibold ${outcome === o ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
          <LongText label="Note" optional value={note} onChange={setNote} max={300} minRows={2} placeholder="What they said, what you agreed" />
          <div>
            <FieldLabel label="Next follow-up" />
            <div className="flex flex-wrap gap-1.5">
              {[7, 14, 30].map((n) => (
                <button key={n} type="button" onClick={() => setNext(inDays(n))} className={`press min-h-9 rounded-xl px-3 text-[13px] font-semibold ${next === inDays(n) ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                  In {n} days
                </button>
              ))}
              <input type="date" value={next} min={inDays(0)} onChange={(e) => setNext(e.target.value)} className="min-h-9 rounded-xl border border-line px-2 text-[13px]" aria-label="Next follow-up date" />
            </div>
          </div>
        </div>
      )}

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Follow-ups</p>
      {mine.length ? (
        <ol className="mb-3 ml-2 border-l-2 border-line pl-4">
          {mine.slice(0, 12).map((c) => (
            <li key={c.id} className="relative pb-3">
              <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
              <p className="text-[13.5px] font-semibold text-ink">
                {c.kind} · {c.outcome}
              </p>
              {c.note && <p className="text-[13px] text-ink-2">{c.note}</p>}
              <p className="text-[11.5px] text-muted">
                {stamp(c.at)} · {c.by.name === user.name ? 'you' : c.by.name}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-3 rounded-[20px] bg-white px-4 py-3 text-[13px] text-muted ring-1 ring-line/70">No follow-ups yet.</p>
      )}
    </Sheet>
  );
}

/** How to approach this agent, written from how they have been referring. */
function Approach({ a }: { a: AgentHealth }) {
  const g = approachFor(a);
  return (
    <div className="mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#fff8ec] to-[#ffeccc] p-4 ring-1 ring-[#fde2b3]">
      <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#a85a00]">
        <Compass size={15} /> How to approach them
      </p>
      <p className="mt-1 text-[16px] font-bold leading-snug text-ink">{g.headline}</p>
      <ol className="mt-2 space-y-1.5">
        {g.steps.map((t, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-[#a85a00]">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A ready message to edit and send: WhatsApp, the in-app chat, or copy. */
function Composer({ a }: { a: AgentHealth }) {
  const { m, me, chat } = useMk();
  const { showToast } = useNav();
  const branch = getBranch(m.branchId)?.name ?? '';
  const templates = useMemo(() => templatesFor(a, me.name, branch), [a, me.name, branch]);
  const [pick, setPick] = useState(templates[0]!.id);
  const [text, setText] = useState(templates[0]!.text);
  const phone = hasPhone(a.agent.phone) ? a.agent.phone : null;
  return (
    <div className="mb-3 rounded-[22px] bg-white p-3.5 ring-1 ring-line/70">
      <p className="mb-2 text-[13px] font-semibold text-ink-2">Send a message</p>
      <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {templates.map((t) => (
          <button key={t.id} type="button" aria-pressed={pick === t.id} onClick={() => (setPick(t.id), setText(t.text))} className={`press min-h-9 shrink-0 rounded-full px-3 text-[12.5px] font-semibold ${pick === t.id ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <LongText value={text} onChange={setText} max={600} minRows={4} maxRows={9} />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <a href={phone ? `${waLink(phone)}?text=${encodeURIComponent(text)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!phone} className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#e7f8ee] text-[13px] font-semibold text-[#128c4b] ${phone ? '' : 'pointer-events-none opacity-40'}`}>
          <MessageCircle size={16} /> WhatsApp
        </a>
        <button
          type="button"
          disabled={text.trim().length < 2}
          onClick={async () => {
            await postText(marketerAgentChat(me.id, a.agent.id), text.trim());
            showToast('Sent in the app');
            chat(a.agent.id);
          }}
          className="press flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#f1edff] text-[13px] font-semibold text-violet disabled:opacity-40"
        >
          <MessagesSquare size={16} /> In app
        </button>
        <button type="button" onClick={() => copyText(text, 'Message', showToast)} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-page text-[13px] font-semibold text-ink-2">
          <Copy size={15} /> Copy
        </button>
      </div>
    </div>
  );
}

/* ─────────────── follow up: hospitals, then the agents there ─────────────── */

export function FollowHospitalsSheet({ onClose }: { onClose: () => void }) {
  const { m } = useMk();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const need = (k: string) => m.myHealth.filter((a) => a.hospital === k && (a.due || NEEDS.includes(a.status)));
  const rows = m.mine
    .map((h) => ({ h, n: need(h.key).length, quiet: m.myHealth.filter((a) => a.hospital === h.key && a.status === 'quiet').length }))
    .filter((r) => !q.trim() || r.h.key.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.n - a.n || a.h.key.localeCompare(b.h.key));
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <Sheet back tall title="Follow up" subtitle={`${plural(total, 'PR agent')} across your hospitals`} onClose={onClose} search={{ value: q, onChange: setQ, placeholder: 'Find a hospital' }}>
      <div className="mb-3 flex items-center gap-3 rounded-[22px] bg-linear-to-br from-[#eef4ff] to-[#dbe8ff] p-3.5">
        <Sticker name="stethoscope" size={40} />
        <p className="text-[13px] leading-snug text-ink-2">Pick a hospital to see the agents to call, message or visit, with how to approach each one.</p>
      </div>
      <div className="space-y-2">
        {rows.map(({ h, n, quiet }) => (
          <button key={h.key} type="button" onClick={() => setOpen(h.key)} className="press flex w-full items-center gap-3 rounded-[20px] bg-white p-3 text-left ring-1 ring-line/70">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Hospital size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] text-ink">{h.key}</b>
              <span className="block text-[12px] text-muted">
                {plural(h.agentIds.length, 'agent')}
                {quiet ? ` · ${quiet} gone quiet` : ''}
              </span>
            </span>
            <span className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-[14px] font-bold ${n ? 'bg-[#fff1de] text-[#b45309]' : 'bg-tint-green text-good-ink'}`}>{n}</span>
            <ChevronRight size={16} className="text-faint" />
          </button>
        ))}
      </div>
      {open && <FollowAgentsSheet hospital={open} onClose={() => setOpen(null)} />}
    </Sheet>
  );
}

function FollowAgentsSheet({ hospital, onClose }: { hospital: string; onClose: () => void }) {
  const { m, openAgent } = useMk();
  const [q, setQ] = useState('');
  const list = m.myHealth.filter((a) => a.hospital === hospital && (a.due || NEEDS.includes(a.status)) && (!q.trim() || a.agent.name.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <Sheet back tall title={hospital} subtitle={`${plural(list.length, 'agent')} to follow up`} onClose={onClose} search={{ value: q, onChange: setQ, placeholder: 'Find a PR agent' }}>
      {list.length ? (
        <div className="space-y-2">
          {list.map((a) => {
            const g = approachFor(a);
            return (
              <button key={a.agent.id} type="button" onClick={() => openAgent(a)} className="press w-full rounded-[20px] bg-white p-3 text-left ring-1 ring-line/70">
                <span className="flex items-center gap-3">
                  <AgentAvatar id={a.agent.id} name={a.agent.name} phone={a.agent.phone} size={44} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px] text-ink">{a.agent.name}</b>
                    <span className="block text-[12px] text-muted">
                      {daysText(a.daysSince)} · {a.last28} in 4 wks ({a.prev28} before)
                    </span>
                  </span>
                  <StatusPill s={a.status} />
                </span>
                <span className="mt-2 flex items-start gap-2 rounded-xl bg-[#fff8ec] px-3 py-2 text-[12.5px] text-[#8a4b00]">
                  <Compass size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <b>{g.headline}.</b> {a.lastCheck ? `Last follow-up ${stamp(a.lastCheck.at)}: ${a.lastCheck.outcome}.` : 'Not followed up yet.'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[20px] bg-white p-4 text-center text-[13.5px] text-muted ring-1 ring-line/70">{m.healthReady ? 'Nobody here needs a follow-up right now.' : 'Working out the agents…'}</p>
      )}
    </Sheet>
  );
}

/* ─────────────── one hospital ─────────────── */

type AF = 'need' | 'good' | 'never' | 'all';
const inAF = (a: AgentHealth, f: AF) => (f === 'all' ? true : f === 'need' ? NEEDS.includes(a.status) : f === 'good' ? GOOD.includes(a.status) : a.status === 'never');

export function HospitalSheet({ h, onClose }: { h: HospitalInfo; onClose: () => void }) {
  const { m } = useMk();
  const [filter, setFilter] = useState<AF>('need');
  const [q, setQ] = useState('');
  const [visit, setVisit] = useState(false);
  const [recruit, setRecruit] = useState(false);
  const [shown, setShown] = useState(40);
  const here = m.myHealth.filter((a) => a.hospital === h.key);
  const t = q.trim().toLowerCase();
  const list = here.filter((a) => inAF(a, t ? 'all' : filter) && (!t || a.agent.name.toLowerCase().includes(t)));
  const f = m.figs.get(h.key);
  const lf = m.lastFigs.get(h.key);
  const entries = m.st.entries.filter((e) => e.branchId === m.branchId && e.hospital === h.key).slice(0, 4);
  return (
    <Sheet back tall title={h.key} subtitle={`${plural(h.agentIds.length, 'PR agent')} · yours`} onClose={onClose} search={{ value: q, onChange: setQ, placeholder: `Find a PR agent at ${h.key}` }}>
      {!t && (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-linear-to-br from-[#eef4ff] to-[#dbe8ff] p-3">
              <p className="text-[11.5px] font-semibold text-ink-2">Amount generated</p>
              <p className="text-[21px] font-extrabold text-brand-800">{m.money(f?.revenue ?? 0)}</p>
              <p className="text-[11.5px] text-muted">{m.money(lf?.revenue ?? 0)} last month</p>
            </div>
            <div className="rounded-[18px] bg-linear-to-br from-[#f3efff] to-[#e5dcff] p-3">
              <p className="text-[11.5px] font-semibold text-ink-2">Patients attended</p>
              <p className="text-[21px] font-extrabold text-violet">{formatCount(f?.patients ?? 0)}</p>
              <p className="text-[11.5px] text-muted">{formatCount(lf?.patients ?? 0)} last month</p>
            </div>
          </div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setVisit(true)} className="press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-brand-700 ring-1 ring-brand-200">
              <Hospital size={16} /> Log a visit
            </button>
            <button type="button" onClick={() => setRecruit(true)} className="press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-brand-700 ring-1 ring-brand-200">
              <UserPlus size={16} /> New PR agent
            </button>
          </div>
        </>
      )}
      {/* Filters stay pinned while the agents scroll. */}
      <div className="sticky top-0 z-10 -mx-3 bg-white/95 px-3 pb-2 pt-1 backdrop-blur">
        <Chips
          value={filter}
          onChange={(v) => (setFilter(v), setShown(40))}
          label="Agents"
          options={[
            { value: 'need', label: 'Need you', count: here.filter((a) => inAF(a, 'need')).length },
            { value: 'good', label: 'Doing well', count: here.filter((a) => inAF(a, 'good')).length },
            { value: 'never', label: 'No referrals', count: here.filter((a) => inAF(a, 'never')).length },
            { value: 'all', label: 'All', count: here.length },
          ]}
        />
      </div>
      <div className="rounded-[20px] bg-white p-1 ring-1 ring-line/70">
        {list.length ? list.slice(0, shown).map((a) => <AgentRow key={a.agent.id} a={a} sub={daysText(a.daysSince)} />) : <p className="px-3 py-4 text-center text-[13px] text-muted">{here.length ? 'No PR agent in this list.' : 'Working out the agents…'}</p>}
      </div>
      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + 40)} className="press mx-auto mt-2 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({list.length - shown})
        </button>
      )}
      {!t && entries.length > 0 && (
        <>
          <p className="mb-2 mt-4 px-1 text-[13px] font-semibold text-ink-2">Recent entries here</p>
          <div className="mb-3 space-y-1.5">
            {entries.map((e) => (
              <div key={e.id} className="rounded-2xl bg-white px-3 py-2 ring-1 ring-line/70">
                <p className="text-[13.5px] text-ink">{e.text}</p>
                <p className="text-[11.5px] text-muted">
                  {stamp(e.at)} · {e.by}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
      {visit && <VisitSheet hospital={h.key} onClose={() => setVisit(false)} />}
      {recruit && <RecruitSheet hospital={h.key} onClose={() => setRecruit(false)} />}
    </Sheet>
  );
}

/* ─────────────── Log (+) ─────────────── */

export function LogSheet({ onClose }: { onClose: () => void }) {
  const { m, openRegister } = useMk();
  const [step, setStep] = useState<'menu' | 'agent' | 'visit' | 'recruit'>('menu');
  const [q, setQ] = useState('');
  const [hosp, setHosp] = useState('all');
  const [hospital, setHospital] = useState<string | null>(null);
  const t = q.trim().toLowerCase();
  const due = m.myHealth.filter((a) => a.due);
  const agents = m.myHealth.filter((a) => (hosp === 'all' || a.hospital === hosp) && (t ? `${a.agent.name} ${a.hospital}`.toLowerCase().includes(t) : a.due || NEEDS.includes(a.status))).slice(0, 60);
  const back = () => (setStep('menu'), setHospital(null), setQ(''));
  const options = [
    { k: 'agent' as const, sticker: 'stethoscope' as const, tint: 'from-[#eef4ff] to-[#dbe8ff]', title: 'Follow up a PR agent', sub: due.length ? `${due.length} need you now` : 'Visit, call or message' },
    { k: 'visit' as const, sticker: 'hospital' as const, tint: 'from-[#e9f9ef] to-[#cfeedd]', title: 'Hospital visit', sub: 'Who you met, what came of it' },
    { k: 'recruit' as const, sticker: 'womanHealthWorker' as const, tint: 'from-[#f3efff] to-[#e5dcff]', title: 'New PR agent', sub: 'Someone you brought in' },
    { k: 'register' as const, sticker: 'clipboard' as const, tint: 'from-[#fff6ec] to-[#ffe7cc]', title: 'New hospital', sub: 'Register a new partner' },
  ];
  return (
    <Sheet
      back={step !== 'menu'}
      tall={step !== 'menu'}
      title={step === 'menu' ? 'Log something' : step === 'agent' ? 'Follow up a PR agent' : step === 'visit' ? 'Which hospital?' : 'Where is the new PR agent?'}
      subtitle={step === 'menu' ? 'Everything you log shows to your manager' : undefined}
      onClose={step === 'menu' ? onClose : back}
      search={step === 'agent' ? { value: q, onChange: setQ, placeholder: 'Find any of your PR agents' } : undefined}
    >
      {step === 'menu' && (
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {options.map((o) => (
            <button key={o.k} type="button" onClick={() => (o.k === 'register' ? (onClose(), openRegister()) : setStep(o.k))} className={`press flex min-h-[132px] flex-col items-start rounded-[22px] bg-linear-to-br p-3.5 text-left ${o.tint}`}>
              <Sticker name={o.sticker} size={42} />
              <b className="mt-auto block text-[15px] leading-tight text-ink">{o.title}</b>
              <span className="text-[12px] text-ink-2">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
      {step === 'agent' && (
        <>
          <div className="sticky top-0 z-10 -mx-3 bg-white/95 px-3 pb-2 pt-1 backdrop-blur">
            <Chips value={hosp} onChange={setHosp} label="Hospital" options={[{ value: 'all', label: 'All hospitals' }, ...m.mine.map((h) => ({ value: h.key, label: h.key }))]} />
            {!t && <p className="mt-1.5 px-1 text-[12px] text-muted">Agents who need you now. Search to find anyone.</p>}
          </div>
          <div className="rounded-[20px] bg-white p-1 ring-1 ring-line/70">{agents.length ? agents.map((a) => <AgentRow key={a.agent.id} a={a} />) : <p className="px-3 py-4 text-center text-[13px] text-muted">{m.healthReady ? 'No PR agent found.' : 'Working out the agents…'}</p>}</div>
        </>
      )}
      {(step === 'visit' || step === 'recruit') && !hospital && (
        <div className="space-y-1.5 pb-2">
          {m.mine.map((h) => (
            <button key={h.key} type="button" onClick={() => setHospital(h.key)} className="press flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left ring-1 ring-line/70">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Hospital size={18} />
              </span>
              <b className="flex-1 text-[15px] text-ink">{h.key}</b>
              <span className="text-[12.5px] text-muted">{plural(h.agentIds.length, 'agent')}</span>
            </button>
          ))}
        </div>
      )}
      {step === 'visit' && hospital && <VisitSheet hospital={hospital} onClose={onClose} />}
      {step === 'recruit' && hospital && <RecruitSheet hospital={hospital} onClose={onClose} />}
    </Sheet>
  );
}

/* ─────────────── forms ─────────────── */

export function VisitSheet({ hospital, onClose }: { hospital: string; onClose: () => void }) {
  const { m, me } = useMk();
  const { showToast } = useNav();
  const [text, setText] = useState('');
  return (
    <Sheet
      back
      title={`Visit to ${hospital}`}
      subtitle="Who you met and what came of it"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={text.trim().length < 3}
          onClick={() => {
            addEntry({ branchId: m.branchId, marketerId: me.id, by: me.name, kind: 'visit', hospital, text });
            logAudit({ category: 'PR agents', action: 'Hospital visit', record: hospital, details: `${text.trim()} · by ${me.name}`, branchId: m.branchId });
            showToast('Visit saved');
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          <Stethoscope size={17} /> Save visit
        </button>
      }
    >
      <div className="px-1 pb-2">
        <LongText label="What happened" required value={text} onChange={setText} max={600} placeholder="For example: met the lab unit head, left price lists at the nurses' station, two new doctors to follow up" />
      </div>
    </Sheet>
  );
}

export function RecruitSheet({ hospital, onClose }: { hospital: string; onClose: () => void }) {
  const { m, me } = useMk();
  const { addAgent, agents } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tried, setTried] = useState(false);
  const digits = phone.replace(/\D/g, '');
  const same = useMemo(() => {
    const n = name.trim().toLowerCase().replace(/^(dr|nrs|mr|mrs|ms)\.?\s+/, '');
    return n.length >= 3 ? agents.filter((a) => a.name.toLowerCase().includes(n) || (digits.length >= 7 && a.phone.replace(/\D/g, '').endsWith(digits.slice(-7)))).slice(0, 3) : [];
  }, [name, digits, agents]);
  const bad = { name: name.trim().length < 3 ? 'Enter their full name' : '', phone: digits.length < 10 ? 'Enter their phone number' : '' };
  return (
    <Sheet
      back
      title="New PR agent"
      subtitle={`At ${hospital} · they stay with you`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (bad.name || bad.phone) return;
            const a = addAgent({ name: name.trim(), phone: phone.trim(), hospital });
            addEntry({ branchId: m.branchId, marketerId: me.id, by: me.name, kind: 'recruit', hospital, agentId: a.id, text: `${a.name} joined at ${hospital}` });
            logAudit({ category: 'PR agents', action: 'PR agent recruited', record: `${a.name} (#${a.id})`, details: `${hospital} · by ${me.name}`, branchId: m.branchId });
            showToast(`${a.name} added. Their first patient counts for you.`);
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          <UserPlus size={18} /> Add PR agent
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <label className="block">
          <FieldLabel label="Full name" required />
          <input value={name} onChange={(e) => setName(nameCase(e.target.value))} placeholder="Dr Amaka Okeke" className={inputCls(tried ? bad.name : null)} />
          <FieldErr msg={tried ? bad.name : ''} />
        </label>
        <label className="block">
          <FieldLabel label="Phone" required />
          <input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))} placeholder="0803 123 4567" className={inputCls(tried ? bad.phone : null)} />
          <FieldErr msg={tried ? bad.phone : ''} />
        </label>
        {same.length > 0 && (
          <div className="rounded-2xl bg-[#fff6ec] p-3 text-[13px] text-[#8a4b00]">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={15} /> Already a PR agent?
            </p>
            {same.map((a) => (
              <p key={a.id}>
                {a.name} · {a.hospital || 'no hospital'} · #{a.id}
              </p>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function RegisterSheet({ onClose }: { onClose: () => void }) {
  const { m, me } = useMk();
  const { showToast } = useNav();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [kind, setKind] = useState<PartnerKind>('Hospital');
  const [area, setArea] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  // Codes already in use: partner hospitals and hospitals registered but not declined.
  const taken = useMemo(() => new Set([...m.hospitals.map((h) => h.key), ...m.st.partners.filter((p) => p.branchId === m.branchId && p.status !== 'declined').map((p) => p.code)]), [m.hospitals, m.st.partners, m.branchId]);
  const auto = useMemo(() => uniqueCode(name, taken), [name, taken]);
  const finalCode = (codeTouched ? code : auto).trim().toUpperCase();
  const dupes = useMemo(() => (name.trim().length >= 3 ? possibleDuplicates(m.st, m.branchId, name, '', m.hospitals.map((h) => h.key)) : []), [m.st, m.branchId, name, m.hospitals]);
  const bad = { name: name.trim().length < 3 ? 'Enter the name' : '', code: finalCode.length < 2 ? 'Give a short code' : taken.has(finalCode) ? `${finalCode} is already used by another hospital` : '' };
  return (
    <Sheet
      back
      tall
      title="Register a hospital"
      subtitle="A new partner you have brought in"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (bad.name || bad.code) return;
            const p = registerPartner({ branchId: m.branchId, name, code: finalCode, kind, area: area.trim(), contactName: contactName.trim(), contactPhone: contactPhone.trim(), note: note.trim(), marketerId: me.id, by: me.name });
            logAudit({ category: 'PR agents', action: 'New hospital registered', record: `${p.name} (${p.code})`, details: `${p.kind} · by ${me.name}; waiting for the manager`, branchId: m.branchId });
            showToast(`${p.name} sent to your manager`);
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          <Hospital size={18} /> Register
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <label className="block">
          <FieldLabel label="Name" required />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Garki General Hospital" className={inputCls(tried ? bad.name : null)} />
          <FieldErr msg={tried ? bad.name : ''} />
        </label>
        {dupes.length > 0 && (
          <div className="rounded-2xl bg-[#fff6ec] p-3 text-[13px] text-[#8a4b00]">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={15} /> Is it one of these?
            </p>
            <p>{dupes.join(' · ')}</p>
            <p className="mt-1 text-[12px]">If it is, it's already a partner: no need to register it again.</p>
          </div>
        )}
        <div>
          <FieldLabel label="Short code" />
          {codeTouched ? (
            <>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="GGH" className={inputCls(bad.code || null)} autoFocus />
              <FieldErr msg={bad.code} />
              <button type="button" onClick={() => (setCodeTouched(false), setCode(''))} className="mt-1 text-[12.5px] font-semibold text-brand-600">
                Use the automatic code ({auto || '…'})
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-page px-3.5 py-2.5 ring-1 ring-line">
              <b className="min-w-0 flex-1 truncate text-[18px] tracking-[0.06em] text-ink">{auto || '—'}</b>
              <span className="rounded-full bg-tint-green px-2 py-0.5 text-[11.5px] font-bold text-good-ink">{auto ? 'Auto · unique' : 'Type the name'}</span>
              {auto && (
                <button type="button" onClick={() => (setCodeTouched(true), setCode(auto))} className="text-[12.5px] font-semibold text-brand-600">
                  Change
                </button>
              )}
            </div>
          )}
          <span className="mt-1 block text-[12px] text-muted">Made from the name and checked against every hospital's code, so it never clashes. Used on PR agent records, like FMC or UATH.</span>
        </div>
        <div>
          <FieldLabel label="Type" />
          <div className="flex flex-wrap gap-1.5">
            {PARTNER_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`press min-h-9 rounded-xl px-3 text-[13px] font-semibold ${kind === k ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <FieldLabel label="Area" optional />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Garki, Abuja" className={inputCls()} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <FieldLabel label="Contact person" optional />
            <input value={contactName} onChange={(e) => setContactName(nameCase(e.target.value))} placeholder="Name" className={inputCls()} />
          </label>
          <label className="block">
            <FieldLabel label="Their phone" optional />
            <input value={contactPhone} inputMode="tel" onChange={(e) => setContactPhone(e.target.value.replace(/[^\d+ ]/g, ''))} placeholder="0803 …" className={inputCls()} />
          </label>
        </div>
        <LongText label="Note" optional value={note} onChange={setNote} max={400} minRows={2} placeholder="What they need, tests they send out, who decides" />
      </div>
    </Sheet>
  );
}

/** A short code from the name's initials that no other hospital uses (GGH, then GGHO, then GGH2 …). */
export function uniqueCode(name: string, taken: Set<string>): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !/^(OF|THE|AND|&)$/.test(w));
  if (!words.length) return '';
  let base = words.map((w) => w[0]).join('').slice(0, 5);
  if (base.length < 2) base = words[0]!.slice(0, 4);
  const tries = [base];
  // Add letters from the first word, then numbers.
  for (const ch of words[0]!.slice(1, 4)) tries.push(`${base}${ch}`);
  for (let n = 2; n < 100; n++) tries.push(`${base}${n}`);
  return tries.find((c) => c.length >= 2 && !taken.has(c)) ?? `${base}${Date.now() % 1000}`;
}
