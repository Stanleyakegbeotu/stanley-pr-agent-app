/**
 * What's behind a figure (owner, 2026-11-25): tapping any admin card opens a
 * slide-up card listing every record that makes up the figure, for the branch
 * scope being viewed (all branches, or one). Same records as the desktop
 * (src/company dailyLines / analytics), so the list always adds up to the card.
 *
 *  • Every slide-up has search and a date filter in its own header bar. The
 *    date filter starts from the dashboard's period and never changes it.
 *  • Records open further slide-ups stacked on top: a service shows every
 *    patient who did that test, a PR agent the patients they referred, a
 *    hospital its agents and patients, and any patient their full visit record
 *    (as on the desktop: tests, prices, payment, who processed it, who referred).
 *  • Payments filter by method (Cash, POS, Transfer).
 *  • Expenses drop down to show what they were for, who recorded and approved
 *    them, and when.
 *  • People are always shown by name AND role (admin/people.ts).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock3, Copy, CreditCard, Handshake, MapPin, MessageCircle, Phone, Sparkles, UserCheck, Users } from 'lucide-react';
import { useNav } from '@/app/store';
import { useSeen } from './charts';
import { promiseText, useBalanceNotes } from './balance';
import { useApp as useCompany } from '@company/app/AppState';
import { SERVICES, getBranch } from '@company/data/company';
import type { Currency, PaymentMethod, PeriodSelection } from '@company/data/types';
import { PAYMENT_METHODS } from '@company/data/types';
import { expenseLines, ledger, openBalances, patientHistory, patientVisits, type ExpenseLine, type PatientVisit } from '@company/data/demo/dailyLines';
import { agentRanking, hospitalRanking, serviceRanking } from '@company/services/analytics';
import { commissionOn } from '@company/services/commission';
import { formatCount, formatMoney } from '@company/shared/format';
import { serviceByName } from '@/data/services';
import { InitialsAvatar, ServiceThumb, Sticker } from '@/ui/kit';
import type { StickerKey } from '@/assets';
import { Sheet, useSheetPeriod } from './ui';
import { useTeam, type Who } from './people';
import { AgentProfileSheet } from './agents';
import { AgentAvatar } from './agentPhotos';

export type DetailKind = 'revenue' | 'payments' | 'patients' | 'expenses' | 'outstanding' | 'commission' | 'referrals' | 'hospitals' | 'services';
/** A single record opened on top of a list. */
export type Focus = { kind: 'visit'; visit: PatientVisit } | { kind: 'service'; id: number; name: string } | { kind: 'agent'; id: number } | { kind: 'hospital'; key: string; name: string };

const PAGE = 30;
const branchName = (id: string) => getBranch(id)?.name ?? id;
const cur = (id: string): Currency => getBranch(id)?.currency ?? 'NGN';
const timeOf = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dateOf = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const when = (d: Date, oneDay: boolean) => (oneDay ? timeOf(d) : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${timeOf(d)}`);
const CATEGORY = new Map(SERVICES.map((s) => [s.id, s.category]));
export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const META: Record<DetailKind, { title: string; sticker: StickerKey; tone: string; note: string; search: string }> = {
  revenue: { title: 'Revenue generated', sticker: 'chart', tone: 'from-[#e8f1ff] to-[#d6e6ff]', note: 'Every visit billed. Revenue is billed value, not money received. Tap a patient for the full visit record.', search: 'Search patient, ID or test' },
  payments: { title: 'Payments received', sticker: 'moneyBag', tone: 'from-[#e6f8ee] to-[#cfeedd]', note: 'Every receipt: payments at the visit and balances recovered from earlier visits.', search: 'Search patient, ID or test' },
  patients: { title: 'Patients attended', sticker: 'stethoscope', tone: 'from-[#eef0ff] to-[#dfe3ff]', note: 'Each patient visit. New patients are marked. Tap a patient for the full visit record.', search: 'Search patient, ID or test' },
  expenses: { title: 'Expenses incurred', sticker: 'clipboard', tone: 'from-[#fff3e2] to-[#ffe4c2]', note: 'Approved expenses by expense date. Tap one to see who recorded and approved it.', search: 'Search expense, category or person' },
  outstanding: { title: 'Outstanding balances', sticker: 'calendar', tone: 'from-[#fdecec] to-[#f9d6d6]', note: 'Bills still owing at the end of the period, oldest first.', search: 'Search patient, ID or test' },
  commission: { title: 'PR commissions earned', sticker: 'coin', tone: 'from-[#f3eeff] to-[#e4dbff]', note: 'Commission accrued to each PR agent on their referred patients. Tap an agent to see the patients.', search: 'Search PR agent or hospital' },
  referrals: { title: 'Referrals by PR agent', sticker: 'stethoscope', tone: 'from-[#eaf3ff] to-[#d9e9ff]', note: 'Every PR agent who referred patients. Tap an agent to see the patients.', search: 'Search PR agent or hospital' },
  hospitals: { title: 'Referring hospitals', sticker: 'hospital', tone: 'from-[#eef9ff] to-[#d7efff]', note: 'Hospitals ranked by referrals from their PR agents. Tap one for its agents and patients.', search: 'Search hospital' },
  services: { title: 'Diagnostic services', sticker: 'microscope', tone: 'from-[#e6f8ee] to-[#cfeedd]', note: 'Every service performed, with its billed value. Tap one for the patients who did it.', search: 'Search test or category' },
};

export interface Row {
  key: string;
  /** Lower-case text the search matches against. */
  text: string;
  /** Payment method, for the payments filter. */
  method?: PaymentMethod | null;
  render: (oneDay: boolean, multi: boolean) => ReactNode;
}
interface Body {
  total: string;
  totalLabel: string;
  countText: string;
  byBranch: { label: string; value: string }[];
  rows: Row[];
}

/* ─────────────── the list behind a dashboard card ─────────────── */

export function DetailSheet({ kind, branchIds, period, scopeText, onClose, method: initialMethod = null }: { kind: DetailKind; branchIds: string[]; period: PeriodSelection; scopeText: string; onClose: () => void; method?: PaymentMethod | null }) {
  const m = META[kind];
  const { period: sel, range, filter } = useSheetPeriod(period);
  const [q, setQ] = useState('');
  const [method, setMethod] = useState<PaymentMethod | null>(initialMethod);
  const [focus, setFocus] = useState<Focus | null>(null);
  const team = useTeam();
  const { agents } = useCompany();
  const oneDay = range.days <= 1;
  const multi = branchIds.length > 1;
  const agentName = (id: number | null) => (id == null ? null : (agents.find((a) => a.id === id)?.name ?? `PR agent #${id}`));
  const body = useMemo(
    () => build(kind, branchIds, range, { open: setFocus, team, agentName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, branchIds.join(','), range.from.getTime(), range.to.getTime(), team, agents],
  );
  const methodTotals = useMemo(() => {
    if (kind !== 'payments') return null;
    const t = new Map<PaymentMethod, { n: number; v: number }>();
    for (const e of ledger(branchIds, range).filter((x) => x.direction === 'in')) {
      if (!e.method) continue;
      const x = t.get(e.method) ?? { n: 0, v: 0 };
      t.set(e.method, { n: x.n + 1, v: x.v + e.amount });
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, branchIds.join(','), range.from.getTime(), range.to.getTime()]);
  const t = norm(q);
  const rows = body.rows.filter((r) => (!t || r.text.includes(t)) && (!method || r.method === method));
  const c0 = cur(branchIds[0] ?? '');
  const methodTotal = method && methodTotals?.get(method);

  return (
    <Sheet title={m.title} subtitle={scopeText} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: m.search }} filter={filter}>
      <SummaryCard tone={m.tone} sticker={m.sticker} label={methodTotal ? `Paid by ${method}` : body.totalLabel} total={methodTotal ? formatMoney(methodTotal.v, c0) : body.total} count={methodTotal ? `${formatCount(methodTotal.n)} payment${methodTotal.n === 1 ? '' : 's'} of ${body.total}` : body.countText} note={m.note} />
      {methodTotals && (
        <div className="mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by payment method">
          <Chip on={!method} onClick={() => setMethod(null)} label="All" sub={body.total} />
          {PAYMENT_METHODS.map((pm) => (
            <Chip key={pm} on={method === pm} onClick={() => setMethod(method === pm ? null : pm)} label={pm} sub={formatMoney(methodTotals.get(pm)?.v ?? 0, c0, true)} />
          ))}
        </div>
      )}
      {multi && body.byBranch.length > 1 && !method && (
        <div className="mb-3 flex gap-2 overflow-x-auto px-1">
          {body.byBranch.map((b) => (
            <span key={b.label} className="shrink-0 rounded-full bg-page px-3 py-1.5 text-[12.5px] text-ink-2">
              {b.label} <b className="text-ink">{b.value}</b>
            </span>
          ))}
        </div>
      )}
      <Rows rows={rows} oneDay={oneDay} multi={multi} empty={t ? `Nothing matches “${q}”.` : method ? `No ${method} payments in this period.` : 'Nothing recorded in this period.'} />
      {focus && <FocusSheet focus={focus} branchIds={branchIds} period={sel} onClose={() => setFocus(null)} />}
    </Sheet>
  );
}

