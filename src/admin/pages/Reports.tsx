/**
 * Reports (mobile, owner 2026-11-25): same content and rules as the desktop
 * ReportsPage (AnalysisPanel + ReportsHome + ReportBuilder). The report
 * definitions, document model, page layout and print styles are the desktop's
 * own (src/company/features/reports), so a report made on the phone is the
 * same document: preview, print, PDF and spreadsheet all match.
 *   Analysis: money in at a glance (today, week, month, year), key figures for
 *   a period compared with the one before (net profit is admin only), trend,
 *   payment methods, most done tests and top PR agents.
 *   Report cards: each opens the builder slide-up in three steps (choose the
 *   report and period · branch and content · paper and review), then a full
 *   page preview, and Print, Download PDF or Export spreadsheet. Anything
 *   usually included but left out is listed before the output. Every output
 *   is recorded in the Audit Log.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, CreditCard, Download, Eye, FileSpreadsheet, FlaskConical, Handshake, Printer, Receipt, TrendingUp, Users, Wallet, ZoomIn, ZoomOut } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, BRANCHES, getBranch } from '@company/data/company';
import type { DateRange, PeriodSelection } from '@company/data/types';
import { DATA_START, TODAY, addDays, isoDate } from '@company/data/demo/generator';
import { agentRanking, compareCount, compareMoney, paymentMix, priorRange, resolveRange, serviceRanking, summarize, trend } from '@company/services/analytics';
import { financeTotals } from '@company/services/finance';
import { useCommission } from '@company/services/commission';
import { logAudit } from '@company/services/audit';
import { companyName } from '@company/services/settingsStore';
import { formatCount, formatMoney, formatShortDate } from '@company/shared/format';
import { REPORTS, setReportPreparer, type ReportParams, type ReportSpec } from '@company/features/reports/specs';
import { PAPER_LABEL, paperName, paperPx, saveFile, savePdf, tableRowCount, toCsv, type Orientation, type Paper, type PaperSize } from '@company/features/reports/model';
import { AllPages, PageView, usePagination, type Page } from '@company/features/reports/ReportPages';
import { REPORT_CSS, REPORT_FONT_URL } from '@company/features/reports/reportCss';
import { useNav } from '@/app/store';
import { Sticker } from '@/ui/kit';
import { BarList, ScopeBar, Sheet } from '../ui';
import { FocusSheet, type Focus } from '../details';
import { AdminTopBar, EmptyCard, PageGlow, SectionTitle } from '../kit';
import { CountUp, Donut, LineChart, Spark, useSeen } from '../charts';
import { useAgentBanks } from '../agentBanks';
import { Chips, PageTitle } from '../branchFirst';
import { maxDaysFor, reportsFor, reportsLocked } from '@company/features/reports/access';
import { usePermissions } from '@company/services/permissions';
import { useInBranch } from '../access';

const BRAND = '#1f6fe8';
const BRAND_INK = '#1449a6';
const naira = (n: number, compact = false) => formatMoney(n, 'NGN', compact);
const SHORT: Partial<Record<PeriodSelection['key'], string>> = { today: 'Today', yesterday: 'Yesterday', week: 'This week', month: 'This month', year: 'This year' };
const rangeText = (r: DateRange) => (r.days <= 1 ? `${formatShortDate(r.from)} ${r.from.getFullYear()}` : `${formatShortDate(r.from)} to ${formatShortDate(r.to)} ${r.to.getFullYear()}`);

export function ReportsPage() {
  const { context, user } = useCompany();
  usePermissions();
  // Branch roles (owner, 2026-11-25): the same page as "Analysis", with the reports their role may create (desktop access rules),
  // never net profit, and one month at a time unless they have "Yearly analysis".
  const inBranch = useInBranch();
  const admin = user.role === 'Company Admin';
  const list = admin ? REPORTS : reportsFor(user.role);
  const locked = admin ? [] : reportsLocked(user.role);
  const long = admin || maxDaysFor(user.role) === undefined;
  const ids = useMemo(() => (context === 'all' ? ACTIVE_BRANCHES.map((b) => b.id) : [context]), [context]);
  const scopeLabel = context === 'all' ? 'All branches' : `${getBranch(context)?.name ?? ''} branch`;
  const [open, setOpen] = useState<ReportSpec | null>(null);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title={inBranch ? 'Analysis' : 'Reports'} sub={`${inBranch ? 'Figures and reports' : 'Reports and exports'} · ${scopeLabel}`} />
        {!inBranch && <ScopeBar branchOnly />}
        <Analysis ids={ids} profit={admin} long={long} />

        <SectionTitle title="Choose a report" />
        <p className="-mt-1 mb-3 text-[13px] text-muted">Create report lets you choose the period, branch and content, then preview it before printing, downloading or exporting.</p>
        <div className="grid grid-cols-2 gap-3">
          {list.map((r, i) => (
            <ReportCard key={r.id} i={REPORTS.findIndex((x) => x.id === r.id)} spec={r} onCreate={() => setOpen(r)} />
          ))}
        </div>
        {!list.length && <EmptyCard sticker="chart" text="Your role does not create reports. Ask the Branch Manager for one." />}
        {locked.length > 0 && (
          <p className="mt-3 rounded-2xl bg-page px-3.5 py-3 text-[12.5px] leading-snug text-muted">
            Kept for the Branch Manager: {locked.map((l) => (l.partial ? `part of ${l.spec.title}` : l.spec.title)).join(', ')}.
          </p>
        )}
      </div>
      {open && <BuilderSheet spec={open} initialBranch={context === 'all' ? 'all' : context} lockBranch={inBranch} long={long} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ─────────────── analysis ─────────────── */

