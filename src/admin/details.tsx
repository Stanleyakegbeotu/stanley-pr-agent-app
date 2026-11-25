/**
 * What's behind a figure (owner, 2026-11-25): tapping any admin card opens a
 * slide-up card listing every record that makes up the figure, for the branch
 * scope being viewed (all branches, or one). Same records as the desktop
 * (src/company dailyLines / analytics), so the list always adds up to the card.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Hospital } from 'lucide-react';
import { getBranch } from '@company/data/company';
import type { Currency, DateRange } from '@company/data/types';
import { expenseLines, ledger, openBalances, patientVisits, type PatientVisit } from '@company/data/demo/dailyLines';
import { agentRanking, hospitalRanking, serviceRanking } from '@company/services/analytics';
import { formatCount, formatMoney } from '@company/shared/format';
import { serviceByName } from '@/data/services';
import { InitialsAvatar, ServiceThumb, Sticker } from '@/ui/kit';
import type { StickerKey } from '@/assets';
import { Sheet } from './ui';

export type DetailKind = 'revenue' | 'payments' | 'patients' | 'expenses' | 'outstanding' | 'commission' | 'referrals' | 'hospitals' | 'services';

const PAGE = 30;
const branchName = (id: string) => getBranch(id)?.name ?? id;
const cur = (id: string): Currency => getBranch(id)?.currency ?? 'NGN';
const when = (d: Date, oneDay: boolean) => (oneDay ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

const META: Record<DetailKind, { title: string; sticker: StickerKey; tone: string; note: string }> = {
  revenue: { title: 'Revenue generated', sticker: 'chart', tone: 'from-[#e8f1ff] to-[#d6e6ff]', note: 'Every visit billed in this period. Revenue is billed value, not money received.' },
  payments: { title: 'Payments received', sticker: 'moneyBag', tone: 'from-[#e6f8ee] to-[#cfeedd]', note: 'Every receipt: payments at the visit and balances recovered from earlier visits.' },
  patients: { title: 'Patients attended', sticker: 'stethoscope', tone: 'from-[#eef0ff] to-[#dfe3ff]', note: 'Each patient visit in this period. New patients are marked.' },
  expenses: { title: 'Expenses incurred', sticker: 'clipboard', tone: 'from-[#fff3e2] to-[#ffe4c2]', note: 'Approved expenses by expense date.' },
  outstanding: { title: 'Outstanding balances', sticker: 'calendar', tone: 'from-[#fdecec] to-[#f9d6d6]', note: 'Bills still owing at the end of the period, oldest first.' },
  commission: { title: 'PR commissions earned', sticker: 'coin', tone: 'from-[#f3eeff] to-[#e4dbff]', note: 'Commission accrued to each PR agent on the referred patients completed in this period.' },
  referrals: { title: 'Referrals by PR agent', sticker: 'stethoscope', tone: 'from-[#eaf3ff] to-[#d9e9ff]', note: 'Every PR agent who referred patients in this period.' },
  hospitals: { title: 'Referring hospitals', sticker: 'hospital', tone: 'from-[#eef9ff] to-[#d7efff]', note: 'Hospitals ranked by referrals from their PR agents.' },
  services: { title: 'Diagnostic services', sticker: 'microscope', tone: 'from-[#e6f8ee] to-[#cfeedd]', note: 'Every service performed in this period, with its billed value.' },
};

export function DetailSheet({ kind, branchIds, range, periodText, scopeText, onClose }: { kind: DetailKind; branchIds: string[]; range: DateRange; periodText: string; scopeText: string; onClose: () => void }) {
  const m = META[kind];
  const oneDay = range.days <= 1;
  const multi = branchIds.length > 1;
  const body = useMemo(() => build(kind, branchIds, range), [kind, branchIds.join(','), range.from.getTime(), range.to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shown, setShown] = useState(PAGE);
  return (
    <Sheet title={m.title} subtitle={`${scopeText} · ${periodText}`} onClose={onClose} tall={body.rows.length > 6}>
      <div className={`relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br p-4 ${m.tone}`}>
        <p className="text-[12.5px] font-medium text-ink-2">{body.totalLabel}</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{body.total}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">{body.countText}</p>
        <p className="mt-2 max-w-[70%] text-[12px] leading-snug text-ink-2/80">{m.note}</p>
        <Sticker name={m.sticker} size={86} className="absolute -bottom-2 -right-1 rotate-[-6deg]" />
      </div>
      {multi && body.byBranch.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto px-1">
          {body.byBranch.map((b) => (
            <span key={b.label} className="shrink-0 rounded-full bg-page px-3 py-1.5 text-[12.5px] text-ink-2">
              {b.label} <b className="text-ink">{b.value}</b>
            </span>
          ))}
        </div>
      )}
      {body.rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-[14px] text-muted">Nothing recorded in this period.</p>
      ) : (
        <ul className="space-y-2">
          {body.rows.slice(0, shown).map((r) => (
            <li key={r.key}>{r.render(oneDay, multi)}</li>
          ))}
        </ul>
      )}
      {shown < body.rows.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="press mx-auto mt-3 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({formatCount(body.rows.length - shown)} more)
        </button>
      )}
    </Sheet>
  );
}

interface Body {
  total: string;
  totalLabel: string;
  countText: string;
  byBranch: { label: string; value: string }[];
  rows: { key: string; render: (oneDay: boolean, multi: boolean) => ReactNode }[];
}

function sumBy<T>(items: T[], branch: (t: T) => string, amount: (t: T) => number, fmt: (v: number, b: string) => string) {
  const m = new Map<string, number>();
  for (const t of items) m.set(branch(t), (m.get(branch(t)) ?? 0) + amount(t));
  return [...m.entries()].map(([b, v]) => ({ label: branchName(b), value: fmt(v, b) }));
}
const money = (v: number, b: string) => formatMoney(v, cur(b));

function build(kind: DetailKind, ids: string[], range: DateRange): Body {
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
        rows: visits.map((v) => ({ key: v.id, render: (oneDay, multi) => <VisitRow v={v} oneDay={oneDay} multi={multi} /> })),
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
        rows: ins.map((e) => ({
          key: e.id,
          render: (oneDay, multi) =>
            e.visit ? (
              <VisitRow v={e.visit} oneDay={oneDay} multi={multi} amount={e.amount} at={e.at} tag={e.kind === 'recovery' ? 'Balance recovered' : 'Paid at visit'} method={e.method} />
            ) : (
              <Row title={e.source} sub={[e.category, multi ? branchName(e.branchId) : '', when(e.at, oneDay)].filter(Boolean).join(' · ')} right={money(e.amount, e.branchId)} />
            ),
        })),
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
        rows: lines.map((e) => ({ key: e.id, render: (oneDay, multi) => <Row sticker="clipboard" title={e.description} sub={[e.category, multi ? branchName(e.branchId) : '', when(e.at, oneDay)].filter(Boolean).join(' · ')} right={money(e.amount, e.branchId)} /> })),
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
        rows: open.map((o) => ({
          key: o.visit.id,
          render: (_oneDay, multi) => <VisitRow v={o.visit} oneDay={false} multi={multi} amount={o.remaining} tag={`${o.ageDays} day${o.ageDays === 1 ? '' : 's'} old · ${money(o.repaid, o.visit.branchId)} repaid of ${money(o.owed, o.visit.branchId)}`} danger />,
        })),
      };
    }
    case 'commission':
    case 'referrals': {
      const agents = agentRanking(ids, range);
      const totalC = agents.reduce((s, a) => s + (a.commission[c0] ?? 0), 0);
      const totalR = agents.reduce((s, a) => s + a.referrals, 0);
      return {
        total: kind === 'commission' ? formatMoney(totalC, c0) : formatCount(totalR),
        totalLabel: kind === 'commission' ? 'Commission accrued' : 'Referrals',
        countText: `${formatCount(agents.length)} PR agents · ${kind === 'commission' ? `${formatCount(totalR)} referrals` : formatMoney(totalC, c0) + ' commission'}`,
        byBranch: sumBy(agents, (a) => a.branch.id, (a) => (kind === 'commission' ? a.commission[a.branch.currency] ?? 0 : a.referrals), (v, b) => (kind === 'commission' ? money(v, b) : formatCount(v))),
        rows: (kind === 'commission' ? [...agents].sort((a, b) => (b.commission[c0] ?? 0) - (a.commission[c0] ?? 0)) : agents).map((a, i) => ({
          key: String(a.id),
          render: (_o, multi) => (
            <Row
              initials={a.name}
              title={`${i + 1}. ${a.name}`}
              sub={[a.hospitalKey || 'No hospital assigned', multi ? a.branch.name : '', a.phone !== 'N/A' ? a.phone : ''].filter(Boolean).join(' · ')}
              right={kind === 'commission' ? formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency) : `${formatCount(a.referrals)} ref.`}
              tags={[`${formatCount(a.referrals)} referral${a.referrals === 1 ? '' : 's'}`, `${formatMoney(a.revenue[a.branch.currency] ?? 0, a.branch.currency)} billed`, kind === 'referrals' ? `${formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency)} commission` : '']}
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
        rows: list.map((h, i) => ({ key: h.key, render: () => <Row icon={<Hospital size={20} />} title={`${i + 1}. ${h.name}`} sub={`${h.activeAgents} of ${h.agentCount} agents referred`} right={`${formatCount(h.referrals)} ref.`} tags={[formatMoney(h.revenue[c0] ?? 0, c0) + ' billed']} /> })),
      };
    }
    case 'services': {
      const list = serviceRanking(ids, range).filter((s) => s.count > 0);
      return {
        total: formatCount(list.reduce((s, x) => s + x.count, 0)),
        totalLabel: 'Tests performed',
        countText: `${formatCount(list.length)} different services`,
        byBranch: [],
        rows: list.map((s, i) => ({ key: String(s.id), render: () => <Row service={s.name} title={`${i + 1}. ${s.name}`} sub={s.category} right={formatCount(s.count)} tags={[formatMoney(s.revenue[c0] ?? 0, c0) + ' billed']} /> })),
      };
    }
  }
}

/* ─────────────── rows (same card language as the clinician app) ─────────────── */

