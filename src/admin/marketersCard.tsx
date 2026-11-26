/**
 * Marketers on the mobile PR page (owner, 2026-11-26), for the Branch Manager
 * and the Company Admin: each marketer's month against their target, who
 * looks after each hospital (fair split to confirm), new hospitals waiting
 * for a decision, and each marketer's work and six months. Same records as
 * the desktop (services/marketing).
 */
import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Hospital, Megaphone, Scale, Target, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { ENTRY_TEXT, applyMoves, decidePartner, monthName, paceWord, progressFor, setHospitalOwner, setTarget, shiftMonth, suggestSplit, type HospitalInfo, type Progress } from '@company/services/marketing';
import { formatCount, formatMoney } from '@company/shared/format';
import type { StaffRecord } from '@company/data/userRecords';
import { useNav } from '@/app/store';
import { useBranchMarketing, initials, stamp } from '@/marketer/data';
import { Sheet } from './ui';
import { inputCls } from './prManage';
import { useRight } from './access';

type Data = ReturnType<typeof useBranchMarketing>;
const TONE = { ok: 'bg-[#e6f8ee] text-good-ink', warn: 'bg-[#fff1de] text-[#b45309]', danger: 'bg-[#ffe4e4] text-[#b42318]', brand: 'bg-brand-50 text-brand-700' } as const;