export interface Ctx {
  open: (f: Focus) => void;
  team: ReturnType<typeof useTeam>;
  agentName: (id: number | null) => string | null;
}

function sumBy<T>(items: T[], branch: (t: T) => string, amount: (t: T) => number, fmt: (v: number, b: string) => string) {
  const m = new Map<string, number>();
  for (const t of items) m.set(branch(t), (m.get(branch(t)) ?? 0) + amount(t));
  return [...m.entries()].map(([b, v]) => ({ label: branchName(b), value: fmt(v, b) }));
}
const money = (v: number, b: string) => formatMoney(v, cur(b));
const visitText = (v: PatientVisit, x: Ctx) => norm([v.patientName, v.patientRef, v.phone ?? '', branchName(v.branchId), ...v.services.map((s) => s.name), x.agentName(v.agentId) ?? '', x.team.processedBy(v)?.name ?? ''].join(' '));
export const visitRow = (v: PatientVisit, x: Ctx, extra: Partial<VisitRowProps> = {}): Row => ({
  key: v.id + (extra.tag ?? ''),
  text: visitText(v, x),
  method: extra.method ?? v.method,
  render: (oneDay, multi) => <VisitRow v={v} oneDay={oneDay} multi={multi} by={x.team.processedBy(v)} agent={x.agentName(v.agentId)} onOpen={() => x.open({ kind: 'visit', visit: v })} {...extra} />,
});

