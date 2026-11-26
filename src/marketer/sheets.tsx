/**
 * Marketer sheets: one PR agent (follow-up), one hospital (agents, visit,
 * recruit), and registering a new partner hospital. Every entry carries its
 * author; follow-ups are the PR monitor's check-ups, so the manager and the
 * admin see them in PR Management.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, Hospital, MessageCircle, Phone, Plus, Search, UserPlus } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { OUTCOMES, STATUS_HINT, STATUS_LABEL, addCheckUp, useCheckUps, type AgentHealth, type AgentStatus, type CheckKind, type Outcome } from '@company/services/agentMonitor';
import { PARTNER_KINDS, addEntry, possibleDuplicates, registerPartner, type HospitalInfo, type PartnerKind } from '@company/services/marketing';
import { formatCount, formatMoney } from '@company/shared/format';
import { hasPhone } from '@company/data/legacy';
import { useNav } from '@/app/store';
import { Sheet } from '@/admin/ui';
import { LongText } from '@/admin/fields';
import { FieldErr, FieldLabel, inputCls, nameCase } from '@/admin/prManage';
import { ago, initials, stamp, type Mine } from './data';

export const STATUS_TONE: Record<AgentStatus, string> = {
  top: 'bg-[#e6f8ee] text-good-ink',
  rising: 'bg-[#e6f8ee] text-good-ink',
  steady: 'bg-brand-50 text-brand-700',
  slipping: 'bg-[#fff1de] text-[#b45309]',
  quiet: 'bg-[#ffe4e4] text-[#b42318]',
  inactive: 'bg-page text-ink-2',
  never: 'bg-page text-muted',
};
export const NEEDS: AgentStatus[] = ['slipping', 'quiet', 'inactive'];

export function StatusPill({ s }: { s: AgentStatus }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>;
}

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

export function AgentSheet({ a, branchId, onClose }: { a: AgentHealth; branchId: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const checkUps = useCheckUps();
  const [kind, setKind] = useState<CheckKind>('Visit');
  const [outcome, setOutcome] = useState<Outcome>('Will send patients');
  const [note, setNote] = useState('');
  const [next, setNext] = useState(inDays(14));
  const [logging, setLogging] = useState(NEEDS.includes(a.status));
  const mine = checkUps.filter((c) => c.agentId === a.agent.id && c.branchId === branchId);
  const thisWeek = mine.some((c) => Date.now() - new Date(c.at).getTime() < 7 * 86_400_000);
  const phone = hasPhone(a.agent.phone) ? a.agent.phone.replace(/\s+/g, '') : null;
  const trend = a.last28 - a.prev28;
  return (
    <Sheet
      back
      tall
      title={a.agent.name}
      subtitle={`${a.hospital} · PR agent #${a.agent.id}`}
      onClose={onClose}
      footer={
        logging ? (
          <button
            type="button"
            onClick={() => {
              addCheckUp({ agentId: a.agent.id, branchId, by: { name: user.name, role: user.role }, kind, outcome, note: note.trim() || undefined, next });
              logAudit({ category: 'PR agents', action: `Follow-up: ${kind}`, record: a.agent.name, details: `${outcome}${note.trim() ? ` · ${note.trim()}` : ''} · by ${user.name}`, branchId });
              showToast('Follow-up saved');
              onClose();
            }}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
          >
            <CalendarCheck size={18} /> Save follow-up
          </button>
        ) : (
          <button type="button" onClick={() => setLogging(true)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            <Plus size={18} /> Log a follow-up
          </button>
        )
      }
    >
      <div className="mb-3 rounded-[22px] bg-linear-to-br from-[#eef4ff] to-[#dbe8ff] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-[17px] font-extrabold text-brand-700 ring-[3px] ring-white">{initials(a.agent.name)}</span>
          <span className="min-w-0 flex-1">
            <StatusPill s={a.status} />
            <span className="mt-1 block text-[13px] leading-snug text-ink-2">{STATUS_HINT[a.status]}</span>
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/80 p-2">
            <p className="text-[11px] font-medium text-muted">Last referral</p>
            <p className="text-[14px] font-bold text-ink">{a.daysSince === null ? 'None yet' : a.daysSince === 0 ? 'Today' : `${a.daysSince}d ago`}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-2">
            <p className="text-[11px] font-medium text-muted">Last 4 weeks</p>
            <p className="text-[14px] font-bold text-ink">
              {formatCount(a.last28)} <span className={`text-[11.5px] ${trend < 0 ? 'text-[#b42318]' : trend > 0 ? 'text-good-ink' : 'text-muted'}`}>{trend === 0 ? '' : `${trend > 0 ? '+' : ''}${trend}`}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-2">
            <p className="text-[11px] font-medium text-muted">12 weeks</p>
            <div className="mt-0.5 flex justify-center">
              <Spark weeks={a.weeks} />
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone} className={`press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-brand-700 ${phone ? '' : 'pointer-events-none opacity-40'}`}>
            <Phone size={16} /> Call
          </a>
          <a href={phone ? `https://wa.me/${phone.replace(/^0/, '234').replace(/\D/g, '')}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!phone} className={`press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-[#128c4b] ${phone ? '' : 'pointer-events-none opacity-40'}`}>
            <MessageCircle size={16} /> WhatsApp
          </a>
        </div>
      </div>
      <p className="mb-3 px-1 text-[12px] text-muted">Referral counts only. What a single PR agent generated, commission and patient details are never shown here.</p>

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
                {stamp(c.at)} · {c.by.name}
                {c.by.name === user.name ? ' (you)' : ''}
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

/* ─────────────── one hospital ─────────────── */

