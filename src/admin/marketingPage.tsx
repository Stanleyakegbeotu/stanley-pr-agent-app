/**
 * Marketing page on the phone (owner, 2026-11-27), for the Branch Manager
 * and the Company Admin: the same as the desktop Marketing page. What still
 * needs setting up, each marketer's card (opening their hospitals with lock,
 * dormant, growth and handover, and Move), transfers to approve, dormant
 * hospitals (caution, move), hospitals without a marketer, new hospitals to
 * take on, small hospitals that need growth, the PR agent monitor, and the
 * settings: monthly tasks, bonus and rules of engagement.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronRight, FileText, Gift, Lock, Megaphone, Plus, Send, ShieldAlert, Target, Trash2, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID } from '@company/data/legacy';
import { logAudit } from '@company/services/audit';
import {
  BONUS_TEXT,
  DEFAULT_POLICY,
  DORMANT_TEXT,
  EMPTY_BONUS,
  STAGE_LABEL,
  bonusEstimate,
  bonusFor,
  carryOverIfLate,
  decideTransfer,
  directMove,
  effectiveTasks,
  hospitalStatuses,
  keepLastMonthTasks,
  monthName,
  moveMode,
  needsAction,
  paceWord,
  policyOf,
  requestRelease,
  rulesText,
  rulesVersion,
  saveMonthTasks,
  sendCaution,
  setBonus,
  setPolicy,
  setRulesNotes,
  setTarget,
  setupStatus,
  tasksFor,
  type BonusKind,
  type BonusPlan,
  type CustomTask,
  type HospitalStatus,
  type Policy,
  type TaskSet,
  type Transfer,
} from '@company/services/marketing';
import { staffKey, useAccountAccess } from '@company/services/accountAccess';
import { formatCount } from '@company/shared/format';
import { useNav } from '@/app/store';
import { useBranchMarketing, initials } from '@/marketer/data';
import { AdminTopBar, PageGlow, SectionTitle } from './kit';
import { PageTitle, useBranchFirst } from './branchFirst';
import { Sheet } from './ui';
import { inputCls } from './prManage';
import { LongText } from './fields';
import { MonitorCard } from './prMonitor';
import { SplitSheet, Waiting } from './marketersCard';
import { useRight } from './access';

const TONE = { ok: 'bg-[#e6f8ee] text-good-ink', warn: 'bg-[#fff1de] text-[#b45309]', danger: 'bg-[#ffe4e4] text-[#b42318]', brand: 'bg-brand-50 text-brand-700', info: 'bg-brand-50 text-brand-700', neutral: 'bg-page text-ink-2' } as const;
const DORMANT_TONE = { active: 'ok', grace: 'neutral', flagged: 'danger', cautioned: 'warn', overdue: 'danger', snoozed: 'info', revived: 'ok' } as const;
const num = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0;

function useMarketingAdmin(branchId: string) {
  const base = useBranchMarketing(branchId);
  const access = useAccountAccess();
  const { staff } = useCompany();
  useMemo(() => carryOverIfLate(branchId), [branchId]);
  const statuses = useMemo(() => hospitalStatuses(base.st, branchId, base.hospitals, base.agents), [base.st, branchId, base.hospitals, base.agents]);
  const unowned = base.hospitals.filter((h) => !h.owner);
  const setup = setupStatus(base.st, branchId, unowned.length);
  const approvals = base.st.transfers.filter((t) => t.branchId === branchId && t.stage === 'manager');
  const openTransfers = base.st.transfers.filter((t) => t.branchId === branchId && (t.stage === 'owner' || t.stage === 'receiver'));
  const ids = new Set(base.marketers.map((m) => m.id));
  const nameOf = (id: string | null | undefined) => (id ? (staff.find((s) => s.id === id)?.name ?? 'A former marketer') : 'No marketer');
  const isActive = (id: string) => ids.has(id) && !access[staffKey(id)]?.off;
  return { ...base, statuses, unowned, setup, approvals, openTransfers, nameOf, isActive, branchId };
}
type D = ReturnType<typeof useMarketingAdmin>;

type Open = { kind: 'tasks' | 'bonus' | 'rules' | 'split' } | { kind: 'move' | 'caution'; hospital: string } | { kind: 'marketer'; id: string } | null;

export function MarketingPage() {
  const { branch } = useBranchFirst();
  const b = branch ?? getBranch(LEGACY_BRANCH_ID)!;
  return <Workspace branchId={b.id} name={b.name} />;
}

function Workspace({ branchId, name }: { branchId: string; name: string }) {
  const right = useRight();
  const canManage = right('referral.manage');
  const d = useMarketingAdmin(branchId);
  const [open, setOpen] = useState<Open>(null);
  const [allDormant, setAllDormant] = useState(false);
  const statuses = [...d.statuses.values()];
  const flagged = statuses.filter((s) => s.owner && ['flagged', 'overdue', 'cautioned', 'snoozed', 'revived'].includes(s.dormant)).sort((a, b) => Number(needsAction(b)) - Number(needsAction(a)) || (b.daysSince ?? 999) - (a.daysSince ?? 999));
  const growth = statuses.filter((s) => s.owner && s.growth);
  const totals = d.progress.reduce((s, p) => ({ revenue: s.revenue + p.revenue, target: s.target + p.target, sourced: s.sourced + p.sourcedHospitals }), { revenue: 0, target: 0, sourced: 0 });
  const missing = d.setup.filter((x) => !x.done);
  const go = (k: 'tasks' | 'bonus' | 'rules' | 'owners') => setOpen(k === 'owners' ? { kind: 'split' } : { kind: k });

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Marketing" sub={`Marketers and their hospitals · ${name} branch`} />
        {!d.marketers.length ? (
          <div className="rounded-[22px] bg-white p-5 text-center text-[14px] text-muted ring-1 ring-line/70">No marketers yet. Add staff with the Marketer role in Staff Management.</div>
        ) : (
          <>
            {missing.length > 0 && canManage && (
              <div className="mb-3 rounded-[24px] bg-linear-to-br from-[#fff8ec] to-[#ffe7cc] p-4 ring-1 ring-[#fde2b3]">
                <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
                  <AlertTriangle size={18} className="text-[#b45309]" /> Finish setting up marketing
                </p>
                <p className="mt-0.5 text-[12.5px] text-[#8a4b00]">Marketers see their tasks, bonus and rules once these are set.</p>
                <div className="mt-3 space-y-1.5">
                  {d.setup.map((x) => (
                    <button key={x.key} type="button" disabled={x.done} onClick={() => go(x.key)} className={`press flex w-full items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 text-left ${x.done ? 'opacity-55' : ''}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${x.done ? 'bg-[#22a06b] text-white' : 'ring-2 ring-[#f2a93b]'}`}>{x.done && <Check size={14} />}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-[14px] text-ink">{x.label}</b>
                        {!x.done && <span className="block text-[12px] text-muted">{x.hint}</span>}
                      </span>
                      {!x.done && <ChevronRight size={16} className="text-[#b45309]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { l: 'Amount', v: d.money(totals.revenue), s: `of ${d.money(totals.target)} targeted`, t: 'bg-tint-blue border-[#d6e7ff]' },
                { l: 'New hospitals', v: formatCount(totals.sourced), s: 'taken on this month', t: 'bg-tint-green border-[#cdeedb]' },
                { l: 'Dormant', v: formatCount(flagged.filter((s) => s.dormant !== 'revived').length), s: `${flagged.filter(needsAction).length} need you`, t: 'bg-[#fdecec] border-[#f9d4d4]' },
                { l: 'To approve', v: formatCount(d.approvals.length), s: `${d.openTransfers.length} waiting for a marketer`, t: 'bg-tint-orange border-[#ffe2c6]' },
              ].map((x) => (
                <div key={x.l} className={`rounded-[18px] border p-3 ${x.t}`}>
                  <p className="text-[12px] text-ink-2">{x.l}</p>
                  <b className="block text-[20px] leading-tight text-ink">{x.v}</b>
                  <p className="truncate text-[11px] text-muted">{x.s}</p>
                </div>
              ))}
            </div>

            <SectionTitle title="Marketers" />
            <div className="space-y-2">
              {[...d.progress]
                .sort((a, b) => b.pct - a.pct)
                .map((p) => {
                  const m = d.marketers.find((x) => x.id === p.marketerId)!;
                  const t = tasksFor(d.st, branchId, m.id);
                  const pw = paceWord(p);
                  const mine = statuses.filter((s) => s.owner === m.id);
                  const dormant = mine.filter((s) => needsAction(s) || s.dormant === 'cautioned').length;
                  return (
                    <button key={m.id} type="button" onClick={() => setOpen({ kind: 'marketer', id: m.id })} className="press w-full rounded-[22px] bg-white p-3.5 text-left shadow-[0_6px_18px_rgba(30,74,160,0.05)] ring-1 ring-line/70">
                      <span className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-[14px] font-bold text-brand-700">{initials(m.name)}</span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-[15px] text-ink">{m.name}</b>
                          <span className="block text-[12px] text-muted">
                            {formatCount(p.hospitals.length)} hospitals · {formatCount(p.agents)} PR agents
                          </span>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${TONE[pw.tone]}`}>{pw.text}</span>
                      </span>
                      <span className="mt-2.5 flex justify-between text-[12.5px]">
                        <b className="text-ink">
                          {d.money(p.revenue)} <span className="font-medium text-muted">/ {d.money(p.target)}</span>
                        </b>
                        <b className="text-ink-2">{Math.round(p.pct * 100)}%</b>
                      </span>
                      <span className="relative mt-1.5 block h-2 rounded-full bg-page">
                        <i className={`block h-full rounded-full ${p.pct >= p.pace ? 'bg-[#22a06b]' : p.pct >= p.pace * 0.8 ? 'bg-[#f2a93b]' : 'bg-[#ef4444]'}`} style={{ width: `${Math.min(100, p.pct * 100)}%` }} />
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                        <span className="rounded-full bg-page px-2 py-0.5 text-ink-2">
                          {p.sourcedHospitals}/{t.newHospitals} new hospitals
                        </span>
                        <span className="rounded-full bg-page px-2 py-0.5 text-ink-2">
                          {p.firstPatientAgents}/{t.newAgents} new agents
                        </span>
                        <span className="rounded-full bg-page px-2 py-0.5 text-ink-2">
                          {p.weekFollowUps}/{t.followUpsPerWeek} follow-ups this week
                        </span>
                        {dormant > 0 && <span className="rounded-full bg-[#ffe4e4] px-2 py-0.5 font-bold text-[#b42318]">{dormant} dormant</span>}
                      </span>
                    </button>
                  );
                })}
            </div>

            {(d.approvals.length > 0 || d.openTransfers.length > 0) && (
              <>
                <SectionTitle title="Hospital transfers" />
                <div className="space-y-2">
                  {[...d.approvals, ...d.openTransfers].map((t) => (
                    <TransferCard key={t.id} d={d} t={t} />
                  ))}
                </div>
              </>
            )}

            {d.unowned.length > 0 && (
              <>
                <SectionTitle title="Without a marketer" action={canManage ? 'Share out' : undefined} onAction={() => setOpen({ kind: 'split' })} />
                <div className="flex flex-wrap gap-1.5">
                  {d.unowned.map((h) => (
                    <button key={h.key} type="button" onClick={() => canManage && setOpen({ kind: 'move', hospital: h.key })} className="press rounded-full bg-white px-3 py-1.5 text-[12.5px] text-muted ring-1 ring-line">
                      <b className="text-ink">{h.key}</b> {h.agentIds.length} agents
                    </button>
                  ))}
                </div>
              </>
            )}

            <SectionTitle title="Dormant hospitals" />
            <p className="-mt-1 mb-2 text-[12.5px] text-muted">No patient for {policyOf(d.st, branchId).dormantDays} days. Caution first; still dormant, move it to revive it.</p>
            {flagged.length ? (
              <div className="space-y-2">
                {(allDormant ? flagged : flagged.slice(0, 6)).map((s) => (
                  <DormantCard key={s.key} d={d} s={s} canManage={canManage} onCaution={() => setOpen({ kind: 'caution', hospital: s.key })} onMove={() => setOpen({ kind: 'move', hospital: s.key })} />
                ))}
                {flagged.length > 6 && (
                  <button type="button" onClick={() => setAllDormant((x) => !x)} className="press w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-brand-600 ring-1 ring-line">
                    {allDormant ? 'Show fewer' : `Show all ${flagged.length}`}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-[20px] bg-white p-4 text-[13.5px] text-muted ring-1 ring-line/70">No dormant hospitals.</div>
            )}

            {d.st.partners.some((p) => p.branchId === branchId && p.status === 'proposed') && <Waiting branchId={branchId} d={d} />}

            {growth.length > 0 && (
              <>
                <SectionTitle title="Small hospitals: need growth" />
                <p className="-mt-1 mb-2 text-[12.5px] text-muted">{growth.length} hospitals have {policyOf(d.st, branchId).growthMaxAgents} PR agents or fewer.</p>
                <div className="flex flex-wrap gap-1.5">
                  {growth.slice(0, 24).map((s) => (
                    <span key={s.key} className="rounded-full bg-white px-3 py-1.5 text-[12px] text-muted ring-1 ring-line">
                      <b className="text-ink">{s.key}</b> · {d.nameOf(s.owner).split(' ')[0]}
                    </span>
                  ))}
                </div>
              </>
            )}

            <MonitorCard branchId={branchId} />

            {canManage && (
              <>
                <SectionTitle title="Settings" />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { k: 'tasks' as const, l: 'Monthly tasks', i: <Target size={22} className="text-brand-600" />, t: 'bg-tint-blue border-[#d6e7ff]' },
                    { k: 'bonus' as const, l: 'Bonus', i: <Gift size={22} className="text-good" />, t: 'bg-tint-green border-[#cdeedb]' },
                    { k: 'rules' as const, l: 'Rules', i: <FileText size={22} className="text-violet" />, t: 'bg-tint-purple border-[#e2d8ff]' },
                  ].map((x) => (
                    <button key={x.k} type="button" onClick={() => setOpen({ kind: x.k })} className={`press flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[18px] border ${x.t}`}>
                      {x.i}
                      <span className="text-[12.5px] font-semibold text-ink">{x.l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {open?.kind === 'marketer' && <MarketerSheet d={d} id={open.id} onMove={(h) => setOpen({ kind: 'move', hospital: h })} onClose={() => setOpen(null)} />}
      {open?.kind === 'move' && <MoveSheet d={d} hospital={open.hospital} onClose={() => setOpen(null)} />}
      {open?.kind === 'caution' && <CautionSheet d={d} hospital={open.hospital} onClose={() => setOpen(null)} />}
      {open?.kind === 'split' && <SplitSheet branchId={branchId} d={d} mode="fill" onClose={() => setOpen(null)} />}
      {open?.kind === 'tasks' && <TasksSheet d={d} onClose={() => setOpen(null)} />}
      {open?.kind === 'bonus' && <BonusSheet d={d} onClose={() => setOpen(null)} />}
      {open?.kind === 'rules' && <RulesSheet d={d} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TransferCard({ d, t }: { d: D; t: Transfer }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  return (
    <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
      <p className="flex items-center gap-1.5 text-[14.5px] font-bold text-ink">
        {t.hospital}: {d.nameOf(t.from).split(' ')[0]} <ArrowRight size={13} /> {d.nameOf(t.to).split(' ')[0]}
      </p>
      <p className="text-[12px] text-muted">
        {t.kind === 'offer' ? 'Offered by the marketer, accepted by the colleague' : 'Your request to release it'} · {t.reason}
      </p>
      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-bold ${t.stage === 'manager' ? TONE.warn : TONE.info}`}>{STAGE_LABEL[t.stage]}</span>
      {t.stage === 'manager' && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => (decideTransfer(t.id, false, user.name, ''), showToast('Not approved'))} className="press flex min-h-10 items-center justify-center gap-1 rounded-xl bg-page text-[13px] font-semibold text-ink-2">
            <X size={14} /> Decline
          </button>
          <button type="button" onClick={() => (decideTransfer(t.id, true, user.name, ''), showToast(`${t.hospital} moved`))} className="press flex min-h-10 items-center justify-center gap-1 rounded-xl bg-brand-600 text-[13px] font-semibold text-white">
            <Check size={14} /> Approve
          </button>
        </div>
      )}
    </div>
  );
}

function DormantCard({ d, s, canManage, onCaution, onMove }: { d: D; s: HospitalStatus; canManage: boolean; onCaution: () => void; onMove: () => void }) {
  return (
    <div className={`rounded-[20px] p-3.5 ring-1 ${needsAction(s) ? 'bg-[#fff8f8] ring-[#f6caca]' : 'bg-white ring-line/70'}`}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-1.5 text-[14.5px] text-ink">
            {s.key} {s.locked && <Lock size={13} className="text-brand-600" />}
          </b>
          <span className="block text-[12px] text-muted">
            {d.nameOf(s.owner)} · {s.daysSince === null ? 'no patient in 6 months' : `last patient ${s.daysSince} days ago`}
            {s.cautions ? ` · ${s.cautions} caution${s.cautions === 1 ? '' : 's'}` : ''}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${TONE[DORMANT_TONE[s.dormant]]}`}>{DORMANT_TEXT[s.dormant]}</span>
      </div>
      {s.caution?.reply && <p className="mt-2 rounded-xl bg-page px-3 py-2 text-[12.5px] italic text-ink-2">“{s.caution.reply.reason}: {s.caution.reply.plan}”</p>}
      {canManage && s.dormant !== 'revived' && (s.dormant === 'flagged' || s.dormant === 'snoozed' || needsAction(s)) && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(s.dormant === 'flagged' || s.dormant === 'snoozed') && (
            <button type="button" onClick={onCaution} className="press flex min-h-10 items-center justify-center gap-1 rounded-xl bg-page text-[13px] font-semibold text-ink-2">
              <Send size={14} /> Caution
            </button>
          )}
          {needsAction(s) && (
            <button type="button" onClick={onMove} className="press flex min-h-10 items-center justify-center gap-1 rounded-xl bg-brand-600 text-[13px] font-semibold text-white">
              <ArrowRight size={14} /> Move
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── sheets ─────────────── */