function build(kind: DetailKind, ids: string[], range: ReturnType<typeof useSheetPeriod>['range'], x: Ctx): Body {
  const c0 = cur(ids[0] ?? '');
  switch (kind) {
    case 'revenue':
    case 'patients': {
      const visits = patientVisits(ids, range).sort((a, b) => b.at.getTime() - a.at.getTime());
      const billed = visits.reduce((s, v) => s + v.billed, 0);
      const fresh = visits.filter((v) => v.isNew).length;
      return {
        total: kind === 'revenue' ? formatMoney(billed, c0) : formatCount(visits.length),
        totalLabel: kind === 'revenue' ? 'Total billed' : 'Patient visits',
        countText: kind === 'revenue' ? `${formatCount(visits.length)} visits` : `${formatCount(fresh)} new patients · ${formatMoney(billed, c0)} billed`,
        byBranch: kind === 'revenue' ? sumBy(visits, (v) => v.branchId, (v) => v.billed, money) : sumBy(visits, (v) => v.branchId, () => 1, (v) => formatCount(v)),
        rows: visits.map((v) => visitRow(v, x)),
      };
    }
    case 'payments': {
      const ins = ledger(ids, range)
        .filter((e) => e.direction === 'in')
        .sort((a, b) => b.at.getTime() - a.at.getTime());
      const total = ins.reduce((s, e) => s + e.amount, 0);
      return {
        total: formatMoney(total, c0),
        totalLabel: 'Total received',
        countText: `${formatCount(ins.length)} payments`,
        byBranch: sumBy(ins, (e) => e.branchId, (e) => e.amount, money),
        rows: ins.map((e) =>
          e.visit
            ? { ...visitRow(e.visit, x, { amount: e.amount, at: e.at, tag: e.kind === 'recovery' ? 'Balance recovered' : 'Paid at visit', method: e.method }), key: e.id }
            : { key: e.id, text: norm(`${e.source} ${e.category}`), method: e.method, render: (oneDay, multi) => <Line title={e.source} sub={[e.category, multi ? branchName(e.branchId) : '', when(e.at, oneDay)].filter(Boolean).join(' · ')} right={money(e.amount, e.branchId)} /> },
        ),
      };
    }
    case 'expenses': {
      const lines = expenseLines(ids, range).sort((a, b) => b.at.getTime() - a.at.getTime());
      const total = lines.reduce((s, e) => s + e.amount, 0);
      return {
        total: formatMoney(total, c0),
        totalLabel: 'Approved expenses',
        countText: `${formatCount(lines.length)} expenses`,
        byBranch: sumBy(lines, (e) => e.branchId, (e) => e.amount, money),
        rows: lines.map((e) => {
          const p = x.team.expensePeople(e);
          return { key: e.id, text: norm([e.description, e.category, e.id, branchName(e.branchId), p.recordedBy?.name ?? '', p.approvedBy.name].join(' ')), render: (oneDay, multi) => <ExpenseRow e={e} oneDay={oneDay} multi={multi} people={p} /> };
        }),
      };
    }
    case 'outstanding': {
      const open = ids.flatMap((id) => openBalances(id, range.to)).sort((a, b) => b.ageDays - a.ageDays);
      const total = open.reduce((s, o) => s + o.remaining, 0);
      return {
        total: formatMoney(total, c0),
        totalLabel: 'Still owed',
        countText: `${formatCount(open.length)} open bills`,
        byBranch: sumBy(open, (o) => o.visit.branchId, (o) => o.remaining, money),
        rows: open.map((o) => visitRow(o.visit, x, { amount: o.remaining, longDate: true, danger: true, tag: `${o.ageDays} day${o.ageDays === 1 ? '' : 's'} old · ${money(o.repaid, o.visit.branchId)} repaid of ${money(o.owed, o.visit.branchId)}` })),
      };
    }
    case 'commission':
    case 'referrals': {
      const agents = agentRanking(ids, range);
      const totalC = agents.reduce((s, a) => s + (a.commission[c0] ?? 0), 0);
      const totalR = agents.reduce((s, a) => s + a.referrals, 0);
      const list = kind === 'commission' ? [...agents].sort((a, b) => (b.commission[c0] ?? 0) - (a.commission[c0] ?? 0)) : agents;
      return {
        total: kind === 'commission' ? formatMoney(totalC, c0) : formatCount(totalR),
        totalLabel: kind === 'commission' ? 'Commission accrued' : 'Referrals',
        countText: `${formatCount(agents.length)} PR agents · ${kind === 'commission' ? `${formatCount(totalR)} referrals` : formatMoney(totalC, c0) + ' commission'}`,
        byBranch: sumBy(agents, (a) => a.branch.id, (a) => (kind === 'commission' ? (a.commission[a.branch.currency] ?? 0) : a.referrals), (v, b) => (kind === 'commission' ? money(v, b) : formatCount(v))),
        rows: list.map((a, i) => ({
          key: String(a.id),
          text: norm(`${a.name} ${a.hospitalKey} ${a.hospital} ${a.phone}`),
          render: (_o, multi) => (
            <Line
              onClick={() => x.open({ kind: 'agent', id: a.id })}
              initials={a.name}
              agentId={a.id}
              agentPhone={a.phone}
              title={`${i + 1}. ${a.name}`}
              sub={[a.hospitalKey || 'No hospital assigned', multi ? a.branch.name : '', a.phone !== 'N/A' ? a.phone : ''].filter(Boolean).join(' · ')}
              right={kind === 'commission' ? formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency) : `${formatCount(a.referrals)} ref.`}
              tags={[`${formatCount(a.referrals)} patient${a.referrals === 1 ? '' : 's'}`, `${formatMoney(a.revenue[a.branch.currency] ?? 0, a.branch.currency)} billed`, kind === 'referrals' ? `${formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency)} commission` : '']}
            />
          ),
        })),
      };
    }
    case 'hospitals': {
      const list = hospitalRanking(ids, range);
      return {
        total: formatCount(list.reduce((s, h) => s + h.referrals, 0)),
        totalLabel: 'Referrals from hospitals',
        countText: `${formatCount(list.length)} hospitals`,
        byBranch: [],
        rows: list.map((h, i) => ({
          key: h.key,
          text: norm(`${h.name} ${h.rawVariants.join(' ')}`),
          render: () => <Line onClick={() => x.open({ kind: 'hospital', key: h.key, name: h.name })} sticker="hospital" tint="bg-tint-blue" title={`${i + 1}. ${h.name}`} sub={`${h.activeAgents} of ${h.agentCount} agents referred`} right={`${formatCount(h.referrals)} ref.`} tags={[formatMoney(h.revenue[c0] ?? 0, c0) + ' billed']} />,
        })),
      };
    }
    case 'services': {
      const list = serviceRanking(ids, range).filter((s) => s.count > 0);
      return {
        total: formatCount(list.reduce((s, v) => s + v.count, 0)),
        totalLabel: 'Tests performed',
        countText: `${formatCount(list.length)} different services`,
        byBranch: [],
        rows: list.map((s, i) => ({
          key: String(s.id),
          text: norm(`${s.name} ${s.category}`),
          render: () => <Line onClick={() => x.open({ kind: 'service', id: s.id, name: s.name })} service={s.name} title={`${i + 1}. ${s.name}`} sub={s.category} right={`×${formatCount(s.count)}`} tags={[`${formatCount(s.count)} patient${s.count === 1 ? '' : 's'}`, formatMoney(s.revenue[c0] ?? 0, c0) + ' billed']} />,
        })),
      };
    }
  }
}

/* ─────────────── a single record, stacked on top ─────────────── */