function Row({ title, sub, right, tags, initials, icon, sticker, service }: { title: string; sub?: string; right: string; tags?: string[]; initials?: string; icon?: ReactNode; sticker?: StickerKey; service?: string }) {
  const svc = service ? serviceByName(service) : undefined;
  return (
    <div className="flex items-start gap-3 rounded-[18px] bg-white p-3 ring-1 ring-line/70">
      {initials ? (
        <InitialsAvatar name={initials} size={44} />
      ) : svc ? (
        <ServiceThumb service={svc} className="h-11 w-11 shrink-0 rounded-xl" />
      ) : sticker ? (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint-orange">
          <Sticker name={sticker} size={30} />
        </span>
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint-blue text-brand-600">{icon}</span>
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
    </div>
  );
}

/** A patient visit; tap to see every test, who processed it and how it was paid. */
function VisitRow({ v, oneDay, multi, amount, at, tag, method, danger }: { v: PatientVisit; oneDay: boolean; multi: boolean; amount?: number; at?: Date; tag?: string; method?: string | null; danger?: boolean }) {
  const [open, setOpen] = useState(false);
  const c = cur(v.branchId);
  const status = v.paid >= v.billed ? { t: 'Paid', cls: 'bg-tint-green text-good-ink' } : v.paid > 0 ? { t: 'Part paid', cls: 'bg-[#fff1e0] text-[#b45309]' } : { t: 'Not paid', cls: 'bg-[#fdecec] text-[#b42318]' };
  const tests = v.services.map((s) => s.name);
  return (
    <button type="button" onClick={() => setOpen((x) => !x)} className="press block w-full rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
      <span className="flex items-start gap-3">
        <InitialsAvatar name={v.patientName} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{v.patientName}</span>
            <span className={`shrink-0 text-[14.5px] font-bold ${danger ? 'text-[#b42318]' : 'text-ink'}`}>{formatMoney(amount ?? v.billed, c)}</span>
          </span>
          <span className="block truncate text-[12.5px] text-muted">{[v.patientRef, multi ? branchName(v.branchId) : '', when(at ?? v.at, oneDay)].filter(Boolean).join(' · ')}</span>
          <span className="block truncate text-[12.5px] text-ink-2">{tests.slice(0, 2).join(', ') + (tests.length > 2 ? ` +${tests.length - 2} more` : '')}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${status.cls}`}>{status.t}</span>
            {v.isNew && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700">New patient</span>}
            {v.agentId != null && <span className="rounded-full bg-tint-purple px-2 py-0.5 text-[11.5px] font-semibold text-violet">Referred</span>}
            {method && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{method}</span>}
            {tag && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{tag}</span>}
          </span>
        </span>
        <ChevronDown size={17} className={`mt-1 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </span>
      {open && (
        <span className="mt-3 block rounded-2xl bg-page p-3 text-[13px]">
          {v.services.map((s) => (
            <span key={s.id} className="flex justify-between gap-3 py-0.5">
              <span className="min-w-0 truncate text-ink">{s.name}</span>
              <span className="shrink-0 font-semibold text-ink">{formatMoney(s.price, c)}</span>
            </span>
          ))}
          <span className="mt-2 flex justify-between border-t border-line pt-2 text-ink">
            <span>Billed / paid</span>
            <b>
              {formatMoney(v.billed, c)} / {formatMoney(v.paid, c)}
            </b>
          </span>
          <span className="mt-1 block text-muted">
            {branchName(v.branchId)} branch · processed by {v.processedBy.name ?? v.processedBy.role}
            {v.phone ? ` · ${v.phone}` : ''}
          </span>
        </span>
      )}
    </button>
  );
}
