/**
 * Company Admin Dashboard (mobile). Same sections, order and figures as the
 * desktop CompanyDashboard (features/company/CompanyDashboard.tsx):
 *  welcome + live strip, 1 Quick Stats (6 KPIs), 3 Payments received,
 *  4 Branch performance, 5 Referral performance (hospitals + PR agents),
 *  6 Expenses & patients, 7 Top diagnostic services.
 * Every figure comes from the shared desktop logic (src/company).
 */
import { useMemo } from 'react';
import { ChartLine, Clock3, CreditCard, FileText, FlaskConical, Hospital, Percent, Stethoscope, TrendingUp, UserRound } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import type { Currency } from '@company/data/types';
import { agentRanking, branchPerformance, byBranch, compareCount, compareMoney, expenseMix, hospitalRanking, paymentMix, periodLabel, resolveBranchIds, serviceRanking, unassignedReferrals } from '@company/services/analytics';
import { useDashboardData } from '../useDashboardData';
import { OPERATING_CONTRIBUTION_RULE } from '@company/services/businessRules';
import { formatCount, formatMoney, greeting } from '@company/shared/format';
import { AdminHeader, BarList, Card, Delta, Empty, Kpi, MoneyValue, PALETTE, SectionHead, ShareBar } from '../ui';

const firstPct = (p: Partial<Record<Currency, number | null>>) => Object.values(p)[0] ?? null;