/** Opens the right slide-up for a record; its own date filter starts from the list's dates. */
export function FocusSheet({ focus, branchIds, period: start, onClose }: { focus: Focus; branchIds: string[]; period: PeriodSelection; onClose: () => void }) {
  switch (focus.kind) {
    case 'visit':
      return <VisitSheet visit={focus.visit} onClose={onClose} />;
    case 'service':
      return <ServiceSheet id={focus.id} name={focus.name} branchIds={branchIds} start={start} onClose={onClose} />;
    case 'agent':
      return <AgentProfileSheet id={focus.id} branchIds={branchIds} period={start} onClose={onClose} />;
    case 'hospital':
      return <HospitalSheet hkey={focus.key} name={focus.name} branchIds={branchIds} start={start} onClose={onClose} />;
  }
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Shared bits of the record sheets: their own dates and search, a visit list and a stacked record. */
/** Context for visit rows: who processed it, who referred, and opening a record on top. */
export function useRowCtx(open: (f: Focus) => void): Ctx {
  const team = useTeam();
  const { agents } = useCompany();
  const agentName = (id: number | null) => (id == null ? null : (agents.find((a) => a.id === id)?.name ?? `PR agent #${id}`));
  return { open, team, agentName };
}

function useRecordList(start: PeriodSelection) {
  const p = useSheetPeriod(start);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<Focus | null>(null);
  const team = useTeam();
  const { agents } = useCompany();
  const agentName = (id: number | null) => (id == null ? null : (agents.find((a) => a.id === id)?.name ?? `PR agent #${id}`));
  const ctx: Ctx = { open: setFocus, team, agentName };
  return { ...p, q, setQ, t: norm(q), focus, setFocus, ctx, agents };
}

function ServiceSheet({ id, name, branchIds, start, onClose }: { id: number; name: string; branchIds: string[]; start: PeriodSelection; onClose: () => void }) {
  const L = useRecordList(start);
  const visits = useMemo(() => patientVisits(branchIds, L.range).filter((v) => v.services.some((s) => s.id === id)), [branchIds, L.range, id]);
  const priceIn = (v: PatientVisit) => v.services.filter((s) => s.id === id).reduce((a, s) => a + s.price, 0);
  const billed = visits.reduce((a, v) => a + priceIn(v), 0);
  const c = cur(branchIds[0] ?? '');
  const multi = branchIds.length > 1;
  const rows = visits.map((v) => visitRow(v, L.ctx, { amount: priceIn(v), amountNote: `of ${formatMoney(v.billed, cur(v.branchId))} bill` })).filter((r) => !L.t || r.text.includes(L.t));
  const svc = serviceByName(name);
  return (
    <Sheet back title={name} subtitle={CATEGORY.get(id) ?? 'Service'} onClose={onClose} tall search={{ value: L.q, onChange: L.setQ, placeholder: 'Search patient or ID' }} filter={L.filter}>
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#e6f8ee] to-[#cfeedd] p-4">
        <p className="text-[12.5px] font-medium text-ink-2">Patients who did this test</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{formatCount(visits.length)}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">{formatMoney(billed, c)} generated by this test</p>
        <span className="absolute -bottom-1 right-2">{svc ? <ServiceThumb service={svc} className="h-[78px] w-[78px] rounded-2xl" /> : <Sticker name="microscope" size={78} />}</span>
      </div>
      <Rows rows={rows} oneDay={L.range.days <= 1} multi={multi} empty={L.t ? `No patient matches “${L.q}”.` : 'No patient did this test in this period.'} />
      {L.focus && <FocusSheet focus={L.focus} branchIds={branchIds} period={L.period} onClose={() => L.setFocus(null)} />}
    </Sheet>
  );
}

function HospitalSheet({ hkey, name, branchIds, start, onClose }: { hkey: string; name: string; branchIds: string[]; start: PeriodSelection; onClose: () => void }) {
  const L = useRecordList(start);
  const [tab, setTab] = useState<'patients' | 'agents'>('patients');
  const agents = useMemo(() => agentRanking(branchIds, L.range).filter((a) => a.hospitalKey === hkey), [branchIds, L.range, hkey]);
  const ids = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const visits = useMemo(() => patientVisits(branchIds, L.range).filter((v) => v.agentId != null && ids.has(v.agentId)), [branchIds, L.range, ids]);
  const c = cur(branchIds[0] ?? '');
  const billed = visits.reduce((a, v) => a + v.billed, 0);
  const patientRows = visits.map((v) => visitRow(v, L.ctx)).filter((r) => !L.t || r.text.includes(L.t));
  const agentRows: Row[] = agents
    .map((a) => ({
      key: String(a.id),
      text: norm(`${a.name} ${a.phone}`),
      render: () => <Line onClick={() => L.setFocus({ kind: 'agent', id: a.id })} initials={a.name} agentId={a.id} agentPhone={a.phone} title={a.name} sub={a.phone !== 'N/A' ? a.phone : 'No phone on file'} right={formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency)} tags={[`${formatCount(a.referrals)} patient${a.referrals === 1 ? '' : 's'}`, `${formatMoney(a.revenue[a.branch.currency] ?? 0, a.branch.currency)} billed`]} />,
    }))
    .filter((r) => !L.t || r.text.includes(L.t));
  return (
    <Sheet back title={name} subtitle="Referring hospital" onClose={onClose} tall search={{ value: L.q, onChange: L.setQ, placeholder: tab === 'patients' ? 'Search patient, ID or agent' : 'Search PR agent' }} filter={L.filter}>
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#eef9ff] to-[#d7efff] p-4">
        <div className="grid max-w-[74%] grid-cols-3 gap-2">
          <Stat label="Patients" value={formatCount(visits.length)} />
          <Stat label="PR agents" value={formatCount(agents.length)} />
          <Stat label="Billed" value={formatMoney(billed, c, true)} />
        </div>
        <Sticker name="hospital" size={70} className="absolute -bottom-1 right-2" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-page p-1" role="tablist">
        {(['patients', 'agents'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`press min-h-10 rounded-xl text-[14px] font-semibold ${tab === k ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
            {k === 'patients' ? `Patients (${formatCount(visits.length)})` : `PR agents (${formatCount(agents.length)})`}
          </button>
        ))}
      </div>
      <Rows rows={tab === 'patients' ? patientRows : agentRows} oneDay={L.range.days <= 1} multi={branchIds.length > 1} empty={L.t ? `Nothing matches “${L.q}”.` : 'No referrals from this hospital in this period.'} />
      {L.focus && <FocusSheet focus={L.focus} branchIds={branchIds} period={L.period} onClose={() => L.setFocus(null)} />}
    </Sheet>
  );
}

/**
 * The patient visit record (desktop: PatientRecord / VisitSlip), as a slide-up
 * (owner, 2026-11-25: richer and more mature): a hero in the colour of the
 * payment state with an animated "paid" ring, quick actions, the visit as a
 * timeline (arrived, billed by whom, tests, payment), the people involved with
 * their photos, the bill as a receipt, and the patient's earlier visits.
 */
export function VisitSheet({ visit, onClose }: { visit: PatientVisit; onClose: () => void }) {
  const team = useTeam();
  const { agents } = useCompany();
  const { showToast } = useNav();
  const [focus, setFocus] = useState<Focus | null>(null);
  const history = useMemo(() => patientHistory(visit.branchId, visit.patientRef), [visit.branchId, visit.patientRef]);
  const visits = history.visits.length ? history.visits : [visit];
  const [selectedId, setSelectedId] = useState(visit.id);
  const v = visits.find((x) => x.id === selectedId) ?? visit;
  const branch = getBranch(v.branchId);
  const c = branch?.currency ?? 'NGN';
  const by = team.processedBy(v);
  const agent = v.agentId != null ? agents.find((a) => a.id === v.agentId) : undefined;
  const balance = v.billed - v.paid;
  const note = useBalanceNotes()(v);
  const pct = v.billed > 0 ? Math.min(1, v.paid / v.billed) : 1;
  const state = v.payment === 'Paid' ? { label: 'Paid in full', hero: 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]', ring: '#ffffff' } : v.payment === 'Part-paid' ? { label: 'Part paid', hero: 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]', ring: '#ffffff' } : { label: 'Not paid', hero: 'from-[#b42318] via-[#d93036] to-[#f0646a]', ring: '#ffffff' };
  const totals = visits.reduce((s, x) => ({ billed: s.billed + x.billed, paid: s.paid + x.paid }), { billed: 0, paid: 0 });
  const { ref, seen } = useSeen<HTMLDivElement>(0.2);
  const R = 30;
  const C = 2 * Math.PI * R;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${what} copied`);
    } catch {
      showToast(`${what}: ${text}`);
    }
  };
  const steps: { icon: ReactNode; title: string; sub: string; tone: string }[] = [
    { icon: <MapPin size={15} />, title: `Arrived at ${branch?.name ?? 'the branch'}`, sub: `${timeOf(v.at)} · ${dateOf(v.at)}`, tone: 'bg-brand-600' },
    { icon: <UserCheck size={15} />, title: `Registered and billed by ${by ? by.name : 'the front desk'}`, sub: by ? by.role : 'Name not on record', tone: 'bg-violet' },
    { icon: <Sparkles size={15} />, title: `${v.services.length} test${v.services.length === 1 ? '' : 's'} requested`, sub: v.services.map((s) => s.name).slice(0, 3).join(', ') + (v.services.length > 3 ? ` +${v.services.length - 3} more` : ''), tone: 'bg-[#0ea5e9]' },
    v.paid > 0
      ? { icon: <CreditCard size={15} />, title: `${formatMoney(v.paid, c)} paid${v.method ? ` by ${v.method}` : ''}`, sub: balance > 0 ? `${formatMoney(balance, c)} still owed${note ? ` · ${promiseText(note)}` : ''}` : 'Bill settled', tone: balance > 0 ? 'bg-[#f59e0b]' : 'bg-good' }
      : { icon: <Clock3 size={15} />, title: 'Payment pending', sub: `${formatMoney(balance, c)} owed${note ? ` · ${promiseText(note)}` : ''}`, tone: 'bg-[#ef4444]' },
  ];
  return (
    <Sheet back title="Patient visit" subtitle={`${v.patientRef} · ${dateOf(v.at)}`} onClose={onClose} tall>
      {/* Hero */}
      <div ref={ref} className={`relative mb-3 overflow-hidden rounded-[26px] bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(20,40,90,0.2)] ${state.hero}`}>
        <span aria-hidden="true" className="absolute -right-14 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-black/5" />
        <div className="relative flex items-start gap-3">
          <span className="rounded-full ring-[3px] ring-white/70">
            <InitialsAvatar name={v.patientName} size={56} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold leading-tight">{v.patientName}</p>
            <p className="mt-0.5 text-[12.5px] text-white/90">{v.isNew ? 'New patient, first visit' : visits.length > 1 ? `Returning patient · ${visits.length} visits` : 'Returning patient'}</p>
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-white/30">{v.patientRef}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11.5px] font-bold text-ink">{state.label}</span>
            </span>
          </div>
        </div>
        <div className="relative mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-white/85">Total billed</p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em]">{formatMoney(v.billed, c)}</p>
            <p className="mt-1.5 text-[12.5px] text-white/90">
              {formatMoney(v.paid, c)} paid{balance > 0 ? ` · ${formatMoney(balance, c)} owed` : ''}
            </p>
          </div>
          <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
            <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90">
              <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
              {pct > 0 && <circle cx="38" cy="38" r={R} fill="none" stroke={state.ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${seen ? pct * C : 0} ${C}`} style={{ transition: 'stroke-dasharray 1100ms cubic-bezier(0.22,0.8,0.24,1) 200ms' }} />}
            </svg>
            <span className="text-center leading-none">
              <b className="block text-[16px]">{Math.round(pct * 100)}%</b>
              <span className="text-[10px] text-white/85">paid</span>
            </span>
          </div>
        </div>
      </div>

      {/* Why there is a balance (desktop: reason, approver and promised date on the bill) */}
      {note && (
        <div className="mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#fff7ec] to-[#ffeccf] p-4 ring-1 ring-[#ffe0b8]">
          <p className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-[#9a4a07]">
            {v.paid > 0 ? 'Why the rest is unpaid' : 'Why nothing was paid'}
            {note.sample && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] font-semibold text-[#b45309]">Sample note</span>}
          </p>
          <p className="mt-1 text-[15.5px] font-semibold leading-snug text-ink">“{note.reason}”</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-2xl bg-white/85 p-2.5">
              <p className="text-[11px] text-muted">Expected payment</p>
              <p className="text-[14px] font-bold text-ink">{note.promise ? note.promise.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Not given'}</p>
              {note.promise && (
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${note.overdueDays > 0 ? 'bg-[#fdecec] text-[#b42318]' : 'bg-tint-green text-good-ink'}`}>
                  {note.overdueDays > 0 ? `Overdue by ${note.overdueDays} day${note.overdueDays === 1 ? '' : 's'}` : (() => {
                    const d = Math.round((note.promise.getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
                    return d === 0 ? 'Due today' : `In ${d} day${d === 1 ? '' : 's'}`;
                  })()}
                </span>
              )}
            </div>
            <div className="min-w-0 rounded-2xl bg-white/85 p-2.5">
              <p className="text-[11px] text-muted">Balance approved by</p>
              <span className="mt-1 flex items-center gap-1.5">
                {note.approvedBy?.photo ? <img src={note.approvedBy.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <InitialsAvatar name={note.approvedBy?.name ?? 'Staff'} size={28} />}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-ink">{note.approvedBy?.name ?? 'Not recorded'}</span>
                  <span className="block truncate text-[10.5px] text-muted">{note.approvedBy?.role ?? ''}</span>
                </span>
              </span>
            </div>
          </div>
          {v.phone && note.overdueDays > 0 && (
            <a href={`tel:${v.phone.replace(/\s+/g, '')}`} className="press mt-2.5 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-semibold text-[#b42318] ring-1 ring-[#f9d4d4]">
              <Phone size={15} /> Call to remind {v.patientName.split(' ')[0]}
            </a>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {v.phone ? (
          <a href={`tel:${v.phone.replace(/\s+/g, '')}`} className="press flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold text-brand-700 ring-1 ring-line/70">
            <Phone size={18} /> Call patient
          </a>
        ) : (
          <span className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold text-faint ring-1 ring-line/70">
            <Phone size={18} /> No phone
          </span>
        )}
        <button type="button" onClick={() => copy(v.patientRef, 'Patient ID')} className="press flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold text-brand-700 ring-1 ring-line/70">
          <Copy size={17} /> Copy ID
        </button>
        <button type="button" disabled={v.agentId == null} onClick={() => v.agentId != null && setFocus({ kind: 'agent', id: v.agentId })} className="press flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold text-violet ring-1 ring-line/70 disabled:text-faint">
          <Handshake size={18} /> {v.agentId != null ? 'Referrer' : 'Walk in'}
        </button>
      </div>

      {/* Timeline */}
      <div className="mb-3 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <p className="mb-3 text-[13px] font-semibold text-ink-2">How the visit went</p>
        <ol className="relative">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0" style={{ opacity: seen ? 1 : 0, transform: seen ? 'none' : 'translateY(8px)', transition: `opacity 450ms ease ${250 + i * 120}ms, transform 450ms ease ${250 + i * 120}ms` }}>
              {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5 rounded-full bg-[#e3ebf7]" />}
              <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-sm ${s.tone}`}>{s.icon}</span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-[14px] font-semibold leading-snug text-ink">{s.title}</span>
                <span className="block text-[12px] leading-snug text-muted">{s.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* People */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-[20px] bg-linear-to-br from-[#f4f8fe] to-[#e8f1ff] p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] font-medium text-muted">Processed by</p>
          <span className="mt-2 flex items-center gap-2">
            {by?.photo ? <img src={by.photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white" /> : <InitialsAvatar name={by?.name ?? 'Front Desk'} size={40} />}
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-ink">{by?.name ?? 'Not on record'}</span>
              <span className="block truncate text-[11.5px] text-muted">{by?.role ?? (v.processedBy.role === 'Receptionist' ? 'Front Desk' : v.processedBy.role)}</span>
            </span>
          </span>
        </div>
        <button type="button" disabled={v.agentId == null} onClick={() => v.agentId != null && setFocus({ kind: 'agent', id: v.agentId })} className="press min-w-0 rounded-[20px] bg-linear-to-br from-[#f7f3ff] to-[#ece5ff] p-3 text-left ring-1 ring-line/70">
          <p className="flex items-center justify-between text-[11.5px] font-medium text-muted">
            Referred by {v.agentId != null && <ChevronRight size={14} className="text-faint" />}
          </p>
          <span className="mt-2 flex items-center gap-2">
            {v.agentId != null ? <AgentAvatar id={v.agentId} name={agent?.name ?? 'PR agent'} phone={agent?.phone} size={40} /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><Sticker name="hospital" size={26} /></span>}
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-ink">{agent ? agent.name : v.agentId != null ? `PR agent #${v.agentId}` : 'Walk in'}</span>
              <span className="block truncate text-[11.5px] text-muted">{agent?.hospital.trim() ? agent.hospital.trim().toUpperCase() : v.agentId != null ? 'PR agent' : 'No referrer'}</span>
            </span>
          </span>
        </button>
      </div>

      {/* Bill as a receipt */}
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70">
        <div className="flex items-center justify-between bg-linear-to-r from-[#eef5ff] to-[#f7faff] px-4 py-3">
          <span>
            <span className="block text-[14px] font-bold text-ink">Bill</span>
            <span className="block text-[11.5px] text-muted">
              {v.id} · {branch?.name ?? ''} {branch?.code ? `· ${branch.code}` : ''}
            </span>
          </span>
          <Sticker name="clipboard" size={34} />
        </div>
        <ul className="divide-y divide-dashed divide-line px-3">
          {v.services.map((s, i) => {
            const svc = serviceByName(s.name);
            return (
              <li key={`${s.id}-${i}`} className="flex items-center gap-3 py-2.5">
                {svc ? <ServiceThumb service={svc} className="h-10 w-10 shrink-0 rounded-xl" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-page"><Sticker name="testTube" size={26} /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{s.name}</span>
                  <span className="block text-[11.5px] text-muted">{CATEGORY.get(s.id) ?? 'Service'} · #{s.id}</span>
                </span>
                <b className="shrink-0 text-[14px] text-ink">{formatMoney(s.price, c)}</b>
              </li>
            );
          })}
        </ul>
        <div className="relative mt-1 bg-page px-4 pb-4 pt-4 text-[14px]">
          <span aria-hidden="true" className="absolute inset-x-0 -top-[7px] h-[14px]" style={{ background: 'radial-gradient(circle at 7px 0, transparent 6px, #f4f8fe 6.5px) repeat-x', backgroundSize: '14px 14px' }} />
          <p className="flex justify-between text-ink-2">
            Total billed <b className="text-ink">{formatMoney(v.billed, c)}</b>
          </p>
          <p className="mt-1 flex justify-between text-ink-2">
            Paid{v.method ? ` · ${v.method}` : ''} <b className="text-good-ink">{formatMoney(v.paid, c)}</b>
          </p>
          <p className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 font-semibold ${balance > 0 ? 'bg-[#fdecec] text-[#b42318]' : 'bg-tint-green text-good-ink'}`}>
            {balance > 0 ? 'Balance due' : 'Fully paid'} <b>{formatMoney(balance, c)}</b>
          </p>
        </div>
      </div>

      {/* History */}
      {visits.length > 1 && (
        <div className="rounded-[22px] bg-white p-4 ring-1 ring-line/70">
          <p className="mb-3 flex items-center justify-between text-[13px] font-semibold text-ink-2">
            Visit history <span className="font-medium text-muted">{formatMoney(totals.billed, c, true)} billed · {formatMoney(totals.billed - totals.paid, c, true)} owed</span>
          </p>
          <ol className="relative">
            {[...visits].reverse().map((x, i, all) => (
              <li key={x.id} className="relative pb-2 last:pb-0">
                {i < all.length - 1 && <span aria-hidden="true" className="absolute left-[11px] top-7 h-[calc(100%-16px)] w-0.5 bg-[#e3ebf7]" />}
                <button type="button" onClick={() => setSelectedId(x.id)} aria-current={x.id === v.id} className={`press relative flex w-full items-center gap-3 rounded-2xl py-2 pl-0 pr-3 text-left ${x.id === v.id ? 'bg-brand-50' : ''}`}>
                  <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-4 ring-white ${x.payment === 'Paid' ? 'bg-good' : x.payment === 'Part-paid' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`}>
                    {x.id === v.id && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink">{dateOf(x.at)}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {x.services.length} test{x.services.length === 1 ? '' : 's'} · {x.payment === 'Part-paid' ? 'Part paid' : x.payment}
                      {x.id === v.id ? ' · showing' : ''}
                    </span>
                  </span>
                  <b className="shrink-0 text-[13.5px] text-ink">{formatMoney(x.billed, c, true)}</b>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {focus && <FocusSheet focus={focus} branchIds={[v.branchId]} period={{ key: 'custom', from: iso(v.at), to: iso(v.at) }} onClose={() => setFocus(null)} />}
    </Sheet>
  );
}

/* ─────────────── pieces (same card language as the clinician app) ─────────────── */

export function Rows({ rows, oneDay, multi, empty }: { rows: Row[]; oneDay: boolean; multi: boolean; empty: string }) {
  const [shown, setShown] = useState(PAGE);
  if (!rows.length) return <p className="px-4 py-10 text-center text-[14px] text-muted">{empty}</p>;
  return (
    <>
      <ul className="space-y-2">
        {rows.slice(0, shown).map((r) => (
          <li key={r.key}>{r.render(oneDay, multi)}</li>
        ))}
      </ul>
      {shown < rows.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="press mx-auto mt-3 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({formatCount(rows.length - shown)} more)
        </button>
      )}
    </>
  );
}

function SummaryCard({ tone, sticker, label, total, count, note }: { tone: string; sticker: StickerKey; label: string; total: string; count: string; note: string }) {
  return (
    <div className={`relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br p-4 ${tone}`}>
      <p className="text-[12.5px] font-medium text-ink-2">{label}</p>
      <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{total}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-2">{count}</p>
      <p className="mt-2 max-w-[70%] text-[12px] leading-snug text-ink-2/80">{note}</p>
      <Sticker name={sticker} size={86} className="absolute -bottom-2 -right-1 rotate-[-6deg]" />
    </div>
  );
}

function Chip({ on, label, sub, onClick }: { on: boolean; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`press shrink-0 rounded-2xl px-3.5 py-2 text-left ${on ? 'bg-brand-600 text-white shadow-[0_6px_16px_rgba(31,111,232,0.28)]' : 'bg-white text-ink ring-1 ring-line'}`}>
      <span className="block text-[13.5px] font-semibold">{label}</span>
      <span className={`block text-[11.5px] ${on ? 'text-white/85' : 'text-muted'}`}>{sub}</span>
    </button>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="min-w-0 rounded-2xl bg-white/70 px-2.5 py-2">
      <span className="block text-[11px] text-ink-2">{label}</span>
      <b className={`block truncate text-[15px] ${strong ? 'text-violet' : 'text-ink'}`}>{value}</b>
    </span>
  );
}

function Fact({ icon, label, value, sub, photo, onClick }: { icon: ReactNode; label: string; value: string; sub?: string; photo?: Who | null; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
        {icon}
        {label}
      </span>
      <span className="mt-1 flex items-center gap-2">
        {photo && (photo.photo ? <img src={photo.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <InitialsAvatar name={photo.name} size={28} />)}
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-ink">{value}</span>
          {sub && <span className="block truncate text-[11.5px] text-muted">{sub}</span>}
        </span>
        {onClick && <ChevronRight size={16} className="ml-auto shrink-0 text-faint" />}
      </span>
    </>
  );
  const cls = 'min-w-0 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70';
  return onClick ? (
    <button type="button" onClick={onClick} className={`press ${cls}`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Line({ title, sub, right, tags, initials, agentId, agentPhone, sticker, tint = 'bg-tint-orange', service, onClick }: { title: string; sub?: string; right: string; tags?: string[]; initials?: string; agentId?: number; agentPhone?: string; sticker?: StickerKey; tint?: string; service?: string; onClick?: () => void }) {
  const svc = service ? serviceByName(service) : undefined;
  const inner = (
    <>
      {initials && agentId != null ? (
        <AgentAvatar id={agentId} name={initials} phone={agentPhone} size={44} />
      ) : initials ? (
        <InitialsAvatar name={initials} size={44} />
      ) : svc ? (
        <ServiceThumb service={svc} className="h-11 w-11 shrink-0 rounded-xl" />
      ) : (
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}>
          <Sticker name={sticker ?? 'clipboard'} size={30} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{title}</span>
          <span className="shrink-0 text-[14.5px] font-bold text-ink">{right}</span>
        </span>
        {sub && <span className="block truncate text-[12.5px] text-muted">{sub}</span>}
        {tags && tags.filter(Boolean).length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.filter(Boolean).map((t) => (
              <span key={t} className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
      {onClick && <ChevronRight size={17} className="mt-3 shrink-0 text-faint" />}
    </>
  );
  const cls = 'flex w-full items-start gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70';
  return onClick ? (
    <button type="button" onClick={onClick} className={`press ${cls}`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export interface VisitRowProps {
  v: PatientVisit;
  oneDay: boolean;
  multi: boolean;
  by: Who | null;
  agent: string | null;
  onOpen: () => void;
  amount?: number;
  amountNote?: string;
  at?: Date;
  tag?: string;
  method?: PaymentMethod | null;
  danger?: boolean;
  longDate?: boolean;
}

/** A patient visit card; tap for the full visit record. */
function VisitRow({ v, oneDay, multi, by, agent, onOpen, amount, amountNote, at, tag, method, danger, longDate }: VisitRowProps) {
  const c = cur(v.branchId);
  const note = useBalanceNotes()(v);
  const status = v.paid >= v.billed ? { t: 'Paid', cls: 'bg-tint-green text-good-ink' } : v.paid > 0 ? { t: 'Part paid', cls: 'bg-[#fff1e0] text-[#b45309]' } : { t: 'Not paid', cls: 'bg-[#fdecec] text-[#b42318]' };
  const tests = v.services.map((s) => s.name);
  return (
    <button type="button" onClick={onOpen} className="press block w-full rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
      <span className="flex items-start gap-3">
        <InitialsAvatar name={v.patientName} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{v.patientName}</span>
            <span className={`shrink-0 text-[14.5px] font-bold ${danger ? 'text-[#b42318]' : 'text-ink'}`}>{formatMoney(amount ?? v.billed, c)}</span>
          </span>
          <span className="flex justify-between gap-2 text-[12.5px] text-muted">
            <span className="truncate">{[v.patientRef, multi ? branchName(v.branchId) : '', when(at ?? v.at, oneDay && !longDate)].filter(Boolean).join(' · ')}</span>
            {amountNote && <span className="shrink-0">{amountNote}</span>}
          </span>
          <span className="block truncate text-[12.5px] text-ink-2">{tests.slice(0, 2).join(', ') + (tests.length > 2 ? ` +${tests.length - 2} more` : '')}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${status.cls}`}>{status.t}</span>
            {v.isNew && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700">New patient</span>}
            {method && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{method}</span>}
            {tag && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{tag}</span>}
          </span>
          {note && (
            <span className={`mt-1.5 flex items-start gap-1.5 rounded-xl px-2 py-1.5 text-[11.5px] leading-snug ${note.overdueDays > 0 ? 'bg-[#fdecec] text-[#9b1c1c]' : 'bg-[#fff7ec] text-[#9a4a07]'}`}>
              <Clock3 size={13} className="mt-px shrink-0" />
              <span className="min-w-0">
                <b className="font-semibold">{promiseText(note)}{note.overdueDays > 0 ? ` · ${note.overdueDays} day${note.overdueDays === 1 ? '' : 's'} late` : ''}</b>
                <span className="block truncate">{note.reason}</span>
              </span>
            </span>
          )}
          <span className="mt-2 flex flex-col gap-0.5 border-t border-line/80 pt-2 text-[12px] text-muted">
            <span className="flex items-start gap-1.5">
              <UserCheck size={13} className="mt-0.5 shrink-0" />
              <span>
                Processed by <b className="font-semibold text-ink-2">{by ? `${by.name}, ${by.role}` : 'name not on record'}</b>
              </span>
            </span>
            {agent && (
              <span className="flex items-center gap-1.5 truncate">
                <Users size={13} className="shrink-0" />
                <span className="truncate">
                  Referred by <b className="font-semibold text-violet">{agent}</b>
                </span>
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={17} className="mt-3 shrink-0 text-faint" />
      </span>
    </button>
  );
}

/** An expense; tap to drop down what it was for, who recorded and approved it, and when. */
export function ExpenseRow({ e, oneDay, multi, people }: { e: ExpenseLine; oneDay: boolean; multi: boolean; people: ReturnType<ReturnType<typeof useTeam>['expensePeople']> }) {
  const [open, setOpen] = useState(false);
  const c = cur(e.branchId);
  const branch = getBranch(e.branchId);
  const { recordedBy, approvedBy, approvedAt } = people;
  return (
    <div className={`rounded-[18px] bg-white ring-1 ${open ? 'ring-[#ffd3a8]' : 'ring-line/70'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-start gap-3 p-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint-orange">
          <Sticker name="clipboard" size={30} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{e.description}</span>
            <span className="shrink-0 text-[14.5px] font-bold text-ink">{formatMoney(e.amount, c)}</span>
          </span>
          <span className="block truncate text-[12.5px] text-muted">{[e.category, multi ? branchName(e.branchId) : '', when(e.at, oneDay)].filter(Boolean).join(' · ')}</span>
          <span className="mt-1 block text-[12px] leading-snug text-muted">
            Approved by <b className="font-semibold text-ink-2">{`${approvedBy.name}, ${approvedBy.role}`}</b>
          </span>
        </span>
        <ChevronDown size={17} className={`mt-3 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="drop-down mx-3 mb-3 divide-y divide-line rounded-2xl bg-page text-[13.5px]">
          <Detail label="What it was for" value={e.description} sub={e.category} />
          <Detail label="Amount" value={formatMoney(e.amount, c)} />
          <Detail label="Date and time" value={`${dateOf(e.at)}, ${timeOf(e.at)}`} />
          <Detail label="Recorded by" person={recordedBy} value={recordedBy ? recordedBy.name : 'Name not on record'} sub={recordedBy?.role} />
          <Detail label="Approved by" person={approvedBy} value={approvedBy.name} sub={`${approvedBy.role} · ${dateOf(approvedAt)}, ${timeOf(approvedAt)}`} />
          <Detail label="Branch" value={branch ? `${branch.name} · ${branch.code}` : e.branchId} />
          <Detail label="Reference" value={e.id} sub={e.status} />
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, sub, person }: { label: string; value: string; sub?: string; person?: Who | null }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <span className="shrink-0 pt-0.5 text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right">
        <span className="min-w-0">
          <span className="block font-semibold text-ink">{value}</span>
          {sub && <span className="block text-[12px] text-muted">{sub}</span>}
        </span>
        {person && (person.photo ? <img src={person.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <InitialsAvatar name={person.name} size={32} />)}
      </span>
    </div>
  );
}