function Analysis({ ids, profit = true, long = true }: { ids: string[]; /** Net profit (Company Admin only). */ profit?: boolean; /** Periods longer than a month. */ long?: boolean }) {
  const { version } = useCommission();
  const [key, setKey] = useState<PeriodSelection['key']>('month');
  const [focus, setFocus] = useState<Focus | null>(null);
  const { ref: heroRef, seen: heroSeen } = useSeen<HTMLDivElement>(0.2);
  const range = useMemo(() => resolveRange({ key }), [key]);
  const prior = useMemo(() => priorRange(range), [range]);
  const data = useMemo(() => {
    const s = summarize(ids, range);
    const p = prior ? summarize(ids, prior) : null;
    const fin = ids.map((id) => financeTotals(id, range)).reduce((a, f) => ({ income: a.income + f.income, costs: a.costs + f.costs, net: a.net + f.net }), { income: 0, costs: 0, net: 0 });
    const services = serviceRanking(ids, range).filter((x) => x.count > 0);
    return { s, p, fin, tr: trend(ids, range, 'NGN'), methods: paymentMix(ids, range, 'NGN'), tests: services.reduce((n, x) => n + x.count, 0), services: services.slice(0, 6), agents: agentRanking(ids, range).slice(0, 5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|'), range, prior, version]);
  const glance = useMemo(
    () =>
      (long ? (['today', 'week', 'month', 'year'] as const) : (['today', 'week', 'month'] as const)).map((k) => {
        const r = resolveRange({ key: k });
        return { key: k, value: summarize(ids, r).payments.NGN ?? 0, sub: rangeText(r) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join('|'), version],
  );
  const { s, p, fin } = data;
  const change = (cur: number, prev: number | null | undefined) => (prev == null ? null : compareCount(cur, prev));
  const moneyDelta = p ? (compareMoney(s.payments, p.payments).NGN ?? null) : null;
  const tiles: Fig[] = [
    { label: 'Billed', value: s.revenue.NGN ?? 0, money: true, sub: `${formatCount(s.transactions)} bills`, delta: p ? (compareMoney(s.revenue, p.revenue).NGN ?? null) : null, look: LOOK.blue, icon: <Receipt size={22} strokeWidth={2.3} /> },
    { label: 'Patients', value: s.patients, sub: `${formatCount(s.newPatients)} new · ${formatCount(s.patients - s.newPatients)} returning`, delta: change(s.patients, p?.patients), look: LOOK.purple, icon: <Users size={22} strokeWidth={2.3} /> },
    { label: 'Tests done', value: data.tests, sub: s.patients ? `${(data.tests / s.patients).toFixed(1)} per patient` : 'None yet', delta: null, look: LOOK.teal, icon: <FlaskConical size={22} strokeWidth={2.3} /> },
    { label: 'Referred patients', value: s.referrals, sub: s.patients ? `${Math.round((s.referrals / s.patients) * 100)}% of patients` : 'None yet', delta: change(s.referrals, p?.referrals), look: LOOK.violet, icon: <Handshake size={22} strokeWidth={2.3} /> },
    { label: 'Still owed', value: s.outstanding.NGN ?? 0, money: true, sub: `${formatCount(s.openBills)} open bills at the end`, delta: null, look: LOOK.red, icon: <Clock3 size={22} strokeWidth={2.3} /> },
    { label: 'Costs', value: fin.costs, money: true, sub: 'Expenses and PR commission', delta: null, look: LOOK.orange, icon: <ArrowDownRight size={22} strokeWidth={2.4} /> },
  ];
  const methodTotal = data.methods.reduce((n, m) => n + m.value, 0);
  const loss = fin.net < 0;
  return (
    <>
      {/* Money in, the hero of the page */}
      <div ref={heroRef} className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#123e9c] via-[#1f6fe8] to-[#5ea6f7] p-5 text-white shadow-[0_18px_40px_rgba(31,99,214,0.32)]">
        <span aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-black/10" />
        <Sticker name="moneyBag" size={60} className="absolute right-4 top-[68px] drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
        <div className="relative flex gap-1 rounded-full bg-white/15 p-1 ring-1 ring-white/20 backdrop-blur-sm" role="group" aria-label="Analysis period" style={{ width: 'fit-content' }}>
          {(long ? (['today', 'yesterday', 'week', 'month', 'year'] as const) : (['today', 'yesterday', 'week', 'month'] as const)).map((k) => (
            <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)} className={`press min-h-8 rounded-full px-2.5 text-[12px] font-semibold ${key === k ? 'bg-white text-brand-700 shadow' : 'text-white/90'}`}>
              {k === 'today' ? 'Today' : k === 'yesterday' ? 'Yest.' : k === 'week' ? 'Week' : k === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>
        <p className="relative mt-4 text-[13px] font-medium text-white/85">Money in · {SHORT[key]}</p>
        <p className="relative text-[34px] font-bold leading-none tracking-[-0.02em]">
          <CountUp value={s.payments.NGN ?? 0} format={(n) => naira(n)} seen={heroSeen} />
        </p>
        <p className="relative mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-white/90">
          {moneyDelta !== null && Number.isFinite(moneyDelta) && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-bold ${moneyDelta >= 0 ? 'bg-[#34d07f]/25 text-[#d8ffe9]' : 'bg-[#ff6b6b]/25 text-[#ffe1e1]'}`}>
              {moneyDelta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(moneyDelta).toFixed(1)}%
            </span>
          )}
          <span>{rangeText(range)}{prior ? ' · vs the period before' : ''}</span>
        </p>
        <div className="relative -mx-1 mt-3">
          <Spark values={data.tr.payments} />
        </div>
        <div className="relative mt-2 grid grid-cols-3 gap-2">
          {[
            { l: 'Billed', v: naira(s.revenue.NGN ?? 0, true) },
            { l: 'Costs', v: naira(fin.costs, true) },
            profit ? { l: loss ? 'Net loss' : 'Net profit', v: naira(Math.abs(fin.net), true), hot: true } : { l: 'Money in', v: naira(fin.income, true), hot: false },
          ].map((x) => (
            <span key={x.l} className={`min-w-0 rounded-2xl px-2.5 py-2 ring-1 backdrop-blur-sm ${x.hot ? (loss ? 'bg-[#ff6b6b]/25 ring-[#ffb4b4]/40' : 'bg-[#34d07f]/25 ring-[#9cf0c4]/40') : 'bg-white/15 ring-white/20'}`}>
              <span className="block truncate text-[11px] text-white/85">{x.l}</span>
              <b className="block truncate text-[15px]">{x.v}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Money in at a glance */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
        {glance.map((g) => (
          <button key={g.key} type="button" onClick={() => setKey(g.key)} aria-pressed={key === g.key} className={`press min-w-[132px] shrink-0 rounded-[18px] px-3 py-2.5 text-left ring-1 transition-colors ${key === g.key ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-line/70'}`}>
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
              <CalendarDays size={13} className={key === g.key ? 'text-brand-600' : ''} /> {SHORT[g.key]}
            </span>
            <b className={`block text-[16px] ${key === g.key ? 'text-brand-700' : 'text-ink'}`}>{naira(g.value, true)}</b>
          </button>
        ))}
      </div>

      {/* Key figures */}
      <h2 className="mb-2.5 mt-5 text-[18px] font-bold tracking-[-0.01em] text-ink">Key figures</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t, i) => (
          <FigTile key={t.label} t={t} i={i} />
        ))}
      </div>

      <Section icon={<TrendingUp size={18} />} tint="bg-brand-50 text-brand-600" title="Billed and money in" note={`${data.tr.note} · tap the chart to read a day`}>
        <LineChart
          labels={data.tr.labels}
          format={(n) => naira(n, true)}
          series={[
            { name: 'Money in', color: BRAND, values: data.tr.payments },
            { name: 'Billed', color: '#8fb8ff', values: data.tr.revenue, dashed: true },
            { name: 'Expenses', color: '#f27a1a', values: data.tr.expenses },
          ]}
        />
      </Section>
      <Section icon={<Wallet size={18} />} tint="bg-tint-green text-good" title="Money in and costs" note="What the money received paid for, and what was left as profit">
        <Donut
          label="Money in"
          total={naira(fin.income, true)}
          format={(n) => naira(n, true)}
          parts={[
            { label: 'Costs', value: fin.costs, color: '#f27a1a', sub: 'expenses and PR commission' },
            ...(fin.net > 0 && profit ? [{ label: 'Net profit', value: fin.net, color: '#16a34a', sub: 'admin only' }] : fin.net > 0 ? [{ label: 'Left after costs', value: fin.net, color: '#16a34a', sub: 'money in less costs' }] : []),
          ]}
        />
        {loss && profit && <p className="mt-2 rounded-2xl bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#b42318]">Costs were {naira(-fin.net, true)} more than the money received.</p>}
      </Section>
      {methodTotal > 0 && (
        <Section icon={<CreditCard size={18} />} tint="bg-tint-orange text-orange" title="Payment methods" note="How patients paid in this period">
          <Donut label="Received" total={naira(methodTotal, true)} format={(v) => naira(v, true)} parts={data.methods.map((m, i) => ({ label: m.label, value: m.value, color: ['#1f6fe8', '#16a34a', '#f59e0b'][i] ?? '#64748b' }))} />
        </Section>
      )}
      {data.services.length > 0 && (
        <Section icon={<FlaskConical size={18} />} tint="bg-[#e6f6f7] text-[#0c7f86]" title="Most done tests" note="Tap a test for the patients who did it" flush>
          <BarList
            color="bg-[#139aa0]"
            rows={data.services.map((x) => ({ key: String(x.id), label: x.name, sub: x.category, value: x.count, text: `×${formatCount(x.count)}` }))}
            onRow={(k) => {
              const x = data.services.find((y) => String(y.id) === k);
              if (x) setFocus({ kind: 'service', id: x.id, name: x.name });
            }}
          />
        </Section>
      )}
      {data.agents.length > 0 && (
        <Section icon={<Handshake size={18} />} tint="bg-tint-purple text-violet" title="Top PR agents" note="Tap an agent for their profile" flush>
          <BarList color="bg-violet" rows={data.agents.map((a) => ({ key: String(a.id), label: a.name, sub: a.hospitalKey || 'No hospital assigned', value: a.referrals, text: `${formatCount(a.referrals)} ref.` }))} onRow={(k) => setFocus({ kind: 'agent', id: Number(k) })} />
        </Section>
      )}
      {focus && <FocusSheet focus={focus} branchIds={ids} period={{ key }} onClose={() => setFocus(null)} />}
    </>
  );
}

/* ─────────────── figure tiles and section cards ─────────────── */

const LOOK = {
  blue: { bg: 'from-[#eef5ff] to-[#dcebff]', icon: 'bg-brand-600 text-white', ink: 'text-brand-800', ring: 'ring-[#d6e7ff]' },
  purple: { bg: 'from-[#f5f0ff] to-[#e9e0ff]', icon: 'bg-violet text-white', ink: 'text-violet', ring: 'ring-[#e2d8ff]' },
  teal: { bg: 'from-[#eafafa] to-[#d3f1f1]', icon: 'bg-[#0c7f86] text-white', ink: 'text-[#0c6b71]', ring: 'ring-[#c9ecec]' },
  violet: { bg: 'from-[#f1efff] to-[#e1ddff]', icon: 'bg-[#4f46e5] text-white', ink: 'text-[#3730a3]', ring: 'ring-[#dcd8ff]' },
  red: { bg: 'from-[#fff1f1] to-[#ffdede]', icon: 'bg-[#d93036] text-white', ink: 'text-[#b42318]', ring: 'ring-[#f9d4d4]' },
  orange: { bg: 'from-[#fff6ec] to-[#ffe7cc]', icon: 'bg-orange text-white', ink: 'text-warn-ink', ring: 'ring-[#ffe0b8]' },
};
interface Fig {
  label: string;
  value: number;
  money?: boolean;
  sub: string;
  delta: number | null;
  look: (typeof LOOK)[keyof typeof LOOK];
  icon: ReactNode;
}

function FigTile({ t, i }: { t: Fig; i: number }) {
  const { ref, seen } = useSeen<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`relative min-w-0 overflow-hidden rounded-[22px] bg-linear-to-br p-3.5 ring-1 ${t.look.bg} ${t.look.ring}`} style={{ opacity: seen ? 1 : 0, transform: seen ? 'none' : 'translateY(10px) scale(0.98)', transition: `opacity 500ms ease ${i * 70}ms, transform 500ms cubic-bezier(0.22,0.8,0.24,1) ${i * 70}ms` }}>
      <span aria-hidden="true" className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/40" />
      <span className="relative flex items-center justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl shadow-sm ${t.look.icon}`}>{t.icon}</span>
        {t.delta !== null && Number.isFinite(t.delta) && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${t.delta >= 0 ? 'bg-white text-good-ink' : 'bg-white text-[#b42318]'}`}>
            {t.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(t.delta).toFixed(1)}%
          </span>
        )}
      </span>
      <p className="relative mt-3 text-[12.5px] font-semibold text-ink-2">{t.label}</p>
      <p className={`relative truncate text-[22px] font-bold leading-tight tracking-[-0.02em] ${t.look.ink}`}>
        <CountUp value={t.value} seen={seen} format={(n) => (t.money ? naira(n, true) : formatCount(Math.round(n)))} />
      </p>
      <p className="relative mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted">{t.sub}</p>
    </div>
  );
}

function Section({ icon, tint, title, note, children, flush }: { icon: ReactNode; tint: string; title: string; note?: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className="mt-4 overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
      <div className={`flex items-center gap-3 px-4 pt-4 ${flush ? 'pb-1' : 'pb-3'}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tint}`}>{icon}</span>
        <span className="min-w-0">
          <span className="block text-[16px] font-bold text-ink">{title}</span>
          {note && <span className="block truncate text-[12px] text-muted">{note}</span>}
        </span>
      </div>
      <div className={flush ? '' : 'px-4 pb-4'}>{children}</div>
    </section>
  );
}

/* ─────────────── report cards ─────────────── */

const STICKER: Record<string, 'chart' | 'stethoscope' | 'hospital' | 'testTube' | 'moneyBag' | 'womanHealthWorker'> = { revenue: 'chart', agents: 'stethoscope', hospitals: 'hospital', services: 'testTube', payments: 'moneyBag', staff: 'womanHealthWorker' };
const CARD_THEME: Record<string, string> = {
  revenue: 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]',
  agents: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]',
  hospitals: 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]',
  services: 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]',
  payments: 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]',
  staff: 'from-[#3346c9] via-[#4f63e6] to-[#8796f7]',
};

function ReportCard({ spec, onCreate, i }: { spec: ReportSpec; onCreate: () => void; i: number }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className={`press relative flex min-h-[176px] flex-col overflow-hidden rounded-[24px] bg-linear-to-br p-3.5 text-left text-white shadow-[0_12px_26px_rgba(20,40,90,0.18)] ${CARD_THEME[spec.id] ?? CARD_THEME.revenue}`}
      style={{ animation: `pick-in 520ms cubic-bezier(0.22,0.8,0.24,1) ${i * 70}ms both` }}
    >
      <span aria-hidden="true" className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/12" />
      <Sticker name={STICKER[spec.id] ?? 'chart'} size={52} className="relative drop-shadow-[0_6px_12px_rgba(0,0,0,0.2)]" />
      <span className="relative mt-2 block text-[15.5px] font-bold leading-tight">{spec.title}</span>
      <span className="relative mt-0.5 line-clamp-2 block text-[12px] leading-snug text-white/85">{spec.tagline}</span>
      <span className="relative mt-auto flex items-center justify-between pt-3">
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/25">
          {spec.variants.length} type{spec.variants.length === 1 ? '' : 's'}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow">
          <ChevronRight size={17} />
        </span>
      </span>
    </button>
  );
}

/* ─────────────── builder (desktop ReportBuilder rules) ─────────────── */

const NO_COLUMNS: string[] = [];
type Preset = 'today' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';
type Output = 'print' | 'pdf' | 'csv';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom dates' },
];
function presetRange(p: Preset, from: string, to: string): DateRange {
  if (p === 'lastMonth') {
    const start = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
    const end = new Date(TODAY.getFullYear(), TODAY.getMonth(), 0);
    return resolveRange({ key: 'custom', from: isoDate(start < DATA_START ? DATA_START : start), to: isoDate(end) });
  }
  if (p === 'custom') return resolveRange({ key: 'custom', from, to });
  return resolveRange({ key: p });
}
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function monthRange(key: string): DateRange {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return resolveRange({ key: 'custom', from: isoDate(start < DATA_START ? DATA_START : start), to: isoDate(end > TODAY ? TODAY : end) });
}
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const name = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return key === monthKeyOf(TODAY) ? `${name} (so far)` : name;
};
function availableMonths(): string[] {
  const out: string[] = [];
  for (let d = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); d >= new Date(DATA_START.getFullYear(), DATA_START.getMonth(), 1); d = new Date(d.getFullYear(), d.getMonth() - 1, 1)) out.push(monthKeyOf(d));
  return out;
}
const dayText = (d: Date) => `${formatShortDate(d)} ${d.getFullYear()}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

async function printPages(doc: ReturnType<ReportSpec['build']>, pages: Page[], paper: Paper) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(<AllPages doc={doc} pages={pages} paper={paper} company={companyName()} />);
  const size = paper.size === 'Letter' ? 'letter' : paper.size;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title><link rel="stylesheet" href="${REPORT_FONT_URL}"><style>${REPORT_CSS}
:root{--rp-brand:${BRAND};--rp-brand-ink:${BRAND_INK}}@page{size:${size} ${paper.orientation};margin:0}html,body{margin:0;padding:0;background:#fff}
.rp-page{break-after:page;page-break-after:always}.rp-page:last-child{break-after:auto;page-break-after:auto}</style></head><body>${markup}</body></html>`;
  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  await new Promise((r) => setTimeout(r, 300));
  try {
    await Promise.race([w.document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]);
  } catch {
    /* offline: the system font is used, as in the preview */
  }
  w.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 500), { once: true });
  setTimeout(() => frame.remove(), 120_000);
  w.focus();
  w.print();
}

function BuilderSheet({ spec, initialBranch, onClose, lockBranch = false, long = true }: { spec: ReportSpec; initialBranch: string; onClose: () => void; /** Branch workspace: its own branch only. */ lockBranch?: boolean; /** Periods longer than a month. */ long?: boolean }) {
  const { agents: raw, user } = useCompany();
  const { showToast } = useNav();
  const banks = useAgentBanks();
  // The payout report groups agents by bank: include the account details kept on this device.
  const agents = useMemo(() => raw.map((a) => (a.bank || !banks[a.id] ? a : { ...a, bank: banks[a.id] })), [raw, banks]);
  const hideProfit = user.kind !== 'admin';
  setReportPreparer(user.name, user.role);

  const [variant, setVariant] = useState(spec.variants[0]!.id);
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(isoDate(addDays(TODAY, -6)));
  const [to, setTo] = useState(isoDate(TODAY));
  const [month, setMonth] = useState(() => monthKeyOf(TODAY.getMonth() > DATA_START.getMonth() || TODAY.getFullYear() > DATA_START.getFullYear() ? new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1) : TODAY));
  const [branch, setBranch] = useState(initialBranch);
  const [options, setOptions] = useState<Record<string, boolean>>(() => Object.fromEntries((spec.options ?? []).map((o) => [o.id, o.default])));
  const [columns, setColumns] = useState<Record<string, string[]>>(() => Object.fromEntries(Object.entries(spec.columns ?? {}).map(([v, defs]) => [v, defs.filter((d) => d.default).map((d) => d.id)])));
  const [selects, setSelects] = useState<Record<string, string>>(() => Object.fromEntries((spec.selects ?? []).map((s) => [s.id, s.default])));
  const [paperChoice, setPaperChoice] = useState<Paper | null>(null);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<Output | null>(null);
  const [confirm, setConfirm] = useState<Output | null>(null);

  const v = spec.variants.find((x) => x.id === variant)!;
  const dated = v.dated !== false;
  const monthly = v.periodMode === 'month';
  const range = useMemo(() => (monthly ? monthRange(month) : presetRange(preset, from, to)), [monthly, month, preset, from, to]);
  const cols = columns[variant] ?? NO_COLUMNS;
  const optionDefs = (spec.options ?? []).filter((o) => !o.variants || o.variants.includes(variant));
  const selectDefs = (spec.selects ?? []).filter((s) => !s.variants || s.variants.includes(variant));
  const columnDefs = spec.columns?.[variant];
  const recommended = spec.suggestPaper({ variant, range, branch, options, columns: cols, selects, paper: { size: 'A4', orientation: 'portrait' } });
  const chosen = paperChoice ?? recommended;
  const paperKey = `${chosen.size}|${chosen.orientation}`;
  // One stable object per size and orientation (a new object each render would lay the pages out forever).
  const paper = useMemo<Paper>(() => {
    const [size, orientation] = paperKey.split('|') as [PaperSize, Orientation];
    return { size, orientation };
  }, [paperKey]);
  const params = useMemo<ReportParams>(() => ({ variant, range, branch, options, columns: cols, selects, paper }), [variant, range, branch, options, cols, selects, paper]);
  const doc = useMemo(() => spec.build(params, { agents, hideProfit }), [spec, params, agents, hideProfit]);
  const { pages, measurer } = usePagination(doc, paper);
  const rows = tableRowCount(doc);
  const toggleColumn = (id: string) =>
    setColumns((c) => {
      const list = c[variant] ?? [];
      const on = list.includes(id);
      return { ...c, [variant]: on ? list.filter((x) => x !== id) : (columnDefs ?? []).map((x) => x.id).filter((x) => x === id || list.includes(x)) };
    });
  const reminders = [
    ...(columnDefs ?? []).filter((d) => !d.required && !cols.includes(d.id)).map((d) => ({ id: `c-${d.id}`, label: `${d.label} column`, recommended: d.default, include: () => toggleColumn(d.id) })),
    ...optionDefs.filter((o) => !options[o.id]).map((o) => ({ id: `o-${o.id}`, label: o.label, recommended: o.default, include: () => setOptions((x) => ({ ...x, [o.id]: true })) })),
  ];
  const missing = reminders.filter((r) => r.recommended);
  const period = !dated ? 'Not needed' : monthly ? monthLabel(month) : range.days === 1 ? dayText(range.from) : `${dayText(range.from)} to ${dayText(range.to)}`;

  const run = async (o: Output) => {
    setConfirm(null);
    logAudit({
      category: 'Reports',
      action: o === 'print' ? 'Report printed' : o === 'pdf' ? 'Report downloaded (PDF)' : 'Report exported (spreadsheet)',
      record: doc.title,
      details: `${doc.subtitle} · ${paperName(paper)}${missing.length ? ` · left out: ${missing.map((r) => r.label).join(', ')}` : ''}`,
      branchId: branch === 'all' ? null : branch,
    });
    if (o === 'csv') {
      saveFile(`${doc.filename}.csv`, toCsv(doc), 'text/csv;charset=utf-8');
      showToast(`Saved ${doc.filename}.csv. It opens in Excel`);
      return;
    }
    setBusy(o);
    try {
      if (o === 'print' && pages) await printPages(doc, pages, paper);
      if (o === 'pdf') {
        await savePdf(doc, paper, BRAND, companyName());
        showToast(`Saved ${doc.filename}.pdf`);
      }
    } finally {
      setBusy(null);
    }
  };
  const request = (o: Output) => (missing.length ? setConfirm(o) : run(o));
  const STEPS = ['Choose report', 'Choose content', 'Paper and review'];

  return (
    <Sheet
      title={spec.title}
      subtitle={`Step ${step + 1} of 3 · ${STEPS[step]}`}
      onClose={onClose}
      tall
      footer={
        step < 2 ? (
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="press min-h-12 rounded-2xl bg-page px-5 text-[15px] font-semibold text-ink-2 ring-1 ring-line">
                Back
              </button>
            )}
            <button type="button" onClick={() => setStep(step + 1)} className="press flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              Next: {STEPS[step + 1]} <ChevronRight size={17} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" onClick={() => setPreview(true)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              <Eye size={18} /> Preview {pages ? `${pages.length} page${pages.length === 1 ? '' : 's'}` : ''}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <OutBtn icon={<Printer size={17} />} label={busy === 'print' ? 'Opening' : 'Print'} disabled={!pages || !!busy} onClick={() => request('print')} />
              <OutBtn icon={<Download size={17} />} label={busy === 'pdf' ? 'Saving' : 'PDF'} disabled={!!busy} onClick={() => request('pdf')} />
              <OutBtn icon={<FileSpreadsheet size={17} />} label="Spreadsheet" disabled={!!busy} onClick={() => request('csv')} />
            </div>
          </div>
        )
      }
    >
      {/* Steps */}
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {STEPS.map((s, i) => (
          <button key={s} type="button" onClick={() => setStep(i)} className="text-left">
            <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-[#e3ebf7]'}`} />
            <span className={`mt-1 block truncate text-[11.5px] font-semibold ${i === step ? 'text-brand-700' : 'text-muted'}`}>{s}</span>
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4 px-1 pb-2">
          <p className="rounded-2xl bg-brand-50 p-3 text-[13px] leading-snug text-brand-800">{spec.guide}</p>
          <div>
            <p className="mb-2 text-[14px] font-semibold text-ink">Report type</p>
            <div className="space-y-2">
              {spec.variants.map((x) => (
                <Choice key={x.id} on={variant === x.id} title={x.label} sub={x.description} onClick={() => setVariant(x.id)} />
              ))}
            </div>
          </div>
          {dated && (
            <div>
              <p className="mb-2 text-[14px] font-semibold text-ink">Period</p>
              {monthly ? (
                <div className="flex flex-wrap gap-2">
                  {availableMonths().map((k) => (
                    <Pill key={k} on={month === k} label={monthLabel(k)} onClick={() => setMonth(k)} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.filter((p) => long || p.id !== 'year').map((p) => (
                      <Pill key={p.id} on={preset === p.id} label={p.label} onClick={() => setPreset(p.id)} />
                    ))}
                  </div>
                  {preset === 'custom' && (
                    <div className="drop-down mt-2 grid grid-cols-2 gap-2">
                      <label className="min-w-0">
                        <span className="mb-1 block text-[12.5px] text-muted">From</span>
                        <input type="date" value={from} min={isoDate(DATA_START)} max={to} onChange={(e) => setFrom(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block text-[12.5px] text-muted">To</span>
                        <input type="date" value={to} min={from} max={isoDate(TODAY)} onChange={(e) => setTo(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
                      </label>
                    </div>
                  )}
                </>
              )}
              <p className="mt-2 text-[12.5px] text-muted">
                {period}
                {v.periodNote ? ` · ${v.periodNote}` : ''}. Records start on {formatShortDate(DATA_START)}.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 px-1 pb-2">
          {lockBranch ? (
            <p className="rounded-2xl bg-page px-3.5 py-2.5 text-[13.5px] text-ink-2">
              Branch: <b className="text-ink">{getBranch(branch)?.name ?? branch} branch</b>
            </p>
          ) : (
          <div>
            <p className="mb-2 text-[14px] font-semibold text-ink">Branch</p>
            <div className="flex flex-wrap gap-2">
              <Pill on={branch === 'all'} label="All branches" onClick={() => setBranch('all')} />
              {BRANCHES.filter((b) => b.status === 'Active').map((b) => (
                <Pill key={b.id} on={branch === b.id} label={`${b.name} · ${b.code}`} onClick={() => setBranch(b.id)} />
              ))}
            </div>
          </div>
          )}
          {selectDefs.map((sd) => (
            <div key={sd.id}>
              <p className="text-[14px] font-semibold text-ink">{sd.label}</p>
              <p className="mb-2 text-[12.5px] text-muted">{sd.help}</p>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {sd.options({ agents }).map((o) => (
                  <Pill key={o.value} on={selects[sd.id] === o.value} label={o.label} onClick={() => setSelects((x) => ({ ...x, [sd.id]: o.value }))} />
                ))}
              </div>
            </div>
          ))}
          {columnDefs && (
            <div>
              <p className="text-[14px] font-semibold text-ink">Columns · {cols.length} chosen</p>
              <p className="mb-2 text-[12.5px] text-muted">Fewer columns fit better and read more easily.</p>
              <div className="flex flex-wrap gap-2">
                {columnDefs.map((d) => (
                  <button key={d.id} type="button" disabled={d.required} aria-pressed={cols.includes(d.id)} onClick={() => toggleColumn(d.id)} className={`press flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold disabled:opacity-70 ${cols.includes(d.id) ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                    {cols.includes(d.id) && <Check size={14} />}
                    {d.label}
                    {d.required && <span className="text-[11px] font-normal">· always</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {optionDefs.length > 0 && (
            <div>
              <p className="mb-2 text-[14px] font-semibold text-ink">Extras</p>
              <div className="space-y-2">
                {optionDefs.map((o) => (
                  <button key={o.id} type="button" role="switch" aria-checked={!!options[o.id]} onClick={() => setOptions((x) => ({ ...x, [o.id]: !x[o.id] }))} className="press flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-ink">{o.label}</span>
                      <span className="block text-[12px] text-muted">{o.help}</span>
                    </span>
                    <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${options[o.id] ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
                      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${options[o.id] ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!selectDefs.length && !columnDefs && !optionDefs.length && <p className="rounded-2xl bg-page p-3 text-[13px] text-muted">This report has no content choices.</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 px-1 pb-2">
          <div>
            <p className="mb-2 text-[14px] font-semibold text-ink">Paper</p>
            <div className="flex flex-wrap gap-2">
              {(['A4', 'A3', 'Letter'] as PaperSize[]).map((s) => (
                <Pill key={s} on={paper.size === s} label={PAPER_LABEL[s]} onClick={() => setPaperChoice({ ...paper, size: s })} />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {(['portrait', 'landscape'] as Orientation[]).map((o) => (
                <Pill key={o} on={paper.orientation === o} label={o === 'portrait' ? 'Portrait' : 'Landscape'} onClick={() => setPaperChoice({ ...paper, orientation: o })} />
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              Suggested: {paperName(recommended)}
              {paperChoice && paperName(paperChoice) !== paperName(recommended) ? ' (you changed it)' : ''}. Landscape suits wide tables.
            </p>
          </div>
          <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/70">
            {[
              ['Report', v.label],
              ['Period', period],
              ['Branch', branch === 'all' ? 'All branches' : `${getBranch(branch)?.name ?? branch} branch`],
              ['Content', [columnDefs ? `${cols.length} columns` : '', optionDefs.length ? `${optionDefs.filter((o) => options[o.id]).length} of ${optionDefs.length} extras` : ''].filter(Boolean).join(' · ') || 'Standard'],
              ['Size', `${pages ? `${pages.length} page${pages.length === 1 ? '' : 's'}` : 'Laying out'} · ${formatCount(rows)} rows · ${paperName(paper)}`],
            ].map(([l, x]) => (
              <div key={l} className="flex items-start justify-between gap-3 border-b border-line px-3.5 py-2.5 text-[13.5px] last:border-0">
                <span className="text-muted">{l}</span>
                <b className="text-right text-ink">{x}</b>
              </div>
            ))}
          </div>
          {reminders.length > 0 ? (
            <div className="rounded-[20px] bg-[#fff7ec] p-3 ring-1 ring-[#ffe0b8]">
              <p className="mb-2 text-[13.5px] font-semibold text-[#9a4a07]">Left out of this report</p>
              <ul className="space-y-1.5">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-[13px] text-ink">
                    <span>
                      {r.label}
                      {r.recommended && <span className="ml-1 text-[11.5px] text-[#b45309]">usually included</span>}
                    </span>
                    <button type="button" onClick={r.include} className="press shrink-0 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-600 ring-1 ring-line">
                      Include
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl bg-tint-green px-3.5 py-2.5 text-[13px] font-semibold text-good-ink">
              <Check size={16} /> Everything usually included is in. Ready to print.
            </p>
          )}
          <p className="text-[12px] text-muted">Print opens the phone's print screen, where you can also save as PDF. PDF downloads the file; Spreadsheet saves a CSV that opens in Excel. Each is recorded in the Audit Log.</p>
        </div>
      )}

      {/* Hidden measuring area for page layout (desktop rule: text is never cut). */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', ['--rp-brand' as string]: BRAND, ['--rp-brand-ink' as string]: BRAND_INK }}>
        <style>{REPORT_CSS}</style>
        {measurer}
      </div>

      {preview && pages && <PreviewSheet doc={doc} pages={pages} paper={paper} onClose={() => setPreview(false)} onOutput={(o) => request(o)} busy={busy} />}
      {confirm && (
        <Sheet
          back
          title="Some usual parts are left out"
          subtitle="Include them, or continue without them"
          onClose={() => setConfirm(null)}
          footer={
            <button type="button" onClick={() => run(confirm)} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              Continue without them
            </button>
          }
        >
          <ul className="space-y-2 px-1 pb-2">
            {missing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-page px-3.5 py-2.5 text-[14px] text-ink">
                {r.label}
                <button
                  type="button"
                  onClick={() => {
                    r.include();
                    if (missing.length === 1) {
                      setConfirm(null);
                      showToast('Added to the report. Check the preview, then choose your output again');
                    }
                  }}
                  className="press shrink-0 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-600 ring-1 ring-line"
                >
                  Include
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </Sheet>
  );
}

function OutBtn({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="press flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-page text-[12.5px] font-semibold text-ink-2 ring-1 ring-line disabled:opacity-50">
      {icon}
      {label}
    </button>
  );
}

function Choice({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`press flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 ${on ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-line'}`}>
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand-600' : 'border-[#c4cedd]'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
      <span>
        <span className={`block text-[14.5px] font-semibold ${on ? 'text-brand-700' : 'text-ink'}`}>{title}</span>
        <span className="block text-[12.5px] leading-snug text-muted">{sub}</span>
      </span>
    </button>
  );
}

function Pill({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`press min-h-10 rounded-xl px-3.5 text-[13.5px] font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
      {label}
    </button>
  );
}

/**
 * Every page of the report (owner, 2026-11-25: pages are small on a phone, so
 * the preview zooms with the fingers, without leaving it or downloading):
 *  • two fingers pinch to zoom in or out (1× to 4×) around the pinch point;
 *  • one finger moves around the zoomed pages (normal scrolling);
 *  • double tap zooms to 2.5× there, or back to fit;
 *  • − / + / Fit buttons for one-handed use.
 * Zooming really enlarges the pages (no blurry stretched picture).
 */
function PreviewSheet({ doc, pages, paper, onClose, onOutput, busy }: { doc: ReturnType<ReportSpec['build']>; pages: Page[]; paper: Paper; onClose: () => void; onOutput: (o: Output) => void; busy: Output | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [z, setZ] = useState(1);
  const zRef = useRef(1);
  zRef.current = z;
  const pending = useRef<{ x: number; y: number; cx: number; cy: number; z0: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w: pw, h: ph } = paperPx(paper);
  const fit = Math.min(1, w / pw);
  const scale = fit * z;
  // The scrolling areas: horizontal (ours) and vertical (the slide-up's content).
  const scrollers = () => {
    const hx = box.current?.querySelector<HTMLElement>('[data-zoom-x]') ?? null;
    const vy = box.current?.closest<HTMLElement>('.overflow-y-auto') ?? null;
    return { hx, vy };
  };
  /** Zoom to `nz`, keeping the content under the screen point (cx, cy) where it is. */
  const zoomAt = (nz: number, cx: number, cy: number) => {
    const z0 = zRef.current;
    const next = Math.min(4, Math.max(1, nz));
    if (Math.abs(next - z0) < 0.001) return;
    const { hx, vy } = scrollers();
    const hr = hx?.getBoundingClientRect();
    const vr = vy?.getBoundingClientRect();
    const px = (hx?.scrollLeft ?? 0) + cx - (hr?.left ?? 0);
    const py = (vy?.scrollTop ?? 0) + cy - (vr?.top ?? 0);
    pending.current = { x: px, y: py, cx: cx - (hr?.left ?? 0), cy: cy - (vr?.top ?? 0), z0 };
    setZ(next);
  };
  // After the pages grow or shrink, scroll so the pinch point stays under the fingers.
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const { hx, vy } = scrollers();
    const k = z / p.z0;
    if (hx) hx.scrollLeft = p.x * k - p.cx;
    if (vy) vy.scrollTop = p.y * k - p.cy;
  }, [z]);
  // Pinch (two fingers) and double tap.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let pinch: { d0: number; z0: number } | null = null;
    let lastTap = 0;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const mid = (t: TouchList) => ({ x: (t[0]!.clientX + t[1]!.clientX) / 2, y: (t[0]!.clientY + t[1]!.clientY) / 2 });
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinch = { d0: dist(e.touches), z0: zRef.current };
        e.preventDefault();
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          const t = e.touches[0]!;
          zoomAt(zRef.current > 1.2 ? 1 : 2.5, t.clientX, t.clientY);
          lastTap = 0;
          e.preventDefault();
        } else lastTap = now;
      }
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const m = mid(e.touches);
      zoomAt(pinch.z0 * (dist(e.touches) / pinch.d0), m.x, m.y);
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const center = () => {
    const r = box.current?.getBoundingClientRect();
    return { x: (r?.left ?? 0) + (r?.width ?? 0) / 2, y: window.innerHeight / 2 };
  };
  const step = (k: number) => {
    const c = center();
    zoomAt(zRef.current * k, c.x, c.y);
  };
  return (
    <Sheet
      back
      title="Preview"
      subtitle={`${doc.title} · ${pages.length} page${pages.length === 1 ? '' : 's'} · ${paperName(paper)}`}
      onClose={onClose}
      tall
      footer={
        <div className="grid grid-cols-3 gap-2">
          <OutBtn icon={<Printer size={17} />} label={busy === 'print' ? 'Opening' : 'Print'} disabled={!!busy} onClick={() => onOutput('print')} />
          <OutBtn icon={<Download size={17} />} label={busy === 'pdf' ? 'Saving' : 'PDF'} disabled={!!busy} onClick={() => onOutput('pdf')} />
          <OutBtn icon={<FileSpreadsheet size={17} />} label="Spreadsheet" disabled={!!busy} onClick={() => onOutput('csv')} />
        </div>
      }
    >
      <div ref={box} data-no-swipe className="relative pb-2" style={{ ['--rp-brand' as string]: BRAND, ['--rp-brand-ink' as string]: BRAND_INK, touchAction: 'pan-x pan-y' }}>
        <style>{REPORT_CSS}</style>
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[12px] text-muted">
          <ZoomIn size={14} /> Pinch with two fingers to zoom, or double tap a spot.
        </p>
        <div data-zoom-x className="overflow-x-auto overscroll-x-contain">
          <div className="space-y-3" style={{ width: pw * scale }}>
            {pages.map((pg, i) => (
              <div key={i} className="overflow-hidden rounded-md bg-white shadow-[0_4px_18px_rgba(11,23,48,0.14)] ring-1 ring-line" style={{ width: pw * scale, height: ph * scale }}>
                <div style={{ width: pw, height: ph, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <PageView doc={doc} page={pg} index={i} count={pages.length} paper={paper} company={companyName()} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Zoom controls, always within reach of the thumb */}
        <div className="sticky bottom-2 z-10 mt-3 flex justify-center">
          <div className="flex items-center gap-1 rounded-full bg-ink/90 p-1 text-white shadow-[0_8px_24px_rgba(11,23,48,0.3)] backdrop-blur">
            <button type="button" onClick={() => step(1 / 1.5)} disabled={z <= 1} aria-label="Zoom out" className="press grid h-9 w-9 place-items-center rounded-full disabled:opacity-40">
              <ZoomOut size={18} />
            </button>
            <span className="min-w-[52px] text-center text-[13px] font-semibold">{Math.round(z * 100)}%</span>
            <button type="button" onClick={() => step(1.5)} disabled={z >= 4} aria-label="Zoom in" className="press grid h-9 w-9 place-items-center rounded-full disabled:opacity-40">
              <ZoomIn size={18} />
            </button>
            <button type="button" onClick={() => setZ(1)} disabled={z === 1} className="press h-9 rounded-full bg-white/15 px-3 text-[12.5px] font-semibold disabled:opacity-40">
              Fit
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