function MarketerSheet({ d, id, onMove, onClose }: { d: D; id: string; onMove: (h: string) => void; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const m = d.marketers.find((x) => x.id === id)!;
  const p = d.progress.find((x) => x.marketerId === id)!;
  const t = tasksFor(d.st, d.branchId, id);
  const plan = bonusFor(d.st, d.branchId, id);
  const est = plan ? bonusEstimate(plan, p) : null;
  const [target, setT] = useState(String(p.target));
  const mine = [...d.statuses.values()].filter((s) => s.owner === id).sort((a, b) => (d.figs.get(b.key)?.revenue ?? 0) - (d.figs.get(a.key)?.revenue ?? 0));
  const agreed = !!d.st.rules[d.branchId] && (d.st.acks[id]?.version ?? -1) >= rulesVersion(d.st, d.branchId);
  return (
    <Sheet back tall title={m.name} subtitle={`${formatCount(p.hospitals.length)} hospitals · ${agreed ? 'agreed to the rules' : 'has not agreed to the latest rules'}`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] text-muted">Amount against target</p>
          <b className="block text-[17px] text-ink">
            {d.money(p.revenue)} <span className="text-[12.5px] text-muted">/ {d.money(p.target)}</span>
          </b>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] text-muted">Bonus</p>
          <b className="block text-[17px] text-ink">{plan && plan.kind !== 'none' ? d.money(est!.now) : '—'}</b>
          <p className="text-[11px] text-muted">{plan ? (plan.kind === 'none' ? 'No money bonus' : est!.qualifies ? 'Earned so far' : `${d.money(est!.atTarget)} at ${plan.minPct}%`) : 'Not set up yet'}</p>
        </div>
      </div>
      <div className="mb-3 rounded-2xl bg-white p-3 text-[12.5px] text-ink-2 ring-1 ring-line/70">
        <b className="text-ink">Tasks:</b> {p.sourcedHospitals}/{t.newHospitals} new hospitals · {p.firstPatientAgents}/{t.newAgents} new agents · {p.weekFollowUps}/{t.followUpsPerWeek} follow-ups this week
      </div>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Their hospitals</p>
      <div className="mb-3 rounded-[20px] bg-white p-1.5 ring-1 ring-line/70">
        {mine.map((s) => {
          const lockedNow = s.locked && !needsAction(s);
          return (
            <div key={s.key} className="flex items-center gap-2 rounded-2xl px-2 py-2.5">
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-1 text-[14px] text-ink">
                  {s.key} {s.locked && <Lock size={12} className="text-brand-600" />}
                </b>
                <span className="block text-[11.5px] text-muted">
                  {d.money(d.figs.get(s.key)?.revenue ?? 0)} · {s.dormant !== 'active' ? DORMANT_TEXT[s.dormant] : s.growth ? 'Needs growth' : s.handoverUntil ? 'In handover' : 'Sending'}
                </span>
              </span>
              <button type="button" disabled={lockedNow} onClick={() => onMove(s.key)} className="press min-h-9 rounded-xl bg-page px-3 text-[12.5px] font-semibold text-brand-700 disabled:text-faint">
                {lockedNow ? <Lock size={14} /> : 'Move'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Their target for {monthName(d.ym, true)} (₦)</p>
      <div className="mb-3 flex gap-2">
        <input inputMode="numeric" value={target} onChange={(e) => setT(e.target.value.replace(/\D/g, ''))} className={inputCls()} aria-label="Target" />
        <button
          type="button"
          disabled={!Number(target) || Number(target) === p.target}
          onClick={() => {
            setTarget(d.branchId, id, d.ym, Number(target), user.name);
            logAudit({ category: 'PR agents', action: 'Marketer target set', record: `${m.name} · ${monthName(d.ym, true)}`, details: d.money(Number(target)), branchId: d.branchId });
            showToast(`Target set: ${d.money(Number(target))}`);
          }}
          className="press min-h-12 shrink-0 rounded-2xl bg-brand-600 px-4 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          Set
        </button>
      </div>
    </Sheet>
  );
}

function MoveSheet({ d, hospital, onClose }: { d: D; hospital: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const s = d.statuses.get(hospital);
  const owner = s?.owner ?? null;
  const m = moveMode(s, owner ? d.isActive(owner) : true);
  const [to, setTo] = useState('');
  const [why, setWhy] = useState('');
  const pending = d.openTransfers.find((t) => t.hospital === hospital);
  return (
    <Sheet
      back
      title={`Move ${hospital}`}
      subtitle={`Now with ${d.nameOf(owner)}`}
      onClose={onClose}
      footer={
        m.mode !== 'locked' && !pending ? (
          <button
            type="button"
            disabled={!to || why.trim().length < 3}
            onClick={() => {
              if (m.mode === 'direct') {
                directMove(d.branchId, hospital, owner, to, why, user.name);
                showToast(`${hospital} moved to ${d.nameOf(to)}`);
              } else {
                requestRelease(d.branchId, hospital, owner!, to, why, user.name);
                showToast(`Request sent to ${d.nameOf(owner)}`);
              }
              onClose();
            }}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {m.mode === 'direct' ? 'Move now' : `Ask ${d.nameOf(owner).split(' ')[0]} to release it`}
          </button>
        ) : undefined
      }
    >
      <div className={`mb-3 flex gap-2.5 rounded-2xl p-3 ${m.mode === 'locked' ? 'bg-[#fdecec] text-[#b42318]' : m.mode === 'direct' ? 'bg-tint-green text-good-ink' : 'bg-brand-50 text-brand-700'}`}>
        {m.mode === 'locked' ? <Lock size={18} /> : m.mode === 'direct' ? <Check size={18} /> : <Send size={18} />}
        <span>
          <b className="block text-[14px]">{m.mode === 'locked' ? 'Locked' : m.mode === 'direct' ? 'You can move it now' : 'The marketer must agree'}</b>
          <span className="text-[12.5px] text-ink-2">{m.why}</span>
        </span>
      </div>
      {pending ? (
        <p className="text-[13px] text-muted">A move is already waiting: {STAGE_LABEL[pending.stage]}.</p>
      ) : m.mode !== 'locked' ? (
        <div className="space-y-2 pb-2">
          {d.marketers
            .filter((x) => x.status === 'Active' && x.id !== owner)
            .map((x) => (
              <button key={x.id} type="button" aria-pressed={to === x.id} onClick={() => setTo(x.id)} className={`press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left ring-1 ${to === x.id ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-line'}`}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-page text-[12px] font-bold text-ink-2">{initials(x.name)}</span>
                <b className="text-[14.5px] text-ink">{x.name}</b>
              </button>
            ))}
          <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} placeholder="Why (needed)" className={inputCls()} />
          <p className="text-[12px] text-muted">Patients it sent before the move stay credited to {d.nameOf(owner)}. {policyOf(d.st, d.branchId).handoverDays}-day handover for the new marketer.</p>
        </div>
      ) : null}
    </Sheet>
  );
}

function CautionSheet({ d, hospital, onClose }: { d: D; hospital: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const s = d.statuses.get(hospital)!;
  const pol = policyOf(d.st, d.branchId);
  const [msg, setMsg] = useState(`${hospital} has sent ${s.daysSince === null ? 'no patient in a long time' : `no patient for ${s.daysSince} days`}. Please tell me why, and your plan to revive it, within ${pol.replyDays} days.`);
  return (
    <Sheet
      back
      title={`Caution: ${hospital}`}
      subtitle={`To ${d.nameOf(s.owner)}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={msg.trim().length < 10}
          onClick={() => {
            sendCaution({ branchId: d.branchId, hospital, marketerId: s.owner!, by: user.name, message: msg });
            showToast('Caution sent');
            onClose();
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          <ShieldAlert size={17} /> Send caution
        </button>
      }
    >
      <div className="px-1 pb-2">
        <LongText label="Message" value={msg} onChange={setMsg} max={500} />
      </div>
    </Sheet>
  );
}

function NumField({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13.5px] font-semibold text-ink">{label}</span>
      <input inputMode="numeric" value={String(value)} onChange={(e) => onChange(num(e.target.value))} className={inputCls()} />
      {hint && <span className="mt-1 block text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}

function TasksSheet({ d, onClose }: { d: D; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const { tasks, set } = effectiveTasks(d.st, d.branchId, d.ym);
  const [b, setB] = useState<TaskSet>(tasks.base);
  const [custom, setCustom] = useState<CustomTask[]>(set ? tasks.custom : []);
  const [title, setTitle] = useState('');
  return (
    <Sheet
      back
      tall
      title={`Tasks · ${monthName(d.ym, true)}`}
      subtitle={set ? `Set by ${tasks.setBy}` : 'Not set for this month yet'}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!tasks.setBy} onClick={() => (keepLastMonthTasks(d.branchId, d.ym, user.name), showToast("Last month's tasks kept"), onClose())} className="press min-h-12 rounded-2xl bg-page text-[14px] font-semibold text-ink-2 disabled:opacity-40">
            Keep last month's
          </button>
          <button type="button" onClick={() => (saveMonthTasks(d.branchId, d.ym, { base: b, overrides: tasks.overrides, custom }, user.name), showToast('Tasks saved'), onClose())} className="press min-h-12 rounded-2xl bg-brand-600 text-[14px] font-semibold text-white">
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-1 pb-2">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-page p-1">
          {(
            [
              ['auto', 'Usual month + %'],
              ['fixed', 'Set amount'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={b.amountMode === k} onClick={() => setB({ ...b, amountMode: k })} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${b.amountMode === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-2'}`}>
              {l}
            </button>
          ))}
        </div>
        {b.amountMode === 'auto' ? <NumField label="Grow by (%)" hint="Each marketer's hospitals' usual month plus this share." value={b.autoPct} onChange={(n) => setB({ ...b, autoPct: n })} /> : <NumField label="Money target (₦)" value={b.fixedAmount} onChange={(n) => setB({ ...b, fixedAmount: n })} />}
        <NumField label="New partner hospitals" value={b.newHospitals} onChange={(n) => setB({ ...b, newHospitals: n })} />
        <NumField label="New PR agents with a first patient" value={b.newAgents} onChange={(n) => setB({ ...b, newAgents: n })} />
        <NumField label="Follow-ups a week" value={b.followUpsPerWeek} onChange={(n) => setB({ ...b, followUpsPerWeek: n })} />
        <p className="pt-1 text-[13px] font-semibold text-ink-2">Extra tasks (everyone)</p>
        {custom.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-line">
            <span className="flex-1 text-[13.5px] text-ink">{c.title}</span>
            <button type="button" onClick={() => setCustom(custom.filter((x) => x.id !== c.id))} aria-label="Remove" className="text-[#b42318]">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: visit every hospital in Garki" className={inputCls()} />
          <button type="button" disabled={title.trim().length < 3} onClick={() => (setCustom([...custom, { id: `T${Date.now()}`, title: title.trim(), marketerIds: [] }]), setTitle(''))} className="press grid min-h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 disabled:opacity-40">
            <Plus size={18} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function BonusSheet({ d, onClose }: { d: D; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const cur = d.st.bonus[d.branchId];
  const [b, setB] = useState<BonusPlan>(cur?.base ?? { ...EMPTY_BONUS });
  return (
    <Sheet back tall title="Marketer bonus" subtitle={cur ? `Set by ${cur.setBy}` : 'Not set yet'} onClose={onClose} footer={<button type="button" onClick={() => (setBonus(d.branchId, { base: b, overrides: cur?.overrides ?? {} }, user.name), showToast('Bonus saved'), onClose())} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">Save bonus</button>}>
      <div className="space-y-3 px-1 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          {(['fixed', 'percentOver', 'percentAll', 'none'] as BonusKind[]).map((k) => (
            <button key={k} type="button" aria-pressed={b.kind === k} onClick={() => setB({ ...b, kind: k })} className={`press min-h-12 rounded-2xl px-3 text-left text-[13px] font-semibold ring-1 ${b.kind === k ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white text-ink-2 ring-line'}`}>
              {BONUS_TEXT[k]}
            </button>
          ))}
        </div>
        {b.kind === 'fixed' && <NumField label="Amount (₦)" value={b.amount} onChange={(n) => setB({ ...b, amount: n })} />}
        {(b.kind === 'percentOver' || b.kind === 'percentAll') && <NumField label="Percent" value={b.pct} onChange={(n) => setB({ ...b, pct: n })} />}
        {b.kind !== 'none' && <NumField label="Reach this % of the target" hint="100 = the full target." value={b.minPct} onChange={(n) => setB({ ...b, minPct: n })} />}
        <NumField label="Extra for each new hospital (₦)" value={b.perHospital} onChange={(n) => setB({ ...b, perHospital: n })} />
        <NumField label="Extra for each new PR agent with a first patient (₦)" value={b.perAgent} onChange={(n) => setB({ ...b, perAgent: n })} />
        <label className="block">
          <span className="mb-1 block text-[13.5px] font-semibold text-ink">Anything else (optional)</span>
          <input value={b.note} maxLength={160} onChange={(e) => setB({ ...b, note: e.target.value })} placeholder="For example: a day off for the marketer of the month" className={inputCls()} />
        </label>
      </div>
    </Sheet>
  );
}

function RulesSheet({ d, onClose }: { d: D; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const [p, setP] = useState<Policy>(policyOf(d.st, d.branchId));
  const [notes, setNotes] = useState(d.st.rules[d.branchId]?.notes ?? '');
  const preview = rulesText({ ...d.st, policy: { ...d.st.policy, [d.branchId]: p } }, d.branchId);
  return (
    <Sheet back tall title="Rules of engagement" subtitle={`Version ${rulesVersion(d.st, d.branchId)}`} onClose={onClose} footer={<button type="button" onClick={() => (setPolicy(d.branchId, p, user.name), setRulesNotes(d.branchId, notes, user.name), showToast('Rules published to marketers'), onClose())} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"><Megaphone size={17} /> Publish to marketers</button>}>
      <div className="space-y-3 px-1 pb-2">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-page p-1">
          {([7, 14] as const).map((k) => (
            <button key={k} type="button" aria-pressed={p.handoverDays === k} onClick={() => setP({ ...p, handoverDays: k })} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${p.handoverDays === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-2'}`}>
              {k}-day handover
            </button>
          ))}
        </div>
        <NumField label="Dormant after (days)" value={p.dormantDays} onChange={(n) => setP({ ...p, dormantDays: n || DEFAULT_POLICY.dormantDays })} />
        <NumField label="Days to answer a caution" value={p.replyDays} onChange={(n) => setP({ ...p, replyDays: n || DEFAULT_POLICY.replyDays })} />
        <NumField label="Flag again after (days)" value={p.snoozeDays} onChange={(n) => setP({ ...p, snoozeDays: n || DEFAULT_POLICY.snoozeDays })} />
        <NumField label="Locked best hospitals" value={p.lockTop} onChange={(n) => setP({ ...p, lockTop: n || DEFAULT_POLICY.lockTop })} />
        <NumField label="Needs growth at (agents or fewer)" value={p.growthMaxAgents} onChange={(n) => setP({ ...p, growthMaxAgents: n || DEFAULT_POLICY.growthMaxAgents })} />
        <LongText label="Branch notes" optional value={notes} onChange={setNotes} max={1200} minRows={3} />
        <p className="pt-1 text-[13px] font-semibold text-ink-2">What marketers read</p>
        <div className="space-y-2 rounded-[20px] bg-page p-3">
          {preview.map((s) => (
            <div key={s.title}>
              <b className="text-[13.5px] text-ink">{s.title}</b>
              <ul className="ml-4 list-disc">
                {s.points.map((x) => (
                  <li key={x} className="text-[12.5px] text-ink-2">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