function Bar({ p }: { p: Progress }) {
  return (
    <span className="relative mt-1.5 block h-2 rounded-full bg-page">
      <i className={`block h-full rounded-full ${p.pct >= 1 ? 'bg-[#22a06b]' : p.pct >= p.pace ? 'bg-[#22a06b]' : p.pct >= p.pace * 0.8 ? 'bg-[#f2a93b]' : 'bg-[#ef4444]'}`} style={{ width: `${Math.min(100, p.pct * 100)}%` }} />
      {p.pace < 1 && <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink/40" style={{ left: `${p.pace * 100}%` }} />}
    </span>
  );
}

export function MarketersCard({ branchId }: { branchId: string }) {
  const right = useRight();
  const d = useBranchMarketing(branchId);
  const [viewing, setViewing] = useState<string | null>(null);
  const [owners, setOwners] = useState(false);
  const [split, setSplit] = useState<null | 'fill' | 'even'>(null);
  if (!right('referral.manage') || !d.marketers.length) return null;
  const unowned = d.hospitals.filter((h) => !h.owner);
  const waiting = d.st.partners.filter((p) => p.branchId === branchId && p.status === 'proposed');
  const totals = d.progress.reduce((s, p) => ({ patients: s.patients + p.patients, target: s.target + p.target }), { patients: 0, target: 0 });
  return (
    <section className="mt-4 rounded-[24px] bg-white p-4 ring-1 ring-line/70">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-[#7c5cff] to-[#4f46e5] text-white">
          <Megaphone size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] text-ink">Marketers</b>
          <span className="block text-[12.5px] text-muted">
            {formatCount(totals.patients)} of {formatCount(totals.target)} patients targeted · {monthName(d.ym)}
          </span>
        </span>
      </div>
      <div className="mt-3 space-y-1">
        {[...d.progress]
          .sort((a, b) => b.pct - a.pct)
          .map((p) => {
            const m = d.marketers.find((x) => x.id === p.marketerId)!;
            const pw = paceWord(p);
            return (
              <button key={p.marketerId} type="button" onClick={() => setViewing(p.marketerId)} className="press flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-700">{initials(m.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate text-[14.5px] text-ink">{m.name}</b>
                    <span className="shrink-0 text-[13px] font-bold text-ink">
                      {formatCount(p.patients)}
                      <span className="font-medium text-muted">/{formatCount(p.target)}</span>
                    </span>
                  </span>
                  <Bar p={p} />
                  <span className="mt-1 flex items-center justify-between text-[11.5px] text-muted">
                    <span>
                      {formatCount(p.hospitals.length)} hospitals · {formatCount(p.followUps)} follow-ups
                    </span>
                    <span className={`rounded-full px-1.5 font-bold ${TONE[pw.tone]}`}>{pw.text}</span>
                  </span>
                </span>
              </button>
            );
          })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOwners(true)} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-page text-[13.5px] font-semibold text-ink-2 ring-1 ring-line">
          <Hospital size={15} /> Hospitals
        </button>
        <button type="button" onClick={() => setSplit(unowned.length ? 'fill' : 'even')} className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-2xl text-[13.5px] font-semibold ${unowned.length ? 'bg-[#fff1de] text-[#b45309]' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
          <Scale size={15} /> {unowned.length ? `${unowned.length} need a marketer` : 'Even out the split'}
        </button>
      </div>
      {waiting.length > 0 && <Waiting branchId={branchId} d={d} />}
      {viewing && <MarketerSheet branchId={branchId} d={d} marketerId={viewing} onClose={() => setViewing(null)} />}
      {owners && <OwnersSheet branchId={branchId} d={d} onClose={() => setOwners(false)} />}
      {split && <SplitSheet branchId={branchId} d={d} mode={split} onClose={() => setSplit(null)} />}
    </section>
  );
}

function Waiting({ branchId, d }: { branchId: string; d: Data }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const list = d.st.partners.filter((p) => p.branchId === branchId && p.status === 'proposed');
  return (
    <div className="mt-3 rounded-2xl bg-[#fff8ef] p-3 ring-1 ring-[#ffe0b8]">
      <p className="mb-2 text-[13px] font-bold text-[#8a4b00]">New hospitals waiting for you</p>
      {list.map((p) => (
        <div key={p.id} className="mb-2 rounded-xl bg-white p-2.5 last:mb-0">
          <p className="text-[14px] font-bold text-ink">
            {p.name} <span className="text-[12px] font-semibold text-muted">{p.code}</span>
          </p>
          <p className="text-[12px] text-muted">
            {p.kind}
            {p.area ? ` · ${p.area}` : ''} · by {p.by}, {stamp(p.at)}
          </p>
          {p.note && <p className="mt-0.5 text-[12.5px] text-ink-2">{p.note}</p>}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                decidePartner(p.id, 'declined', user.name, '');
                logAudit({ category: 'PR agents', action: 'New hospital not taken on', record: `${p.name} (${p.code})`, details: `Registered by ${p.by}`, branchId });
                showToast(`${p.name} not taken on`);
              }}
              className="press flex min-h-10 items-center justify-center gap-1 rounded-xl bg-page text-[13px] font-semibold text-ink-2"
            >
              <X size={14} /> Decline
            </button>
            <button
              type="button"
              onClick={() => {
                decidePartner(p.id, 'partnered', user.name, '');
                logAudit({ category: 'PR agents', action: 'New partner hospital', record: `${p.name} (${p.code})`, details: `Registered by ${p.by}; now theirs`, branchId });
                showToast(`${p.name} is a partner, looked after by ${p.by}`);
              }}
              className="press flex min-h-10 items-center justify-center gap-1 rounded-xl bg-brand-600 text-[13px] font-semibold text-white"
            >
              <Check size={14} /> Take on
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketerSheet({ branchId, d, marketerId, onClose }: { branchId: string; d: Data; marketerId: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const m = d.marketers.find((x) => x.id === marketerId)!;
  const p = d.progress.find((x) => x.marketerId === marketerId)!;
  const [target, setT] = useState(String(p.target));
  const history = useMemo(() => [-5, -4, -3, -2, -1, 0].map((n) => progressFor(d.st, branchId, marketerId, d.hospitals, d.agents, d.checkUps, shiftMonth(d.ym, n))), [d, branchId, marketerId]);
  const max = Math.max(...history.map((h) => Math.max(h.patients, h.target)), 1);
  const myAgents = new Set(d.hospitals.filter((h) => h.owner?.marketerId === marketerId).flatMap((h) => h.agentIds));
  const work = [
    ...d.st.entries.filter((e) => e.branchId === branchId && e.marketerId === marketerId).map((e) => ({ at: e.at, title: e.hospital ? `${ENTRY_TEXT[e.kind]} · ${e.hospital}` : ENTRY_TEXT[e.kind], text: e.text })),
    ...d.checkUps.filter((c) => c.branchId === branchId && myAgents.has(c.agentId) && c.by.name === m.name).map((c) => ({ at: c.at, title: `${c.kind} with ${d.agents.find((a) => a.id === c.agentId)?.name ?? `agent #${c.agentId}`}`, text: c.outcome })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);
  const pw = paceWord(p);
  return (
    <Sheet back tall title={m.name} subtitle={`Marketer · ${formatCount(p.hospitals.length)} hospitals, ${formatCount(p.agents)} PR agents`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] text-muted">Patients against target</p>
          <p className="text-[20px] font-extrabold text-ink">
            {formatCount(p.patients)}
            <span className="text-[14px] text-muted">/{formatCount(p.target)}</span>
          </p>
          <span className={`rounded-full px-1.5 text-[11.5px] font-bold ${TONE[pw.tone]}`}>{pw.text}</span>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] text-muted">Their hospitals generated</p>
          <p className="text-[20px] font-extrabold text-ink">{formatMoney(p.revenue, d.currency, true)}</p>
          <p className="text-[11.5px] text-muted">Usual month {formatCount(p.baseline)} patients</p>
        </div>
      </div>
      <div className="mb-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
        <p className="mb-2 text-[13px] font-semibold text-ink-2">Six months</p>
        <div className="grid h-28 grid-cols-6 items-end gap-2">
          {history.map((h) => (
            <div key={h.month} className="flex h-full flex-col items-center justify-end gap-1">
              <span className="flex h-full w-full items-end justify-center gap-[3px]">
                <i className="w-2.5 rounded-t bg-page ring-1 ring-line" style={{ height: `${(h.target / max) * 100}%` }} />
                <i className={`w-2.5 rounded-t ${h.patients >= h.target ? 'bg-[#22a06b]' : 'bg-brand-500'}`} style={{ height: `${(h.patients / max) * 100}%` }} />
              </span>
              <span className="text-[10.5px] font-semibold text-muted">{monthName(h.month).split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
        <p className="mb-2 text-[13px] font-semibold text-ink-2">Target for {monthName(d.ym, true)}</p>
        <div className="flex gap-2">
          <input inputMode="numeric" value={target} onChange={(e) => setT(e.target.value.replace(/\D/g, ''))} className={inputCls()} aria-label="Target patients" />
          <button
            type="button"
            disabled={!Number(target) || Number(target) === p.target}
            onClick={() => {
              setTarget(branchId, marketerId, d.ym, Number(target), user.name);
              logAudit({ category: 'PR agents', action: 'Marketer target set', record: `${m.name} · ${monthName(d.ym, true)}`, details: `${target} patients (usual month ${p.baseline})`, branchId });
              showToast(`Target set: ${target} patients`);
            }}
            className="press flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-brand-600 px-4 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            <Target size={16} /> Set
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-muted">{p.targetSetBy ? `Set by ${p.targetSetBy}.` : 'Suggested from their usual month plus 10%.'}</p>
      </div>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Their hospitals</p>
      <div className="mb-3 rounded-[20px] bg-white p-1.5 ring-1 ring-line/70">
        {p.hospitals.map((k) => (
          <div key={k} className="flex items-center justify-between gap-2 px-2.5 py-2">
            <b className="text-[14px] text-ink">{k}</b>
            <span className="text-[12.5px] text-muted">
              {formatCount(d.figs.get(k)?.patients ?? 0)} patients · {formatMoney(d.figs.get(k)?.revenue ?? 0, d.currency, true)}
            </span>
          </div>
        ))}
      </div>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Latest work</p>
      {work.length ? (
        <div className="mb-3 space-y-1.5">
          {work.map((w, i) => (
            <div key={i} className="rounded-2xl bg-white px-3 py-2 ring-1 ring-line/70">
              <p className="text-[13.5px] font-semibold text-ink">{w.title}</p>
              {w.text && <p className="text-[12.5px] text-ink-2">{w.text}</p>}
              <p className="text-[11px] text-muted">{stamp(w.at)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 rounded-[20px] bg-white px-4 py-3 text-[13px] text-muted ring-1 ring-line/70">Nothing logged yet.</p>
      )}
    </Sheet>
  );
}

function OwnersSheet({ branchId, d, onClose }: { branchId: string; d: Data; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [moving, setMoving] = useState<HospitalInfo | null>(null);
  const t = q.trim().toUpperCase();
  const name = (id?: string) => d.marketers.find((m) => m.id === id)?.name;
  return (
    <Sheet back tall title="Who has which hospital" subtitle="Every PR agent goes with their hospital" onClose={onClose}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a hospital" className={`${inputCls()} mb-2`} />
      <div className="rounded-[20px] bg-white p-1.5 ring-1 ring-line/70">
        {d.hospitals
          .filter((h) => !t || h.key.includes(t))
          .slice(0, 80)
          .map((h) => (
            <button key={h.key} type="button" onClick={() => setMoving(h)} className="press flex w-full items-center gap-2 rounded-2xl px-2.5 py-2.5 text-left">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px] text-ink">{h.key}</b>
                <span className="text-[12px] text-muted">
                  {formatCount(h.agentIds.length)} agents · {formatCount(d.figs.get(h.key)?.patients ?? 0)} patients
                </span>
              </span>
              {h.owner ? <span className="text-[13px] font-semibold text-ink-2">{name(h.owner.marketerId)}</span> : <span className="rounded-full bg-[#fff1de] px-2 py-0.5 text-[11.5px] font-bold text-[#b45309]">No marketer</span>}
              <ChevronRight size={15} className="text-faint" />
            </button>
          ))}
      </div>
      {moving && <OwnerSheet branchId={branchId} h={moving} marketers={d.marketers} onClose={() => setMoving(null)} />}
    </Sheet>
  );
}

function OwnerSheet({ branchId, h, marketers, onClose }: { branchId: string; h: HospitalInfo; marketers: StaffRecord[]; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const [to, setTo] = useState(h.owner?.marketerId ?? '');
  const [why, setWhy] = useState('');
  return (
    <Sheet
      back
      title={h.key}
      subtitle={`${formatCount(h.agentIds.length)} PR agents go with it`}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={(to || null) === (h.owner?.marketerId ?? null) || why.trim().length < 3}
          onClick={() => {
            setHospitalOwner(branchId, h.key, to || null, user.name, why);
            const name = marketers.find((m) => m.id === to)?.name;
            logAudit({ category: 'PR agents', action: 'Hospital marketer changed', record: h.key, details: `${marketers.find((m) => m.id === h.owner?.marketerId)?.name ?? 'No marketer'} → ${name ?? 'No marketer'} · ${why.trim()}`, branchId });
            showToast(name ? `${h.key} is now ${name}'s` : `${h.key} has no marketer`);
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      }
    >
      <div className="space-y-1.5 px-1 pb-2">
        {[...marketers.map((m) => ({ id: m.id, name: m.name })), { id: '', name: 'No marketer' }].map((m) => (
          <button key={m.id || 'none'} type="button" aria-pressed={to === m.id} onClick={() => setTo(m.id)} className={`press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold ring-1 ${to === m.id ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white text-ink ring-line'}`}>
            {m.name}
            {m.id === (h.owner?.marketerId ?? null) && <span className="ml-auto text-[12px] font-medium text-muted">Now</span>}
          </button>
        ))}
        <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} placeholder="Why (needed)" className={`${inputCls()} mt-2`} />
      </div>
    </Sheet>
  );
}

function SplitSheet({ branchId, d, mode, onClose }: { branchId: string; d: Data; mode: 'fill' | 'even'; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const active = d.marketers.filter((m) => m.status === 'Active');
  const moves = useMemo(() => suggestSplit(d.hospitals, active.map((m) => m.id), mode === 'even'), [d.hospitals, active, mode]);
  const name = (id: string | null) => (id ? (d.marketers.find((m) => m.id === id)?.name ?? 'A former marketer') : 'No marketer');
  return (
    <Sheet
      back
      tall
      title={mode === 'fill' ? 'Share out the hospitals' : 'Even out the split'}
      subtitle={mode === 'fill' ? 'Each goes to the marketer with the fewest agents' : 'Whole hospitals move to share agents fairly'}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!moves.length}
          onClick={() => {
            applyMoves(branchId, moves, user.name, mode === 'fill' ? 'Fair split: hospitals without a marketer' : 'Fair split: evened out');
            logAudit({ category: 'PR agents', action: 'Hospitals shared out to marketers', record: `${moves.length} hospitals`, details: moves.map((m) => `${m.hospital} → ${name(m.to)}`).join(', '), branchId });
            showToast(`${moves.length} hospital${moves.length === 1 ? '' : 's'} given to marketers`);
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          <Check size={17} /> Confirm {moves.length} change{moves.length === 1 ? '' : 's'}
        </button>
      }
    >
      {moves.length ? (
        <div className="space-y-1.5 pb-2">
          {moves.map((m) => (
            <div key={m.hospital} className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-line/70">
              <p className="text-[14px] font-bold text-ink">
                {m.hospital} <span className="text-[12px] font-medium text-muted">· {formatCount(m.agents)} agents</span>
              </p>
              <p className="flex items-center gap-1 text-[13px] text-muted">
                {name(m.from)} <ArrowRight size={12} /> <b className="text-ink">{name(m.to)}</b>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-[20px] bg-white p-4 text-[13.5px] text-muted ring-1 ring-line/70">Nothing to change: the split is as fair as whole hospitals allow.</p>
      )}
    </Sheet>
  );
}
