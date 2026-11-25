/**
 * Company Admin Dashboard on mobile (owner, 2026-11-25: redesigned in the
 * referring-clinician app's style, not the desktop's). Same figures and rules
 * as the desktop CompanyDashboard (shared logic in src/company), shown as:
 *  greeting + scope · search · quick-notification carousel · Today's Activity
 *  tiles · live ticker · payments card · quick actions · branches · top PR
 *  agents · top hospitals · top services · expenses.
 * Every card opens a slide-up card with the records behind the figure, for
 * the branch scope being viewed (admin/details.tsx).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from 'react';
import { ArrowRight, Bell, ChevronRight, Clock3, CreditCard, FileText, Menu, Percent, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { BRANCHES, getBranch } from '@company/data/company';
import type { Currency } from '@company/data/types';
import { agentRanking, branchPerformance, compareCount, compareMoney, expenseMix, hospitalRanking, paymentMix, periodLabel, resolveBranchIds, serviceRanking } from '@company/services/analytics';
import { isRead, markRead, useNotifications, type Note, type NoteKind } from '@company/services/notifications';
import { formatCount, formatMoney, greeting } from '@company/shared/format';
import { ADMIN } from '@/data/team';
import { serviceByName } from '@/data/services';
import type { StickerKey } from '@/assets';
import { InitialsAvatar, SearchField, FilterButton, ServiceThumb, Sticker } from '@/ui/kit';
import { useDashboardData } from '../useDashboardData';
import { useAdminShell } from '../shell';
import { ScopeBar, Sheet } from '../ui';
import { DetailSheet, type DetailKind } from '../details';

const firstPct = (p: Partial<Record<Currency, number | null>>) => Object.values(p)[0] ?? null;

export function AdminDashboard() {
  const { context, period, user, navigate } = useCompany();
  const { openMenu, unread } = useAdminShell();
  const branchIds = useMemo(() => resolveBranchIds(context), [context]);
  const { range, summary, prior } = useDashboardData(branchIds, period);
  const focus = context === 'all' ? null : getBranch(context);
  const scopeText = focus ? `${focus.name} branch` : 'All branches';
  const periodText = periodLabel(period);
  const c: Currency = summary.currencies[0] ?? 'NGN';
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [q, setQ] = useState('');

  // Frosted top bar once content scrolls under it (as on the clinician Home).
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const data = useMemo(() => {
    const agents = agentRanking(branchIds, range);
    return {
      pay: paymentMix(branchIds, range, c),
      branches: branchPerformance(range).filter((b) => !focus || b.branch.id === focus.id),
      agents,
      hospitals: hospitalRanking(branchIds, range),
      services: serviceRanking(branchIds, range).filter((s) => s.count > 0),
      expenses: expenseMix(branchIds, range, c).filter((x) => x.value > 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIds.join(','), range.from.getTime(), range.to.getTime(), c]);

  const m = (v: number, compact = true) => formatMoney(v, c, compact);
  const rev = summary.revenue[c] ?? 0;
  const paid = summary.payments[c] ?? 0;
  const collected = rev > 0 ? Math.min(100, (paid / rev) * 100) : 0;
  const open = (k: DetailKind) => setDetail(k);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/patients?q=${encodeURIComponent(q.trim())}` : '/patients');
  };

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-5 top-0 -z-0 h-[460px] bg-[radial-gradient(120%_70%_at_75%_0%,#d6e6ff_0%,#e9f1ff_45%,rgba(244,248,254,0)_100%)] md:-inset-x-8" />
      <div ref={sentinel} className="absolute top-0 h-px w-px" aria-hidden="true" />
      <header className={`sticky top-0 z-30 -mx-5 flex min-h-16 items-center justify-between px-5 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-300 md:-mx-8 md:px-8 ${scrolled ? 'bg-[#eef4fe]/90 shadow-[0_6px_20px_rgba(30,74,160,0.08)] backdrop-blur-xl' : 'bg-transparent'}`}>
        <button type="button" onClick={openMenu} aria-label="Menu" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink md:invisible">
          <Menu size={26} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => navigate('/notifications')} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="press relative -mr-2 grid h-11 w-11 place-items-center rounded-full text-ink">
          <Bell size={26} strokeWidth={1.9} />
          {unread > 0 && <span className="absolute right-0.5 top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-[#ef4444] px-1 text-[11px] font-bold text-white ring-2 ring-[#e9f1ff]">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </header>

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
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients, tests, branches..." aria-label="Search" className="[&_input]:text-[14.5px]" />
          <FilterButton onClick={() => navigate('/reports')} label="Reports" />
        </form>
        <ScopeBar />

        {/* Quick notifications */}
        <NoteCarousel />

        {/* Today's activity */}
        <SectionTitle title={period.key === 'today' ? 'Today’s Activity' : `Activity · ${periodText}`} />
        <div className="grid grid-cols-3 gap-2.5">
          <Tile tint="bg-tint-blue border-[#d6e7ff]" icon={<TrendingUp size={26} className="text-brand-500" strokeWidth={2.4} />} label="Revenue" value={m(rev)} ink="text-brand-800" pct={firstPct(compareMoney(summary.revenue, prior?.revenue ?? null))} onClick={() => open('revenue')} />
          <Tile tint="bg-tint-green border-[#cdeedb]" icon={<CreditCard size={26} className="text-good" fill="currentColor" fillOpacity={0.18} strokeWidth={2.2} />} label="Payments" value={m(paid)} ink="text-[#14633a]" pct={firstPct(compareMoney(summary.payments, prior?.payments ?? null))} onClick={() => open('payments')} />
          <Tile tint="bg-tint-purple border-[#e2d8ff]" icon={<Users size={26} className="text-violet" fill="currentColor" strokeWidth={1.4} />} label="Patients" value={formatCount(summary.patients)} ink="text-violet" pct={compareCount(summary.patients, prior?.patients ?? null)} onClick={() => open('patients')} />
          <Tile tint="bg-tint-orange border-[#ffe2c6]" icon={<FileText size={25} className="text-orange" fill="currentColor" fillOpacity={0.18} strokeWidth={2.2} />} label="Expenses" value={m(summary.expenses[c] ?? 0)} ink="text-warn-ink" pct={firstPct(compareMoney(summary.expenses, prior?.expenses ?? null))} invert onClick={() => open('expenses')} />
          <Tile tint="bg-[#fdecec] border-[#f9d4d4]" icon={<Clock3 size={25} className="text-[#d93036]" fill="currentColor" fillOpacity={0.15} strokeWidth={2.2} />} label="Outstanding" value={m(summary.outstanding[c] ?? 0)} ink="text-[#b42318]" pct={firstPct(compareMoney(summary.outstanding, prior?.outstanding ?? null))} invert onClick={() => open('outstanding')} />
          <Tile tint="bg-[#eef1ff] border-[#dfe3ff]" icon={<Percent size={25} className="text-[#4f46e5]" strokeWidth={2.4} />} label="PR commission" value={m(summary.prCommission[c] ?? 0)} ink="text-[#3730a3]" pct={firstPct(compareMoney(summary.prCommission, prior?.prCommission ?? null))} onClick={() => open('commission')} />
        </div>

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

        {/* Payments received */}
        <button type="button" onClick={() => open('payments')} className="press relative mt-5 block w-full overflow-hidden rounded-[24px] bg-linear-to-br from-[#0f8a4b] via-[#16a35a] to-[#4cc98a] p-5 text-left text-white shadow-[0_14px_30px_rgba(22,163,74,0.28)]">
          <span aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <span className="relative block max-w-[64%]">
            <span className="text-[13px] font-medium text-white/90">{period.key === 'today' ? 'Payments received today' : `Payments received · ${periodText}`}</span>
            <span className="mt-1 block text-[30px] font-bold leading-none tracking-[-0.02em]">{formatMoney(paid, c)}</span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-white" style={{ width: `${Math.max(rev > 0 ? 3 : 0, collected)}%` }} />
            </span>
            <span className="mt-1.5 block text-[12.5px] text-white/90">{rev > 0 ? `${Math.round(collected)}% of ${formatMoney(rev, c)} billed` : 'Nothing billed in this period'}</span>
          </span>
          <span className="relative z-10 mt-3.5 grid grid-cols-3 gap-2">
            {data.pay.map((p) => (
              <span key={p.label} className="min-w-0 rounded-xl bg-white/15 px-2.5 py-1.5 text-[12px] backdrop-blur-sm">
                <span className="block text-white/80">{p.label}</span>
                <b className="block truncate text-[13.5px]">{m(p.value)}</b>
              </span>
            ))}
          </span>
          <Sticker name="moneyBag" size={96} className="absolute right-2 top-3" />
        </button>

        {/* Quick actions */}
        <SectionTitle title="Quick Actions" />
        <div className="grid grid-cols-4 gap-2.5">
          <Action tint="bg-tint-blue border-[#d6e7ff]" sticker="hospital" label={'Branches'} onClick={() => navigate('/branches')} />
          <Action tint="bg-tint-purple border-[#e2d8ff]" sticker="stethoscope" label={'Patients'} onClick={() => navigate('/patients')} />
          <Action tint="bg-tint-green border-[#cdeedb]" sticker="moneyBag" label={'Finance'} onClick={() => navigate('/finance')} />
          <Action tint="bg-tint-orange border-[#ffe2c6]" sticker="megaphone" label={'PR agents'} onClick={() => navigate('/pr')} />
          <Action tint="bg-tint-pink border-[#ffd8e4]" sticker="healthWorker" label={'Staff'} onClick={() => navigate('/staff')} />
          <Action tint="bg-[#e0f7f5] border-[#c4ece7]" sticker="testTube" label={'Inventory'} onClick={() => navigate('/inventory')} />
          <Action tint="bg-[#eef1ff] border-[#dfe3ff]" sticker="chart" label={'Reports'} onClick={() => navigate('/reports')} />
          <Action tint="bg-[#f4f6fa] border-line" sticker="sparkles" label={'Settings'} onClick={() => navigate('/settings')} />
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

        {/* Top PR agents */}
        <SectionTitle title="Top PR Agents" action="See all" onAction={() => open('referrals')} />
        {data.agents.length === 0 ? (
          <EmptyCard sticker="stethoscope" text="No referrals in this period." />
        ) : (
          <ul className="space-y-2.5">
            {data.agents.slice(0, 3).map((a, i) => (
              <li key={a.id}>
                <button type="button" onClick={() => open('referrals')} className="press flex w-full items-start gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
                  <span className="relative">
                    <InitialsAvatar name={a.name} size={56} />
                    <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-700 shadow-sm">#{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-[15px] font-bold text-ink">{a.name}</span>
                      <span className="shrink-0 text-[14.5px] font-bold text-violet">{formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency)}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-muted">{a.hospitalKey || 'No hospital assigned'} · commission</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <Tag tone="bg-brand-50 text-brand-700">{formatCount(a.referrals)} referral{a.referrals === 1 ? '' : 's'}</Tag>
                      <Tag tone="bg-page text-ink-2">{formatMoney(a.revenue[a.branch.currency] ?? 0, a.branch.currency, true)} billed</Tag>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Top hospitals */}
        <SectionTitle title="Referring Hospitals" action="See all" onAction={() => open('hospitals')} />
        {data.hospitals.length === 0 ? (
          <EmptyCard sticker="hospital" text="No hospital referrals in this period." />
        ) : (
          <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
            {data.hospitals.slice(0, 8).map((h) => (
              <button key={h.key} type="button" onClick={() => open('hospitals')} className="press relative w-[150px] shrink-0 overflow-hidden rounded-[20px] bg-linear-to-br from-[#eef9ff] to-[#d7efff] p-3.5 text-left ring-1 ring-[#cfe8fb]">
                <span className="block truncate text-[15px] font-bold text-ink">{h.name}</span>
                <span className="block text-[12px] text-ink-2">
                  {h.activeAgents} of {h.agentCount} agents
                </span>
                <span className="mt-6 block text-[22px] font-bold leading-none text-brand-700">{formatCount(h.referrals)}</span>
                <span className="text-[11.5px] text-muted">referrals</span>
                <Sticker name="hospital" size={54} className="absolute -bottom-1 -right-1" />
              </button>
            ))}
          </div>
        )}

        {/* Top services */}
        <SectionTitle title="Top Diagnostic Services" action="See all" onAction={() => open('services')} />
        {data.services.length === 0 ? (
          <EmptyCard sticker="microscope" text="No tests in this period." />
        ) : (
          <ul className="space-y-2.5">
            {data.services.slice(0, 4).map((s) => {
              const svc = serviceByName(s.name);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => open('services')} className="press flex w-full items-start gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
                    {svc ? (
                      <ServiceThumb service={svc} className="h-[64px] w-[64px] shrink-0 rounded-[16px]" />
                    ) : (
                      <span className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[16px] bg-tint-blue">
                        <Sticker name="microscope" size={44} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{s.name}</span>
                        <span className="shrink-0 text-[15px] font-bold text-brand-600">×{formatCount(s.count)}</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <Tag tone="bg-brand-50 text-brand-700">{s.category}</Tag>
                        <Tag tone="bg-tint-green text-good-ink">{formatMoney(s.revenue[c] ?? 0, c)} billed</Tag>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Expenses */}
        <button type="button" onClick={() => open('expenses')} className="press relative mt-6 block w-full overflow-hidden rounded-[24px] bg-linear-to-br from-[#fff3e2] to-[#ffe0b8] p-5 text-left ring-1 ring-[#ffe2c6]">
          <span className="block max-w-[66%]">
            <span className="text-[13px] font-semibold text-warn-ink">Approved expenses · {periodText}</span>
            <span className="mt-1 block text-[26px] font-bold leading-tight text-ink">{formatMoney(summary.expenses[c] ?? 0, c)}</span>
            <span className="mt-2 block space-y-1">
              {data.expenses.slice(0, 3).map((x) => (
                <span key={x.label} className="flex justify-between gap-3 text-[12.5px] text-ink-2">
                  <span className="truncate">{x.label}</span>
                  <b className="shrink-0 text-ink">{m(x.value)}</b>
                </span>
              ))}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700">
              See every expense <ArrowRight size={15} />
            </span>
          </span>
          <Sticker name="clipboard" size={104} className="absolute -bottom-2 right-2 rotate-[8deg]" />
        </button>
      </div>

      {detail && <DetailSheet kind={detail} branchIds={branchIds} range={range} periodText={periodText} scopeText={scopeText} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ─────────────── pieces (the clinician dashboard's card language) ─────────────── */

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="flex items-center gap-1 text-[14.5px] font-semibold text-brand-600">
          {action} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

function Tile({ tint, icon, label, value, ink, pct, invert, onClick }: { tint: string; icon: React.ReactNode; label: string; value: string; ink: string; pct?: number | null; invert?: boolean; onClick: () => void }) {
  const good = pct == null ? null : invert ? pct <= 0 : pct >= 0;
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[124px] min-w-0 flex-col items-start rounded-[18px] border p-3 text-left ${tint}`}>
      {icon}
      <span className="mt-2 text-[13px] leading-tight text-ink-2">{label}</span>
      <span className={`mt-auto w-full truncate pt-1 font-bold leading-none tracking-[-0.03em] ${ink} ${value.length > 7 ? 'text-[17px]' : value.length > 5 ? 'text-[20px]' : 'text-[24px]'}`}>{value}</span>
      {pct != null && Number.isFinite(pct) && <span className={`mt-1 text-[11px] font-semibold ${good ? 'text-good' : 'text-[#d93036]'}`}>{`${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`}</span>}
    </button>
  );
}

function Action({ tint, sticker, label, onClick }: { tint: string; sticker: StickerKey; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[100px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border px-1 ${tint}`}>
      <Sticker name={sticker} size={40} />
      <span className="text-center text-[13px] font-medium leading-tight text-ink">{label}</span>
    </button>
  );
}

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tone}`}>{children}</span>;
}

function EmptyCard({ sticker, text }: { sticker: StickerKey; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
      <Sticker name={sticker} size={40} />
      <p className="text-[14px] text-muted">{text}</p>
    </div>
  );
}

/** Live ticker: a fintech-style scrolling band of key figures (pauses on touch). */
function Ticker({ items }: { items: { label: string; value: string; pct?: number | null; invert?: boolean }[] }) {
  const run = [...items, ...items];
  return (
    <div className="ticker -mx-5 mt-5 overflow-hidden bg-[#0b1a3a] py-2.5 md:-mx-8" aria-label="Live figures">
      <div className="ticker-track flex w-max items-center" style={{ ['--ticker-s' as string]: `${Math.max(24, items.length * 4)}s` }}>
        {run.map((it, i) => {
          const good = it.pct == null ? null : it.invert ? it.pct <= 0 : it.pct >= 0;
          return (
            <span key={i} className="flex shrink-0 items-center gap-2 px-4 text-[13px] text-white/75" aria-hidden={i >= items.length}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d07f]" />
              {it.label}
              <b className="max-w-[180px] truncate text-white">{it.value}</b>
              {it.pct != null && Number.isFinite(it.pct) && <span className={`text-[12px] font-semibold ${good ? 'text-[#34d07f]' : 'text-[#ff6b6b]'}`}>{`${it.pct >= 0 ? '▲' : '▼'}${Math.abs(it.pct).toFixed(1)}%`}</span>}
              <span className="ml-2 text-white/20">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── quick notifications carousel ─────────────── */

const NOTE_LOOK: Record<NoteKind, { theme: string; sticker: StickerKey; label: string }> = {
  summary: { theme: 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]', sticker: 'chart', label: 'Daily summary' },
  bill: { theme: 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]', sticker: 'moneyBag', label: 'High-value bill' },
  unpaid: { theme: 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]', sticker: 'clipboard', label: 'Unpaid balance' },
  overdue: { theme: 'from-[#b42318] via-[#d93036] to-[#f0646a]', sticker: 'calendar', label: 'Overdue balances' },
  payout: { theme: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]', sticker: 'coin', label: 'PR payout' },
  data: { theme: 'from-[#3346c9] via-[#4f63e6] to-[#8796f7]', sticker: 'bell', label: 'Data notice' },
};
const AUTOPLAY_MS = 5000;

function NoteCarousel() {
  const { notes } = useNotifications();
  const { navigate } = useCompany();
  const list = useMemo(() => notes.slice(0, 6), [notes]);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const width = useRef(1);
  const moved = useRef(false);
  const n = list.length;
  useEffect(() => {
    if (paused || n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => !document.hidden && setIndex((i) => (i + 1) % n), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [paused, n]);
  if (!n) return null;
  const at = Math.min(index, n - 1);
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    width.current = e.currentTarget.clientWidth || 1;
    moved.current = false;
    setPaused(true);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    if (!moved.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - start.current.y)) {
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (moved.current) setDrag(dx);
  };
  const up = () => {
    if (start.current && moved.current) {
      const limit = Date.now() - start.current.t < 300 ? 25 : width.current * 0.22;
      if (drag < -limit) setIndex((at + 1) % n);
      else if (drag > limit) setIndex((at - 1 + n) % n);
    }
    start.current = null;
    setDrag(0);
    window.setTimeout(() => setPaused(false), 1500);
  };
  return (
    <section aria-roledescription="carousel" aria-label="Quick notifications" className="mt-2">
      <div className="overflow-hidden rounded-[24px] shadow-[0_14px_34px_rgba(31,99,214,0.22)]" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: 'pan-y' }}>
        <div className="flex" style={{ transform: `translateX(calc(${-at * 100}% + ${drag}px))`, transition: drag ? 'none' : 'transform 520ms cubic-bezier(.22,.8,.24,1)' }}>
          {list.map((note, i) => {
            const look = NOTE_LOOK[note.kind];
            return (
              <article key={note.id} aria-hidden={i !== at} className={`relative isolate h-[196px] w-full shrink-0 select-none overflow-hidden bg-linear-to-r text-white ${look.theme}`}>
                <span aria-hidden="true" className="absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-white/10" />
                <div className="relative z-10 flex h-full w-[62%] flex-col justify-center py-4 pl-5">
                  <p className="mb-1.5 flex items-center gap-2 text-[12.5px] font-medium text-white/95">
                    <Sticker name="megaphone" size={22} className="-rotate-12" />
                    {look.label}
                    {!isRead(note) && <span className="rounded-full bg-white px-1.5 text-[10.5px] font-bold text-brand-700">NEW</span>}
                  </p>
                  <h3 className="line-clamp-2 text-[18px] font-bold leading-[1.15] tracking-[-0.01em]">{note.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-white/90">{note.summary}</p>
                  <button
                    type="button"
                    tabIndex={i === at ? 0 : -1}
                    onClick={() => {
                      if (moved.current) return;
                      markRead(note.id);
                      setOpenNote(note);
                    }}
                    className="press mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-brand-700 shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
                  >
                    View details <ArrowRight size={15} strokeWidth={2.4} />
                  </button>
                </div>
                <Sticker name={look.sticker} size={124} className="absolute -bottom-2 -right-3" />
              </article>
            );
          })}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {list.map((note, i) => (
            <button key={note.id} type="button" onClick={() => setIndex(i)} aria-label={`Notification ${i + 1} of ${n}`} aria-current={i === at} className="grid h-6 place-items-center">
              <span className={`block h-2 rounded-full transition-all duration-300 ${i === at ? 'w-5 bg-brand-600' : 'w-2 bg-[#cfd8e6]'}`} />
            </button>
          ))}
        </div>
      )}
      {openNote && (
        <Sheet
          title={openNote.title}
          subtitle={`${NOTE_LOOK[openNote.kind].label} · ${openNote.at.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          onClose={() => setOpenNote(null)}
          footer={
            <button type="button" onClick={() => (setOpenNote(null), navigate(openNote.route))} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              Go to {openNote.target.split(' · ')[0]} <ChevronRight size={18} />
            </button>
          }
        >
          <div className="px-2 pb-2">
            <p className="mb-3 text-[14.5px] leading-relaxed text-ink-2">{openNote.summary}</p>
            <div className="divide-y divide-line rounded-2xl bg-page">
              {openNote.details.map((d) => (
                <div key={d.label} className="flex items-start justify-between gap-4 px-4 py-3 text-[14px]">
                  <span className="shrink-0 text-muted">{d.label}</span>
                  <span className="text-right font-medium text-ink">{d.value}</span>
                </div>
              ))}
            </div>
            {openNote.note && <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-800">{openNote.note}</p>}
          </div>
        </Sheet>
      )}
    </section>
  );
}

