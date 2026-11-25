/**
 * Company Admin Dashboard on mobile (owner, 2026-11-25): the referring-
 * clinician app's style, not the desktop's. Same figures and rules as the
 * desktop CompanyDashboard (shared logic in src/company), shown as:
 *  greeting + scope · search · smart announcement bar (top PR agent to thank,
 *  each branch's day with "what changed", notifications) · Today's Activity ·
 *  live ticker · payments card · quick actions · branches · top PR agents ·
 *  hospitals · services · expenses.
 * Every card opens a slide-up card with the records behind the figure, for
 * the branch scope being viewed (admin/details.tsx).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { BRANCHES, getBranch } from '@company/data/company';
import type { Currency, PaymentMethod } from '@company/data/types';
import { agentRanking, branchPerformance, compareCount, compareMoney, expenseMix, hospitalRanking, paymentMix, periodLabel, resolveBranchIds, serviceRanking } from '@company/services/analytics';
import { formatCount, formatMoney, greeting } from '@company/shared/format';
import { ADMIN } from '@/data/team';
import { FilterButton, InitialsAvatar, SearchField, Sticker } from '@/ui/kit';
import { useDashboardData } from '../useDashboardData';
import { ScopeBar } from '../ui';
import { DetailSheet, FocusSheet, type DetailKind, type Focus } from '../details';
import { Action, ActivityTiles, AdminTopBar, PageGlow, PaymentsCard, SectionTitle, SlideCarousel, Tag, Ticker, firstPct } from '../kit';
import { ExpensesCard, Hospitals, TopAgents, TopServices } from '../sections';
import { useInsightSlides } from '../insights';
import { AdminReferrals } from '../referrals';

export function AdminDashboard() {
  const { context, period, user, navigate } = useCompany();
  const branchIds = useMemo(() => resolveBranchIds(context), [context]);
  const { range, summary, prior } = useDashboardData(branchIds, period);
  const focus = context === 'all' ? null : getBranch(context);
  const scopeText = focus ? `${focus.name} branch` : 'All branches';
  const periodText = periodLabel(period);
  const c: Currency = summary.currencies[0] ?? 'NGN';
  const [detail, setDetail] = useState<{ kind: DetailKind; method?: PaymentMethod } | null>(null);
  const [pick, setPick] = useState<Focus | null>(null);
  const [q, setQ] = useState('');
  const insights = useInsightSlides(branchIds, period);

  const data = useMemo(
    () => ({
      pay: paymentMix(branchIds, range, c),
      branches: branchPerformance(range).filter((b) => !focus || b.branch.id === focus.id),
      agents: agentRanking(branchIds, range),
      hospitals: hospitalRanking(branchIds, range),
      services: serviceRanking(branchIds, range).filter((s) => s.count > 0),
      expenses: expenseMix(branchIds, range, c).filter((x) => x.value > 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchIds.join(','), range.from.getTime(), range.to.getTime(), c],
  );

  const m = (v: number) => formatMoney(v, c, true);
  const rev = summary.revenue[c] ?? 0;
  const paid = summary.payments[c] ?? 0;
  const collected = rev > 0 ? Math.min(100, (paid / rev) * 100) : 0;
  const open = (kind: DetailKind, method?: PaymentMethod) => setDetail({ kind, method });
  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/patients?q=${encodeURIComponent(q.trim())}` : '/patients');
  };

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        {/* Greeting */}
        <section className="mb-4 flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="text-[17px] text-ink-2">{greeting()},</p>
            <h1 className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {user.name}&nbsp;<span aria-hidden="true">👋</span>
            </h1>
            <span className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-brand-100/80 py-1 pl-1.5 pr-3 text-[14px] font-medium text-ink-2">
              <span className="grid h-5.5 w-5.5 place-items-center rounded-full bg-linear-to-b from-[#ffd34d] to-[#f5a400] text-white">
                <ShieldCheck size={12} />
              </span>
              {user.role}
            </span>
          </div>
          <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-full bg-linear-to-b from-[#cfe2ff] to-[#9cc3ff] p-[3px] shadow-[0_14px_30px_rgba(31,111,232,0.22)]">
            {ADMIN.photo ? <img src={ADMIN.photo} alt="" className="h-full w-full rounded-full object-cover" /> : <InitialsAvatar name={user.name} size={86} />}
          </div>
        </section>

        {/* Search + scope */}
        <form onSubmit={search} className="mb-3 flex gap-3" role="search">
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients by name, ID or phone..." aria-label="Search patients" className="[&_input]:text-[14.5px]" />
          <FilterButton onClick={() => navigate('/reports')} label="Reports" />
        </form>
        <ScopeBar />

        {/* Incoming referrals across the branches (owner, 2026-11-25): how fast each branch attends to them. */}
        <AdminReferrals />

        {/* Smart announcement bar */}
        <SlideCarousel slides={insights.slides} label="What needs you" />

        {/* Today's activity */}
        <SectionTitle title={period.key === 'today' ? 'Today’s Activity' : `Activity · ${periodText}`} />
        <ActivityTiles summary={summary} prior={prior} c={c} open={open} />

        {/* Live ticker */}
        <Ticker
          items={[
            { label: 'Revenue', value: m(rev), pct: firstPct(compareMoney(summary.revenue, prior?.revenue ?? null)) },
            { label: 'Payments', value: m(paid), pct: firstPct(compareMoney(summary.payments, prior?.payments ?? null)) },
            { label: 'Collected', value: `${Math.round(collected)}%` },
            { label: 'Patients', value: formatCount(summary.patients), pct: compareCount(summary.patients, prior?.patients ?? null) },
            { label: 'New patients', value: formatCount(summary.newPatients) },
            { label: 'Referrals', value: formatCount(summary.referrals), pct: compareCount(summary.referrals, prior?.referrals ?? null) },
            { label: 'PR commission', value: m(summary.prCommission[c] ?? 0) },
            { label: 'Expenses', value: m(summary.expenses[c] ?? 0), pct: firstPct(compareMoney(summary.expenses, prior?.expenses ?? null)), invert: true },
            { label: 'Open bills', value: formatCount(summary.openBills) },
            ...(data.services[0] ? [{ label: 'Top test', value: data.services[0].name }] : []),
            ...(data.agents[0] ? [{ label: 'Top PR agent', value: data.agents[0].name }] : []),
          ]}
        />

        <PaymentsCard title={period.key === 'today' ? 'Payments received today' : `Payments received · ${periodText}`} paid={paid} billed={rev} c={c} mix={data.pay} open={open} />

        {/* Quick actions */}
        <SectionTitle title="Quick Actions" />
        <div className="grid grid-cols-4 gap-2.5">
          <Action tint="bg-tint-blue border-[#d6e7ff]" sticker="hospital" label="Branches" onClick={() => navigate('/branches')} />
          <Action tint="bg-tint-purple border-[#e2d8ff]" sticker="stethoscope" label="Patients" onClick={() => navigate('/patients')} />
          <Action tint="bg-tint-green border-[#cdeedb]" sticker="moneyBag" label="Finance" onClick={() => navigate('/finance')} />
          <Action tint="bg-tint-orange border-[#ffe2c6]" sticker="megaphone" label="PR agents" onClick={() => navigate('/pr')} />
          <Action tint="bg-tint-pink border-[#ffd8e4]" sticker="healthWorker" label="Staff" onClick={() => navigate('/staff')} />
          <Action tint="bg-[#e0f7f5] border-[#c4ece7]" sticker="testTube" label="Inventory" onClick={() => navigate('/inventory')} />
          <Action tint="bg-[#eef1ff] border-[#dfe3ff]" sticker="chart" label="Reports" onClick={() => navigate('/reports')} />
          <Action tint="bg-[#f4f6fa] border-line" sticker="sparkles" label="Settings" onClick={() => navigate('/settings')} />
        </div>

        {/* Branches */}
        <SectionTitle title={focus ? 'Your branch' : 'Your branches'} action="See all" onAction={() => navigate('/branches')} />
        <div className="space-y-2.5">
          {data.branches.map((b) => {
            const bc = b.branch.currency;
            const s = b.summary;
            const r = s?.revenue[bc] ?? 0;
            const p = s?.payments[bc] ?? 0;
            return (
              <button key={b.branch.id} type="button" onClick={() => navigate(`/branches/${b.branch.id}`)} className="press flex w-full items-start gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
                <span className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[16px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff]">
                  <Sticker name="hospital" size={46} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[15.5px] font-bold text-ink">{b.branch.name}</span>
                    <span className="shrink-0 text-[15px] font-bold text-brand-600">{s ? formatMoney(p, bc, true) : 'No data'}</span>
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {b.branch.code} · {b.branch.city} · {s ? `${formatCount(s.patients)} patients` : b.branch.status}
                  </span>
                  {s && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Tag tone="bg-tint-green text-good-ink">{r > 0 ? `${Math.round(Math.min(100, (p / r) * 100))}% collected` : 'Nothing billed'}</Tag>
                      <Tag tone="bg-brand-50 text-brand-700">{formatCount(s.referrals)} referrals</Tag>
                      {(s.outstanding[bc] ?? 0) > 0 && <Tag tone="bg-[#fdecec] text-[#b42318]">{formatMoney(s.outstanding[bc] ?? 0, bc, true)} owed</Tag>}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {BRANCHES.length === 0 && <p className="text-[14px] text-muted">No branches yet.</p>}
        </div>

        <TopAgents agents={data.agents} onPick={setPick} onAll={() => open('referrals')} />
        <Hospitals list={data.hospitals} onPick={setPick} onAll={() => open('hospitals')} />
        <TopServices list={data.services} c={c} onPick={setPick} onAll={() => open('services')} />
        <ExpensesCard label={`Approved expenses · ${periodText}`} total={summary.expenses[c] ?? 0} mix={data.expenses} c={c} onClick={() => open('expenses')} />
      </div>

      {detail && <DetailSheet kind={detail.kind} method={detail.method} branchIds={branchIds} period={period} scopeText={scopeText} onClose={() => setDetail(null)} />}
      {pick && <FocusSheet focus={pick} branchIds={branchIds} period={period} onClose={() => setPick(null)} />}
      {insights.sheets}
    </div>
  );
}