type AgentFilter = 'all' | 'need' | 'good' | 'never';

export function HospitalSheet({ h, m, branchId, onClose, onAgent }: { h: HospitalInfo; m: Mine; branchId: string; onClose: () => void; onAgent: (a: AgentHealth) => void }) {
  const { figs, lastFigs, myHealth, currency, st } = m;
  const [filter, setFilter] = useState<AgentFilter>('need');
  const [q, setQ] = useState('');
  const [visit, setVisit] = useState(false);
  const [recruit, setRecruit] = useState(false);
  const here = myHealth.filter((a) => a.hospital === h.key);
  const t = q.trim().toLowerCase();
  const shown = here.filter((a) => (filter === 'all' || (filter === 'need' ? NEEDS.includes(a.status) : filter === 'good' ? ['top', 'rising', 'steady'].includes(a.status) : a.status === 'never')) && (!t || a.agent.name.toLowerCase().includes(t)));
  const f = figs.get(h.key);
  const lf = lastFigs.get(h.key);
  const count = (fl: AgentFilter) => here.filter((a) => (fl === 'all' ? true : fl === 'need' ? NEEDS.includes(a.status) : fl === 'good' ? ['top', 'rising', 'steady'].includes(a.status) : a.status === 'never')).length;
  const visits = st.entries.filter((e) => e.branchId === branchId && e.hospital === h.key).slice(0, 5);
  return (
    <Sheet back tall title={h.key} subtitle={`${formatCount(h.agentIds.length)} PR agent${h.agentIds.length === 1 ? '' : 's'} · yours`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] font-medium text-muted">Patients this month</p>
          <p className="text-[20px] font-extrabold text-ink">{formatCount(f?.patients ?? 0)}</p>
          <p className="text-[11.5px] text-muted">{formatCount(lf?.patients ?? 0)} last month</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] font-medium text-muted">Amount generated</p>
          <p className="text-[20px] font-extrabold text-ink">{formatMoney(f?.revenue ?? 0, currency, true)}</p>
          <p className="text-[11.5px] text-muted">{formatMoney(lf?.revenue ?? 0, currency, true)} last month</p>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setVisit(true)} className="press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-brand-50 text-[14px] font-semibold text-brand-700">
          <Hospital size={16} /> Log a visit
        </button>
        <button type="button" onClick={() => setRecruit(true)} className="press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-brand-50 text-[14px] font-semibold text-brand-700">
          <UserPlus size={16} /> New PR agent
        </button>
      </div>

      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {(
          [
            ['need', 'Need you'],
            ['good', 'Doing well'],
            ['never', 'No referrals yet'],
            ['all', 'All'],
          ] as [AgentFilter, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`press min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold ${filter === k ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
            {label} {count(k)}
          </button>
        ))}
      </div>
      {here.length > 8 && (
        <label className="mb-2 flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-line">
          <Search size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a PR agent" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
        </label>
      )}
      <div className="mb-3 rounded-[20px] bg-white p-1.5 ring-1 ring-line/70">
        {shown.length ? (
          shown.slice(0, 60).map((a) => (
            <button key={a.agent.id} type="button" onClick={() => onAgent(a)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-page text-[12px] font-bold text-ink-2">{initials(a.agent.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{a.agent.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  {a.daysSince === null ? 'No referral yet' : `Last referral ${a.daysSince === 0 ? 'today' : a.daysSince === 1 ? 'yesterday' : `${a.daysSince} days ago`}`}
                  {a.lastCheck ? ` · followed up ${ago(a.lastCheck.at)}` : ''}
                </span>
              </span>
              <StatusPill s={a.status} />
            </button>
          ))
        ) : (
          <p className="px-3 py-3 text-[13px] text-muted">{here.length ? 'No PR agent in this list.' : 'Working out the agents…'}</p>
        )}
      </div>

      {visits.length > 0 && (
        <>
          <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Recent entries here</p>
          <div className="mb-3 space-y-1.5">
            {visits.map((e) => (
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
      {visit && <VisitSheet branchId={branchId} hospital={h.key} onClose={() => setVisit(false)} />}
      {recruit && <RecruitSheet branchId={branchId} hospital={h.key} onClose={() => setRecruit(false)} />}
    </Sheet>
  );
}

export function VisitSheet({ branchId, hospital, onClose }: { branchId: string; hospital: string; onClose: () => void }) {
  const { user } = useCompany();
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
            addEntry({ branchId, marketerId: user.staffId ?? '', by: user.name, kind: 'visit', hospital, text });
            logAudit({ category: 'PR agents', action: 'Hospital visit', record: hospital, details: `${text.trim()} · by ${user.name}`, branchId });
            showToast('Visit saved');
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Save visit
        </button>
      }
    >
      <div className="px-1 pb-2">
        <LongText label="What happened" required value={text} onChange={setText} max={600} placeholder="For example: met the lab unit head, left price lists at the nurses' station, two new doctors to follow up" />
      </div>
    </Sheet>
  );
}

export function RecruitSheet({ branchId, hospital, onClose }: { branchId: string; hospital: string; onClose: () => void }) {
  const { user, addAgent, agents } = useCompany();
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
            addEntry({ branchId, marketerId: user.staffId ?? '', by: user.name, kind: 'recruit', hospital, agentId: a.id, text: `${a.name} joined at ${hospital}` });
            logAudit({ category: 'PR agents', action: 'PR agent recruited', record: `${a.name} (#${a.id})`, details: `${hospital} · by ${user.name}`, branchId });
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

/* ─────────────── report centre: a new partner hospital ─────────────── */

export function RegisterSheet({ m, branchId, onClose }: { m: Mine; branchId: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const { st, hospitals } = m;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [kind, setKind] = useState<PartnerKind>('Hospital');
  const [area, setArea] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const auto = name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(of|the|and)$/i.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 6);
  const finalCode = (codeTouched ? code : auto).trim().toUpperCase();
  const dupes = useMemo(() => (name.trim().length >= 3 ? possibleDuplicates(st, branchId, name, finalCode, hospitals.map((h) => h.key)) : []), [st, branchId, name, finalCode, hospitals]);
  const bad = { name: name.trim().length < 3 ? 'Enter the name' : '', code: finalCode.length < 2 ? 'Give a short code' : hospitals.some((h) => h.key === finalCode) ? `${finalCode} is already a partner` : '' };
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
            const p = registerPartner({ branchId, name, code: finalCode, kind, area: area.trim(), contactName: contactName.trim(), contactPhone: contactPhone.trim(), note: note.trim(), marketerId: user.staffId ?? '', by: user.name });
            logAudit({ category: 'PR agents', action: 'New hospital registered', record: `${p.name} (${p.code})`, details: `${p.kind} · by ${user.name}; waiting for the manager`, branchId });
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
        <label className="block">
          <FieldLabel label="Short code" required />
          <input value={codeTouched ? code : auto} onChange={(e) => (setCodeTouched(true), setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 12)))} placeholder="GGH" className={inputCls(tried ? bad.code : null)} />
          <FieldErr msg={tried ? bad.code : ''} />
          <span className="mt-1 block text-[12px] text-muted">Used on PR agent records, like FMC or UATH.</span>
        </label>
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