export function AdminDashboard() {
  const { context, period, user, navigate } = useCompany();
  const branchIds = useMemo(() => resolveBranchIds(context), [context]);
  const { range, summary, prior } = useDashboardData(branchIds, period);
  const focus = context === 'all' ? null : getBranch(context);
  const scopeName = focus ? `${focus.name} branch` : 'All branches';
  const currencies = summary.currencies.length ? summary.currencies : (['NGN'] as Currency[]);
  const c0 = currencies[0]!;
  const fmt = (v: number, c: Currency = c0) => formatMoney(v, c);

  const data = useMemo(() => {
    const agents = agentRanking(branchIds, range);
    return {
      payMix: currencies.map((c) => ({ c, parts: paymentMix(branchIds, range, c) })),
      collections: currencies.map((c) => ({ c, rows: byBranch(range, c, 'payments', branchIds) })),
      branches: branchPerformance(range).filter((b) => !focus || b.branch.id === focus.id),
      hospitals: hospitalRanking(branchIds, range).slice(0, 5),
      agents: agents.slice(0, 5),
      agentCount: agents.length,
      unassigned: unassignedReferrals(branchIds, range),
      expenses: currencies.map((c) => ({ c, parts: expenseMix(branchIds, range, c).filter((p) => p.value > 0) })),
      services: serviceRanking(branchIds, range),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIds.join(','), range.from.getTime(), range.to.getTime()]);

  const topServices = data.services.filter((s) => s.count > 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of topServices) m.set(s.category, (m.get(s.category) ?? 0) + s.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [topServices]);

  return (
    <>
      <AdminHeader title="Dashboard" />

      {/* Welcome + live strip */}
      <section className="mt-1 overflow-hidden rounded-[24px] bg-linear-to-br from-brand-600 to-brand-800 p-5 text-white shadow-[0_14px_30px_rgba(31,111,232,0.28)]">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/75">Company administration · {scopeName}</p>
        <h2 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em]">
          {greeting()}, {user.name}.
        </h2>
        <p className="mt-1 text-[13.5px] leading-snug text-white/85">{focus ? `The financial and operational picture for the ${focus.name} branch.` : 'The consolidated financial and operational picture across your branches.'}</p>
        <p className="mt-3 text-[12px] font-medium text-white/70">{periodLabel(period)}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              ['Unique patients', formatCount(summary.patients)],
              ['New patients', formatCount(summary.newPatients)],
              ['Referrals', formatCount(summary.referrals)],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="min-w-0 rounded-2xl bg-white/12 px-2.5 py-2">
              <p className="truncate text-[18px] font-bold leading-tight">{v}</p>
              <p className="truncate text-[11px] text-white/75">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 1. Quick Stats */}
      <SectionHead eyebrow="Financial intelligence" title="Business Performance Overview" note="Amounts stay grouped by their recorded currency; the dashboard does not combine currencies." />
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi icon={<ChartLine size={18} />} tone="bg-tint-blue text-brand-700" title="Revenue Generated" value={<MoneyValue money={summary.revenue} />} delta={<Delta pct={firstPct(compareMoney(summary.revenue, prior?.revenue ?? null))} />} note="Completed diagnostics in this period" onClick={() => navigate('/finance')} />
        <Kpi icon={<CreditCard size={18} />} tone="bg-tint-green text-good-ink" title="Payments Received" value={<MoneyValue money={summary.payments} />} delta={<Delta pct={firstPct(compareMoney(summary.payments, prior?.payments ?? null))} />} note={`${formatCount(summary.transactions)} transactions`} onClick={() => navigate('/finance')} />
        <Kpi icon={<FileText size={18} />} tone="bg-tint-orange text-orange" title="Expenses Incurred" value={<MoneyValue money={summary.expenses} />} delta={<Delta pct={firstPct(compareMoney(summary.expenses, prior?.expenses ?? null))} />} note="Approved, by expense date" onClick={() => navigate('/finance')} />
        <Kpi icon={<Clock3 size={18} />} tone="bg-[#fdecec] text-[#b42318]" title="Outstanding Balances" value={<MoneyValue money={summary.outstanding} />} delta={<Delta pct={firstPct(compareMoney(summary.outstanding, prior?.outstanding ?? null))} />} note={`${formatCount(summary.openBills)} open bills at period end`} onClick={() => navigate('/finance')} />
        <Kpi icon={<Percent size={18} />} tone="bg-tint-purple text-violet" title="PR Commissions Earned" value={<MoneyValue money={summary.prCommission} />} delta={<Delta pct={firstPct(compareMoney(summary.prCommission, prior?.prCommission ?? null))} />} note={`Accrued on ${formatCount(summary.referrals)} referrals`} onClick={() => navigate('/pr')} />
        <Kpi
          icon={<TrendingUp size={18} />}
          tone="bg-[#e0f7f5] text-[#0f766e]"
          title="Operating Contribution"
          value={OPERATING_CONTRIBUTION_RULE ? <MoneyValue money={Object.fromEntries(currencies.map((c) => [c, OPERATING_CONTRIBUTION_RULE!(summary, c)]))} /> : <span className="text-muted">Not set</span>}
          note={OPERATING_CONTRIBUTION_RULE ? 'Estimate from the confirmed rule' : 'Withheld until the formula is confirmed in business rules'}
        />
      </div>

      {/* 3. Payments received */}
      <SectionHead eyebrow="Daily payment summary" title={period.key === 'today' ? 'Payments received today' : `Payments received · ${periodLabel(period)}`} note="Receipts actually collected. Revenue and payments are kept separate." />
      {data.payMix.map(({ c, parts }) => (
        <Card key={c} className="mb-2.5 p-4">
          <p className="mb-3 text-[13px] font-semibold text-ink-2">By payment method{currencies.length > 1 ? ` (${c})` : ''}</p>
          <ShareBar parts={parts.map((p, i) => ({ label: p.label, value: p.value, color: PALETTE[i]! }))} format={(v) => fmt(v, c)} />
        </Card>
      ))}
      {data.collections.map(({ c, rows }) =>
        rows.length > 1 ? (
          <Card key={`col-${c}`} className="mb-2.5 overflow-hidden">
            <p className="px-4 pt-4 text-[13px] font-semibold text-ink-2">Collections by branch</p>
            <BarList color="bg-good" rows={rows.map((r) => ({ key: r.branch.id, label: r.branch.name, value: r.value, text: fmt(r.value, c) }))} onRow={(id) => navigate(`/branches/${id}`)} />
          </Card>
        ) : null,
      )}

      {/* 4. Branch performance */}
      <SectionHead eyebrow="Branches" title="Branch performance" action="All branches" onAction={() => navigate('/branches')} />
      <div className="space-y-2.5">
        {data.branches.map((b) => (
          <button key={b.branch.id} type="button" onClick={() => navigate(`/branches/${b.branch.id}`)} className="press block w-full rounded-[20px] bg-white p-4 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold text-ink">{b.branch.name}</span>
                <span className="text-[12.5px] text-muted">
                  {b.branch.code} · {b.branch.city}
                </span>
              </span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${b.branch.status === 'Active' ? 'bg-tint-green text-good-ink' : 'bg-[#eef1f6] text-ink-2'}`}>{b.branch.status}</span>
            </span>
            {b.summary ? (
              <span className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ['Revenue', <MoneyValue key="r" money={b.summary.revenue} compact />],
                    ['Payments', <MoneyValue key="p" money={b.summary.payments} compact />],
                    ['Patients', formatCount(b.summary.patients)],
                  ] as const
                ).map(([l, v]) => (
                  <span key={l} className="min-w-0 rounded-xl bg-page px-2.5 py-2">
                    <span className="block text-[15px] font-bold text-ink">{v}</span>
                    <span className="block text-[11px] text-muted">{l}</span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="mt-2 block text-[13px] text-muted">No activity while the branch is not active.</span>
            )}
            {b.summary && (
              <span className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                <Delta pct={firstPct(compareMoney(b.summary.revenue, b.prior?.revenue ?? null))} /> revenue vs the previous period
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 5. Referral performance */}
      <SectionHead eyebrow="Referral performance" title="Top referring hospitals" action="PR Management" onAction={() => navigate('/pr')} />
      <Card className="overflow-hidden">
        {data.hospitals.length ? (
          <BarList color="bg-violet" rows={data.hospitals.map((h) => ({ key: h.key, label: h.name, sub: `${h.activeAgents} of ${h.agentCount} agents referred · ${formatMoney(h.revenue.NGN ?? 0, 'NGN', true)} billed`, value: h.referrals, text: `${formatCount(h.referrals)} ref.` }))} />
        ) : (
          <Empty title="No hospital referrals in this period" />
        )}
        {data.unassigned.referrals > 0 && (
          <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-[12.5px] text-muted">
            <Hospital size={15} /> {formatCount(data.unassigned.referrals)} referrals from {data.unassigned.agents} agents with no hospital assigned (kept separate).
          </p>
        )}
      </Card>
      <SectionHead title="Top 5 PR agents" note={`${formatCount(data.agentCount)} agents referred in this period`} action="See all" onAction={() => navigate('/pr')} />
      <Card className="overflow-hidden">
        {data.agents.length ? (
          <BarList
            color="bg-brand-500"
            rows={data.agents.map((a) => ({ key: String(a.id), label: a.name, sub: `${a.hospitalKey || 'No hospital'} · commission ${formatMoney(a.commission.NGN ?? 0, 'NGN')}`, value: a.referrals, text: `${formatCount(a.referrals)} ref.` }))}
            onRow={(id) => navigate(`/pr?agent=${id}`)}
          />
        ) : (
          <Empty title="No referrals in this period" />
        )}
      </Card>

      {/* 6. Expenses & patients */}
      <SectionHead eyebrow="Expenses & patients" title="Patients attended and expenses" />
      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <Kpi icon={<UserRound size={18} />} tone="bg-tint-blue text-brand-700" title="Patients attended" value={formatCount(summary.patients)} delta={<Delta pct={compareCount(summary.patients, prior?.patients ?? null)} />} onClick={() => navigate('/patients')} />
        <Kpi icon={<Stethoscope size={18} />} tone="bg-tint-purple text-violet" title="New patients" value={formatCount(summary.newPatients)} delta={<Delta pct={compareCount(summary.newPatients, prior?.newPatients ?? null)} />} onClick={() => navigate('/patients')} />
      </div>
      {data.expenses.map(({ c, parts }) => (
        <Card key={`exp-${c}`} className="mb-2.5 p-4">
          <p className="mb-3 text-[13px] font-semibold text-ink-2">Approved expenses by category{currencies.length > 1 ? ` (${c})` : ''}</p>
          {parts.length ? <ShareBar parts={parts.map((p, i) => ({ label: p.label, value: p.value, color: PALETTE[i % PALETTE.length]! }))} format={(v) => fmt(v, c)} /> : <Empty title="No approved expenses in this period" />}
        </Card>
      ))}

      {/* 7. Top diagnostic services */}
      <SectionHead eyebrow="Daily test category summary" title="Top diagnostic services" note="Number performed in the period, with the billed value." action="Inventory" onAction={() => navigate('/inventory')} />
      <Card className="mb-2.5 overflow-hidden">
        {topServices.length ? <BarList color="bg-good" rows={topServices.slice(0, 5).map((s) => ({ key: String(s.id), label: s.name, sub: `${s.category} · ${formatMoney(s.revenue.NGN ?? 0, 'NGN')}`, value: s.count, text: `${formatCount(s.count)}` }))} /> : <Empty title="No tests in this period" />}
      </Card>
      {byCategory.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            <FlaskConical size={15} /> Tests by category
          </p>
          <ShareBar parts={byCategory.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length]! }))} format={(v) => formatCount(v)} />
        </Card>
      )}
    </>
  );
}
