/**
 * Finance & Expenses (mobile, owner 2026-11-25): same content and rules as the
 * desktop FinancePage + FinanceWorkspace (src/company finance / ledger), in the
 * admin's mobile card language. Branch first: choose a branch (each keeps its
 * own books in its own currency), then
 *   1. Financial position: Today / This month / This year (fixed periods).
 *   2. Analysis for the page's own dates (starts on This month; never changes
 *      the dashboard's period): money in, costs, net profit, outstanding,
 *      income vs expenses, net profit by day, where the money came from,
 *      payment methods, where the money went, revenue by service, ageing.
 *   3. Finance log: every naira in and out with its source (slide-up with
 *      search, type, sort and its own dates). Bills open the visit record;
 *      expenses drop down to who recorded and approved them.
 *   4. Outstanding patient balances, oldest recovered first.
 *   5. Expenses waiting for the admin's approval (desktop: Settings, Approvals).
 * Cash basis: income = money received; costs = approved expenses + accrued PR
 * commission; net profit = income minus costs. Read only, except approvals.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, CircleAlert, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { PAYMENT_METHODS, type PaymentMethod, type PeriodSelection } from '@company/data/types';
import { EXPENSE_ITEMS, ledger, openBalances, type LedgerEntry, type OpenBalance } from '@company/data/demo/dailyLines';
import { financeTotals, financeTrend } from '@company/services/finance';
import { resolveRange, serviceRanking } from '@company/services/analytics';
import { rateSummary, useCommission } from '@company/services/commission';
import { approveExpense, rejectExpense, useExpenses, type ExpenseRecord } from '@company/services/expenses';
import { formatCount, formatMoney } from '@company/shared/format';
import { Sticker } from '@/ui/kit';
import { LongText } from '../fields';
import { BarList, Sheet, TrendChart, periodText, useSheetPeriod } from '../ui';
import { DetailSheet, ExpenseRow, FocusSheet, Rows, norm, useRowCtx, visitRow, type DetailKind, type Focus, type Row } from '../details';
import { AdminTopBar, PageGlow, SectionTitle } from '../kit';
import { Donut, LineChart, useSeen } from '../charts';
import { PICK_THEME, BranchCrumb, BranchPick, Chips, Facts, PageTitle, Panel, PeriodChip, useBranchFirst } from '../branchFirst';

const BASE: PeriodSelection = { key: 'month' };
const KIND_LABEL: Record<LedgerEntry['kind'], string> = { visit: 'Patient bill', recovery: 'Recovered', expense: 'Expense', commission: 'PR commission' };
type LogType = 'all' | 'income' | 'recovered' | 'expenses' | 'commission';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const AGES = [
  { label: '0 to 30 days', color: '#5b9bff', test: (d: number) => d <= 30 },
  { label: '31 to 60 days', color: '#f59e0b', test: (d: number) => d > 30 && d <= 60 },
  { label: '61 to 90 days', color: '#f27a1a', test: (d: number) => d > 60 && d <= 90 },
  { label: 'Over 90 days', color: '#d93036', test: (d: number) => d > 90 },
];

export function FinancePage({ sub }: { sub?: string }) {
  const { branch, fromScope } = useBranchFirst(sub);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar title={branch ? 'Finance' : undefined} />
      <div className="relative">{branch ? <Workspace branchId={branch.id} crumb={!fromScope} /> : <Choose />}</div>
    </div>
  );
}

function Choose() {
  return (
    <>
      <PageTitle title="Finance & Expenses" sub="Company finance · all branches" />
      <BranchPick
        page="finance"
        sticker="moneyBag"
        go="Open"
        theme={PICK_THEME.finance}
        note="Each branch keeps its own books, in its recorded currency. Choose a branch."
        stats={(b) => {
          const f = (n: number) => formatMoney(n, b.currency, true);
          const today = financeTotals(b.id, resolveRange({ key: 'today' }));
          const month = financeTotals(b.id, resolveRange({ key: 'month' }));
          const year = financeTotals(b.id, resolveRange({ key: 'year' }));
          return [
            { label: 'Money in today', value: f(today.income) },
            { label: month.net < 0 ? 'Loss, month' : 'Profit, month', value: f(Math.abs(month.net)), danger: month.net < 0 },
            { label: year.net < 0 ? 'Loss, year' : 'Profit, year', value: f(Math.abs(year.net)), danger: year.net < 0 },
            { label: 'Outstanding', value: f(today.outstanding) },
          ];
        }}
        foot={(b) => `${formatMoney(financeTotals(b.id, resolveRange({ key: 'year' })).recovered, b.currency, true)} recovered this year`}
      />
    </>
  );
}

/* ─────────────── one branch ─────────────── */

function Workspace({ branchId, crumb }: { branchId: string; crumb: boolean }) {
  const b = getBranch(branchId)!;
  const c = b.currency;
  const m = (n: number, compact = false) => formatMoney(n, c, compact);
  const ids = useMemo(() => [branchId], [branchId]);
  const { version } = useCommission();
  const [period, setPeriod] = useState<PeriodSelection>(BASE);
  const range = useMemo(() => resolveRange(period), [period]);
  const [detail, setDetail] = useState<{ kind: DetailKind; method?: PaymentMethod } | null>(null);
  const [log, setLog] = useState<{ type: LogType; category?: string } | null>(null);
  const [owed, setOwed] = useState<number | null | undefined>(undefined);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [bar, setBar] = useState<number | null>(null);
  const label = periodText(period);

  const t = useMemo(() => financeTotals(branchId, range), [branchId, range, version]);
  const tr = useMemo(() => financeTrend(branchId, range), [branchId, range, version]);
  const entries = useMemo(() => ledger(ids, range), [ids, range, version]);
  const balances = useMemo(() => openBalances(branchId, range.to), [branchId, range]);
  const services = useMemo(
    () =>
      serviceRanking(ids, range)
        .map((x) => ({ id: x.id, name: x.name, count: x.count, value: x.revenue[c] ?? 0 }))
        .filter((x) => x.value > 0)
        .sort((a, z) => z.value - a.value)
        .slice(0, 6),
    [ids, range, c],
  );
  const stats = useMemo(() => {
    const methods = PAYMENT_METHODS.map((pm) => ({ label: pm, value: 0, count: 0 }));
    const catCount = new Map<string, number>();
    let visitPays = 0;
    let recoveries = 0;
    for (const e of entries) {
      if (e.direction === 'in' && e.method) {
        const x = methods[PAYMENT_METHODS.indexOf(e.method)]!;
        x.value += e.amount;
        x.count += 1;
      }
      if (e.kind === 'visit') visitPays += 1;
      if (e.kind === 'recovery') recoveries += 1;
      if (e.direction === 'out') catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
    }
    return { methods, catCount, visitPays, recoveries };
  }, [entries]);
  const spent = [...t.expensesByCategory, { label: 'PR commission', value: t.commission }].filter((x) => x.value > 0).sort((a, z) => z.value - a.value);
  const ages = AGES.map((a, i) => {
    const list = balances.filter((x) => a.test(x.ageDays));
    return { ...a, i, value: list.reduce((s, x) => s + x.remaining, 0), count: list.length };
  });
  const totalOwed = balances.reduce((s, x) => s + x.remaining, 0);
  const latest = [...entries].sort((a, z) => z.at.getTime() - a.at.getTime());
  const totalIn = entries.reduce((s, e) => s + (e.direction === 'in' ? e.amount : 0), 0);
  const totalOut = entries.reduce((s, e) => s + (e.direction === 'out' ? e.amount : 0), 0);
  const ctx = useRowCtx(setFocus);

  return (
    <>
      {crumb && <BranchCrumb page="finance" label="Finance" branch={b} />}
      <PageTitle title="Finance & Expenses" sub={`${b.name} branch · ${c} · cash basis`} />
      <Position branchId={branchId} version={version} m={m} />
      <Approvals branchId={branchId} />

      <div className="mb-3 mt-7 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-[19px] font-bold tracking-[-0.01em] text-ink">Analysis</h2>
        <PeriodChip value={period} onChange={setPeriod} />
      </div>
      <p className="-mt-1 mb-3 text-[12.5px] text-muted">These dates apply to the charts, the finance log and the balances below. The dashboard's dates stay as they are.</p>

      <div className="grid grid-cols-2 gap-2.5">
        <Money tint="bg-tint-green border-[#cdeedb]" ink="text-[#14633a]" icon={<ArrowDownRight size={22} className="text-good" strokeWidth={2.4} />} label="Money in" value={m(t.income, true)} sub={`${m(t.paidAtVisit, true)} at visits · ${m(t.recovered, true)} recovered`} onClick={() => setLog({ type: 'income' })} />
        <Money tint="bg-tint-orange border-[#ffe2c6]" ink="text-warn-ink" icon={<ArrowUpRight size={22} className="text-orange" strokeWidth={2.4} />} label="Costs" value={m(t.costs, true)} sub={`${m(t.expenses, true)} expenses · ${m(t.commission, true)} PR commission`} onClick={() => setLog({ type: 'expenses' })} />
        <Money
          tint={t.net < 0 ? 'bg-[#fdecec] border-[#f9d4d4]' : 'bg-tint-blue border-[#d6e7ff]'}
          ink={t.net < 0 ? 'text-[#b42318]' : 'text-brand-800'}
          icon={t.net < 0 ? <TrendingDown size={22} className="text-[#d93036]" strokeWidth={2.4} /> : <TrendingUp size={22} className="text-brand-500" strokeWidth={2.4} />}
          label={t.net < 0 ? 'Net loss' : 'Net profit'}
          value={m(Math.abs(t.net), true)}
          sub={t.margin === null ? 'No income in this period' : t.net < 0 ? 'Costs were more than the money received' : `${t.margin.toFixed(1)}% margin on money received`}
          onClick={() => setLog({ type: 'all' })}
        />
        <Money tint="bg-[#fdecec] border-[#f9d4d4]" ink="text-[#b42318]" icon={<CircleAlert size={22} className="text-[#d93036]" strokeWidth={2.4} />} label="Outstanding at the end" value={m(t.outstanding, true)} sub={`${formatCount(balances.length)} open bills · ${m(t.billed, true)} billed`} onClick={() => setOwed(null)} />
      </div>

      <Panel title="Income vs expenses" note={`${tr.note} · expenses include PR commission`}>
        <LineChart
          labels={tr.labels}
          format={(n) => m(n, true)}
          series={[
            { name: 'Income', color: '#1f6fe8', values: tr.income },
            { name: 'Expenses', color: '#f27a1a', values: tr.costs },
            { name: 'Billed', color: '#8fb8ff', values: tr.billed, dashed: true },
          ]}
        />
      </Panel>

      <Panel title="Money in and costs" note="How the money received was used: expenses, PR commission and what was left as profit">
        <Donut
          label="Money in"
          total={m(t.income, true)}
          format={(n) => m(n, true)}
          parts={[
            { label: 'Expenses', value: t.expenses, color: '#f27a1a', sub: `${formatCount(entries.filter((e) => e.kind === 'expense').length)} entries`, onOpen: () => setLog({ type: 'expenses' }) },
            { label: 'PR commission', value: t.commission, color: '#8b5cf6', sub: 'accrued', onOpen: () => setLog({ type: 'commission' }) },
            ...(t.net > 0 ? [{ label: 'Kept as profit', value: t.net, color: '#16a34a', sub: t.margin !== null ? `${t.margin.toFixed(1)}% margin` : undefined }] : []),
          ]}
        />
        {t.net < 0 && <p className="mt-2 rounded-2xl bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#b42318]">Costs were {m(-t.net, true)} more than the money received in this period.</p>}
      </Panel>

      <Panel title="Net profit trend" note={`${tr.note} · money in minus costs. Bars below the line are losses, often a salary day. Tap a bar.`}>
        <ProfitBars labels={tr.labels} values={tr.net} sel={bar} onSel={setBar} />
        {bar != null && tr.labels[bar] != null && (
          <div className="drop-down mt-3">
            <Facts
              rows={[
                { label: tr.note.startsWith('Weekly') ? `Week of ${tr.labels[bar]}` : tr.labels[bar]!, value: (tr.net[bar] ?? 0) < 0 ? 'Net loss' : 'Net profit', tone: (tr.net[bar] ?? 0) < 0 ? 'due' : 'in' },
                { label: 'Income', value: m(tr.income[bar] ?? 0) },
                { label: 'Expenses', value: m(tr.costs[bar] ?? 0), tone: 'out' },
                { label: (tr.net[bar] ?? 0) < 0 ? 'Loss' : 'Profit', value: m(Math.abs(tr.net[bar] ?? 0)), tone: (tr.net[bar] ?? 0) < 0 ? 'due' : 'in' },
                { label: 'Margin', value: !tr.income[bar] ? 'No income' : (tr.net[bar] ?? 0) < 0 ? 'None, a loss' : `${(((tr.net[bar] ?? 0) / tr.income[bar]!) * 100).toFixed(1)}%` },
              ]}
            />
          </div>
        )}
      </Panel>

      <Panel title="Where the money came from" note="Paid at the visit, or older balances paid back (oldest bills first)">
        <Parts
          total={t.income}
          m={m}
          parts={[
            { label: 'Paid at the visit', value: t.paidAtVisit, color: '#1f6fe8', sub: `${formatCount(stats.visitPays)} payments · average ${stats.visitPays ? m(t.paidAtVisit / stats.visitPays) : '₦0'}`, onClick: () => setLog({ type: 'income' }) },
            { label: 'Recovered balances', value: t.recovered, color: '#5b9bff', sub: `${formatCount(stats.recoveries)} repayments`, onClick: () => setLog({ type: 'recovered' }) },
          ]}
        />
      </Panel>

      <Panel title="Payment methods" note="Money received by method. Tap one for the patients who paid that way.">
        <Parts
          total={t.income}
          m={m}
          parts={stats.methods.map((x, i) => ({ label: x.label, value: x.value, color: ['#1f6fe8', '#16a34a', '#f59e0b'][i] ?? '#64748b', sub: `${formatCount(x.count)} payments · average ${x.count ? m(x.value / x.count) : '₦0'}`, onClick: () => setDetail({ kind: 'payments', method: x.label }) }))}
        />
      </Panel>

      <Panel title="Where the money went" note="Approved expenses by category, and PR commission. Tap a part, then Open for its entries.">
        {spent.length ? (
          <Donut
            legend="below"
            size={190}
            thickness={24}
            label="Costs"
            total={m(t.costs, true)}
            format={(n) => m(n, true)}
            parts={spent.map((x, i) => ({
              label: x.label,
              value: x.value,
              color: ['#f27a1a', '#8b5cf6', '#ef4444', '#f59e0b', '#0ea5e9', '#ec4899', '#64748b', '#16a34a'][i % 8]!,
              sub: x.label === 'PR commission' ? `${formatCount(stats.catCount.get(x.label) ?? 0)} days accrued` : `${formatCount(stats.catCount.get(x.label) ?? 0)} ${(stats.catCount.get(x.label) ?? 0) === 1 ? 'entry' : 'entries'}`,
              onOpen: () => setLog(x.label === 'PR commission' ? { type: 'commission' } : { type: 'expenses', category: x.label }),
            }))}
          />
        ) : (
          <p className="py-4 text-center text-[13.5px] text-muted">No costs in this period.</p>
        )}
      </Panel>

      <Panel title="Revenue by diagnostic service" note="Billed value · top 6. Tap one for the patients who did it.">
        {services.length ? (
          <BarList
            rows={services.map((x) => ({ key: String(x.id), label: x.name, value: x.value, text: m(x.value, true), sub: `${formatCount(x.count)} times · ${x.count ? m(x.value / x.count) : ''} each · ${t.billed ? ((x.value / t.billed) * 100).toFixed(1) : 0}% of billing` }))}
            onRow={(k) => {
              const s = services.find((x) => String(x.id) === k);
              if (s) setFocus({ kind: 'service', id: s.id, name: s.name });
            }}
          />
        ) : (
          <p className="py-4 text-center text-[13.5px] text-muted">No services billed in this period.</p>
        )}
      </Panel>

      <Panel title="Outstanding balances" note={`Owed by patients on ${range.to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, by age`} action="See all" onAction={() => setOwed(null)}>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { l: 'Outstanding', v: m(t.outstanding, true), d: true },
            { l: 'Recovered', v: m(t.recovered, true) },
            { l: 'Open bills', v: formatCount(balances.length) },
          ].map((x) => (
            <span key={x.l} className="min-w-0 rounded-2xl bg-page px-3 py-2">
              <span className="block truncate text-[11.5px] text-muted">{x.l}</span>
              <b className={`block truncate text-[15px] ${x.d ? 'text-[#b42318]' : 'text-ink'}`}>{x.v}</b>
            </span>
          ))}
        </div>
        <Donut
          label="Still owed"
          total={m(totalOwed, true)}
          format={(n) => m(n, true)}
          parts={ages.map((a) => ({ label: a.label, value: a.value, color: a.color, sub: `${formatCount(a.count)} bills`, onOpen: a.count ? () => setOwed(a.i) : undefined }))}
        />
      </Panel>

      <SectionTitle title="Finance log" action="See all" onAction={() => setLog({ type: 'all' })} />
      <div className="mb-2 grid grid-cols-3 gap-2">
        <Total label="In" value={m(totalIn, true)} tone="text-good-ink" />
        <Total label="Out" value={m(totalOut, true)} tone="text-warn-ink" />
        <Total label={totalIn - totalOut < 0 ? 'Net loss' : 'Net'} value={m(Math.abs(totalIn - totalOut), true)} tone={totalIn - totalOut < 0 ? 'text-[#b42318]' : 'text-brand-700'} />
      </div>
      <ul className="space-y-2">
        {latest.slice(0, 5).map((e) => (
          <li key={e.id}>{logRow(e, ctx, setDetail, range.days <= 1).render(range.days <= 1, false)}</li>
        ))}
      </ul>
      {latest.length > 5 && (
        <button type="button" onClick={() => setLog({ type: 'all' })} className="press mx-auto mt-3 block rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-brand-600 ring-1 ring-line">
          See all {formatCount(latest.length)} entries
        </button>
      )}
      {!latest.length && <p className="rounded-[18px] bg-white p-4 text-center text-[13.5px] text-muted ring-1 ring-line/70">No money in or out in this period.</p>}

      <p className="mt-6 text-[12px] leading-relaxed text-muted">Read only for the Company Admin, as on the desktop. PR commission: {rateSummary()} (change it on PR Management). Figures are the demonstration activity built from the real catalogue, prices and PR agents; they reconcile line by line.</p>

      {detail && <DetailSheet kind={detail.kind} method={detail.method} branchIds={ids} period={period} scopeText={`${b.name} branch`} onClose={() => setDetail(null)} />}
      {log && <LogSheet branchId={branchId} start={period} type={log.type} category={log.category} onClose={() => setLog(null)} />}
      {owed !== undefined && <OwedSheet branchId={branchId} start={period} bucket={owed} onClose={() => setOwed(undefined)} />}
      {focus && <FocusSheet focus={focus} branchIds={ids} period={period} onClose={() => setFocus(null)} />}
    </>
  );
}

/* ─────────────── financial position ─────────────── */

function Position({ branchId, version, m }: { branchId: string; version: number; m: (n: number, compact?: boolean) => string }) {
  const [key, setKey] = useState<'today' | 'month' | 'year'>('today');
  const range = useMemo(() => resolveRange({ key }), [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(() => financeTotals(branchId, range), [branchId, range, version]);
  const open = useMemo(() => openBalances(branchId, range.to).length, [branchId, range]);
  const share = t.income > 0 ? Math.min(100, (t.costs / t.income) * 100) : t.costs > 0 ? 100 : 0;
  const loss = t.net < 0;
  return (
    <>
      <div role="tablist" aria-label="Financial position" className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-white p-1 ring-1 ring-line">
        {(['today', 'month', 'year'] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={key === k} onClick={() => setKey(k)} className={`press min-h-9 rounded-full text-[13.5px] font-semibold ${key === k ? 'bg-brand-600 text-white shadow-[0_6px_16px_rgba(31,111,232,0.28)]' : 'text-ink-2'}`}>
            {k === 'today' ? 'Today' : k === 'month' ? 'This month' : 'This year'}
          </button>
        ))}
      </div>
      <div className={`relative overflow-hidden rounded-[24px] bg-linear-to-br p-5 text-white shadow-[0_14px_34px_rgba(31,99,214,0.25)] ${loss ? 'from-[#b42318] via-[#d93036] to-[#f0646a]' : 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]'}`}>
        <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative max-w-[66%]">
          <p className="text-[13px] font-medium text-white/90">
            {loss ? 'Net loss' : 'Net profit'} · {periodText({ key })}
          </p>
          <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.02em]">{m(Math.abs(t.net))}</p>
          <p className="mt-1.5 text-[12.5px] text-white/90">{t.margin === null ? 'No income yet' : loss ? 'Costs were more than the money received' : `${t.margin.toFixed(1)}% margin`} · money in minus expenses and PR commission</p>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/25">
            <span className="block h-full rounded-full bg-white" style={{ width: `${share}%` }} />
          </span>
          <p className="mt-1.5 text-[12.5px] text-white/90">
            Costs use <b>{Math.round(share)}%</b> of money in
          </p>
        </div>
        <Sticker name={loss ? 'chart' : 'moneyBag'} size={104} className="absolute right-1 top-3" />
      </div>
      <div className="mt-2.5 overflow-hidden rounded-[22px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
        <Facts
          plain
          rows={[
            { label: 'Money in', value: m(t.income), sub: `${m(t.paidAtVisit, true)} at visits · ${m(t.recovered, true)} recovered`, tone: 'in' },
            { label: 'Expenses', value: `minus ${m(t.expenses)}`, tone: 'out' },
            { label: 'PR commission', value: `minus ${m(t.commission)}`, sub: `Accrued · ${rateSummary()}`, tone: 'out' },
            { label: 'Billed (revenue)', value: m(t.billed), sub: `${formatCount(t.patients)} patients` },
            { label: 'Balances recovered', value: m(t.recovered) },
            { label: 'Outstanding at the end', value: m(t.outstanding), sub: `${formatCount(open)} open bills`, tone: 'due' },
          ]}
        />
      </div>
    </>
  );
}

/* ─────────────── small pieces ─────────────── */

function Money({ tint, ink, icon, label, value, sub, onClick }: { tint: string; ink: string; icon: ReactNode; label: string; value: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[128px] min-w-0 flex-col items-start rounded-[18px] border p-3 text-left ${tint}`}>
      {icon}
      <span className="mt-1.5 text-[13px] leading-tight text-ink-2">{label}</span>
      <span className={`mt-1 w-full truncate text-[21px] font-bold leading-none tracking-[-0.03em] ${ink}`}>{value}</span>
      <span className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-muted">{sub}</span>
    </button>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="block min-w-0 rounded-2xl bg-white px-3 py-2 ring-1 ring-line/70">
      <span className="block text-[11.5px] text-muted">{label}</span>
      <b className={`block truncate text-[15px] ${tone}`}>{value}</b>
    </span>
  );
}

function Parts({ parts, total, m, label = 'Money in' }: { parts: { label: string; value: number; color: string; sub: string; onClick: () => void }[]; total: number; m: (n: number, compact?: boolean) => string; label?: string }) {
  return <Donut label={label} total={m(total, true)} format={(n) => m(n, true)} parts={parts.map((p) => ({ label: p.label, value: p.value, color: p.color, sub: p.sub, onOpen: p.onClick }))} />;
}

/** Net profit by period: bars above the zero line are profit, below it a loss. Tap a bar for its figures. */
function ProfitBars({ labels, values, sel, onSel }: { labels: string[]; values: number[]; sel: number | null; onSel: (i: number | null) => void }) {
  const max = Math.max(1, ...values.map((v) => Math.max(0, v)));
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const zero = (max / span) * 100;
  const n = labels.length;
  const show = (i: number) => n <= 7 || i % Math.ceil(n / 6) === 0 || i === n - 1;
  const { ref, seen } = useSeen<HTMLDivElement>();
  return (
    <div>
      <div ref={ref} className="relative flex h-36 gap-[3px]">
        <span className="absolute inset-x-0 h-px bg-[#cfd8e6]" style={{ top: `${zero}%` }} />
        {values.map((v, i) => (
          <button key={i} type="button" aria-label={`${labels[i]}: ${v < 0 ? 'loss' : 'profit'}`} onClick={() => onSel(sel === i ? null : i)} className="relative h-full min-w-0 flex-1">
            <span
              className={`absolute inset-x-0 mx-auto max-w-[10px] rounded-[3px] ${v < 0 ? 'bg-[#ef4444]' : 'bg-brand-500'} ${sel != null && sel !== i ? 'opacity-35' : ''}`}
              style={{ ...(v >= 0 ? { bottom: `${100 - zero}%`, height: seen ? `${Math.max(1, (v / span) * 100)}%` : '0%' } : { top: `${zero}%`, height: seen ? `${Math.max(1, (-v / span) * 100)}%` : '0%' }), transition: `height 750ms cubic-bezier(0.22,0.8,0.24,1) ${Math.min(900, i * 24)}ms, opacity 200ms` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {labels.map((l, i) => (
          <span key={l + i} className="flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap text-[9.5px] text-muted">
            {show(i) ? l : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One finance log entry: a bill opens the visit record, an expense drops down, commission opens the agents of that day. */
function logRow(e: LedgerEntry, ctx: ReturnType<typeof useRowCtx>, openDetail: (d: { kind: DetailKind }) => void, _oneDay: boolean): Row {
  if (e.visit) return { ...visitRow(e.visit, ctx, { amount: e.amount, at: e.at, tag: KIND_LABEL[e.kind], method: e.method }), key: e.id };
  if (e.expense) {
    const ex = e.expense;
    const p = ctx.team.expensePeople(ex);
    return { key: e.id, text: norm([ex.description, ex.category, ex.id, p.recordedBy?.name ?? '', p.approvedBy.name].join(' ')), render: (oneDay, multi) => <ExpenseRow e={ex} oneDay={oneDay} multi={multi} people={p} /> };
  }
  return { key: e.id, text: norm(`${e.source} ${e.category} ${e.detail} ${e.id}`), render: (oneDay) => <CommissionRow e={e} oneDay={oneDay} onAgents={() => openDetail({ kind: 'commission' })} /> };
}

function CommissionRow({ e, oneDay, onAgents }: { e: LedgerEntry; oneDay: boolean; onAgents: () => void }) {
  const [open, setOpen] = useState(false);
  const c = getBranch(e.branchId)?.currency ?? 'NGN';
  const day = e.at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className={`rounded-[18px] bg-white ring-1 ${open ? 'ring-[#dfe3ff]' : 'ring-line/70'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-start gap-3 p-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef1ff]">
          <Sticker name="coin" size={30} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{e.source}</span>
            <span className="shrink-0 text-[14.5px] font-bold text-warn-ink">{formatMoney(e.amount, c)}</span>
          </span>
          <span className="block truncate text-[12.5px] text-muted">
            PR commission · {oneDay ? e.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : e.at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </span>
        <ChevronDown size={17} className={`mt-3 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="drop-down mx-3 mb-3">
          <Facts
            rows={[
              { label: 'What it is for', value: e.source },
              { label: 'Amount', value: formatMoney(e.amount, c), tone: 'out' },
              { label: 'Details', value: e.detail },
              { label: 'Day', value: day },
              { label: 'Recorded', value: e.recordedBy },
              { label: 'Reference', value: e.id },
            ]}
          />
          <button type="button" onClick={onAgents} className="press mt-2 min-h-10 w-full rounded-xl bg-[#eef1ff] text-[13.5px] font-semibold text-[#3730a3]">
            See the PR agents
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── finance log ─────────────── */

function LogSheet({ branchId, start, type: t0, category, onClose }: { branchId: string; start: PeriodSelection; type: LogType; category?: string; onClose: () => void }) {
  const b = getBranch(branchId)!;
  const ids = useMemo(() => [branchId], [branchId]);
  const { period, range, filter } = useSheetPeriod(start);
  const { version } = useCommission();
  const [q, setQ] = useState('');
  const [type, setType] = useState<LogType>(t0);
  const [cat, setCat] = useState<string | undefined>(category);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'largest'>('newest');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [agents, setAgents] = useState<PeriodSelection | null>(null);
  const ctx = useRowCtx(setFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => ledger(ids, range), [ids, range, version]);
  const counts: Record<LogType, number> = {
    all: entries.length,
    income: entries.filter((e) => e.direction === 'in').length,
    recovered: entries.filter((e) => e.kind === 'recovery').length,
    expenses: entries.filter((e) => e.kind === 'expense').length,
    commission: entries.filter((e) => e.kind === 'commission').length,
  };
  const list = entries
    .filter((e) => {
      if (type === 'income' && e.direction !== 'in') return false;
      if (type === 'recovered' && e.kind !== 'recovery') return false;
      if (type === 'expenses' && e.kind !== 'expense') return false;
      if (type === 'commission' && e.kind !== 'commission') return false;
      if (cat && type === 'expenses' && e.category !== cat) return false;
      return true;
    })
    .sort((a, z) => (sort === 'largest' ? z.amount - a.amount : sort === 'oldest' ? a.at.getTime() - z.at.getTime() : z.at.getTime() - a.at.getTime()));
  const rows = list.map((e) => {
    const r = logRow(e, ctx, () => setAgents({ key: 'custom', from: iso(e.at), to: iso(e.at) }), range.days <= 1);
    return { ...r, text: r.text + ' ' + norm(`${e.id} ${e.method ?? ''} ${e.recordedBy} ${e.detail}`) };
  });
  const n = norm(q);
  const shown = rows.filter((r) => !n || r.text.includes(n));
  const shownEntries = list.filter((_, i) => !n || rows[i]!.text.includes(n));
  const tin = shownEntries.reduce((s, e) => s + (e.direction === 'in' ? e.amount : 0), 0);
  const tout = shownEntries.reduce((s, e) => s + (e.direction === 'out' ? e.amount : 0), 0);
  const m = (v: number) => formatMoney(v, b.currency, true);
  return (
    <Sheet title={cat ? `Expenses · ${cat}` : 'Finance log'} subtitle={`${b.name} branch`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Reference, patient, test, item or method' }} filter={filter}>
      {type !== 'all' ? (
        <div className="mb-3">
          <Total label={`${({ income: 'Money in', recovered: 'Recovered', expenses: cat ?? 'Expenses', commission: 'PR commission', all: '' } as Record<LogType, string>)[type]} · ${periodText(period)}`} value={formatMoney(tin + tout, b.currency)} tone={tin ? 'text-good-ink' : 'text-warn-ink'} />
        </div>
      ) : (
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Total label="In" value={m(tin)} tone="text-good-ink" />
        <Total label="Out" value={m(tout)} tone="text-warn-ink" />
        <Total label={tin - tout < 0 ? 'Net loss' : 'Net'} value={m(Math.abs(tin - tout))} tone={tin - tout < 0 ? 'text-[#b42318]' : 'text-brand-700'} />
      </div>
      )}
      <Chips
        label="Finance log type"
        value={type}
        onChange={(v) => (setType(v), setCat(undefined))}
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'income', label: 'Income', count: counts.income },
          { value: 'recovered', label: 'Recovered', count: counts.recovered },
          { value: 'expenses', label: 'Expenses', count: counts.expenses },
          { value: 'commission', label: 'PR commission', count: counts.commission },
        ]}
      />
      <div className="-mt-1 mb-3 flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">
          {formatCount(shown.length)} entries · {periodText(period)}
        </span>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="min-h-9 rounded-full bg-white px-3 text-[13px] font-semibold text-ink ring-1 ring-line">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="largest">Largest amount</option>
        </select>
      </div>
      <Rows rows={shown} oneDay={range.days <= 1} multi={false} empty={n || type !== 'all' ? 'No entries match these filters.' : 'No money in or out in this period.'} />
      {focus && <FocusSheet focus={focus} branchIds={ids} period={period} onClose={() => setFocus(null)} />}
      {agents && <DetailSheet kind="commission" branchIds={ids} period={agents} scopeText={`${b.name} branch`} onClose={() => setAgents(null)} />}
    </Sheet>
  );
}

/* ─────────────── outstanding balances ─────────────── */

function OwedSheet({ branchId, start, bucket, onClose }: { branchId: string; start: PeriodSelection; bucket: number | null; onClose: () => void }) {
  const b = getBranch(branchId)!;
  const { period, range, filter } = useSheetPeriod(start);
  const [q, setQ] = useState('');
  const [age, setAge] = useState<string>(bucket == null ? 'all' : String(bucket));
  const [sort, setSort] = useState<'largest' | 'oldest'>('largest');
  const [focus, setFocus] = useState<Focus | null>(null);
  const ctx = useRowCtx(setFocus);
  const all = useMemo(() => openBalances(branchId, range.to), [branchId, range]);
  const m = (v: number) => formatMoney(v, b.currency);
  const list = all.filter((x) => age === 'all' || AGES[Number(age)]!.test(x.ageDays)).sort((a, z) => (sort === 'largest' ? z.remaining - a.remaining : z.ageDays - a.ageDays));
  const rows: Row[] = list.map((o: OpenBalance) => visitRow(o.visit, ctx, { amount: o.remaining, longDate: true, danger: true, tag: `${o.ageDays} day${o.ageDays === 1 ? '' : 's'} old · ${o.repaid > 0 ? `${m(o.repaid)} repaid of ${m(o.owed)}` : `${m(o.owed)} owed after the visit`}` }));
  const n = norm(q);
  const shown = rows.filter((r) => !n || r.text.includes(n));
  const still = list.reduce((s, x) => s + x.remaining, 0);
  const repaid = list.reduce((s, x) => s + x.repaid, 0);
  return (
    <Sheet title="Outstanding patient balances" subtitle={`${b.name} branch · on ${range.to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Search patient, ID or test' }} filter={filter}>
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#fdecec] to-[#f9d6d6] p-4">
        <p className="text-[12.5px] font-medium text-ink-2">Still owed</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{m(still)}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">
          {formatCount(list.length)} open bills · {m(repaid)} already recovered on these bills
        </p>
        <p className="mt-2 max-w-[70%] text-[12px] leading-snug text-ink-2/80">The oldest balances are recovered first. Tap a patient for the visit record.</p>
        <Sticker name="calendar" size={86} className="absolute -bottom-2 -right-1 rotate-[-6deg]" />
      </div>
      <Chips label="Age of balance" value={age} onChange={setAge} options={[{ value: 'all', label: 'All', count: all.length }, ...AGES.map((a, i) => ({ value: String(i), label: a.label, count: all.filter((x) => a.test(x.ageDays)).length }))]} />
      <div className="-mt-1 mb-3 flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">{periodText(period)}</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="min-h-9 rounded-full bg-white px-3 text-[13px] font-semibold text-ink ring-1 ring-line">
          <option value="largest">Largest balance</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <Rows rows={shown} oneDay={false} multi={false} empty={n ? `Nothing matches “${q}”.` : 'No outstanding balances.'} />
      {focus && <FocusSheet focus={focus} branchIds={[branchId]} period={period} onClose={() => setFocus(null)} />}
    </Sheet>
  );
}

/* ─────────────── approvals ─────────────── */

/** Expenses waiting for a decision (desktop: Settings, Approvals and Workflows). Rejections need a reason. */
export function Approvals({ branchId, title = 'Waiting for your approval' }: { branchId?: string; title?: string }) {
  const expenses = useExpenses();
  const pending = expenses.filter((e) => e.status === 'Pending' && (!branchId || e.branchId === branchId)).sort((a, z) => a.recordedAt.localeCompare(z.recordedAt));
  const [reject, setReject] = useState<ExpenseRecord | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { user, showToast } = useCompany();
  if (!pending.length) return null;
  return (
    <section className="mt-4 rounded-[22px] bg-linear-to-br from-[#fff7ec] to-[#ffeacc] p-4 ring-1 ring-[#ffe0b8]">
      <div className="mb-2 flex items-center gap-2">
        <Sticker name="bell" size={30} />
        <h2 className="flex-1 text-[16px] font-bold text-ink">
          {title} · {formatCount(pending.length)}
        </h2>
      </div>
      <ul className="space-y-2">
        {pending.map((e) => {
          const on = open === e.id;
          return (
            <li key={e.id} className="rounded-[18px] bg-white ring-1 ring-[#ffe0b8]">
              <button type="button" onClick={() => setOpen(on ? null : e.id)} aria-expanded={on} className="press flex w-full items-start gap-3 p-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{e.description}</span>
                    <b className="shrink-0 text-[14.5px] text-ink">{formatMoney(e.amount, getBranch(e.branchId)?.currency ?? 'NGN')}</b>
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {e.category} · {e.method} · {getBranch(e.branchId)?.name}
                  </span>
                  <span className="block text-[12px] text-muted">
                    Requested by <b className="font-semibold text-ink-2">{`${e.recordedBy.name}, ${e.recordedBy.role}`}</b>
                  </span>
                </span>
                <ChevronDown size={17} className={`mt-1 shrink-0 text-faint transition-transform ${on ? 'rotate-180' : ''}`} />
              </button>
              {on && (
                <div className="drop-down mx-3 mb-3">
                  <Facts
                    rows={[
                      { label: 'Spent on', value: new Date(`${e.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                      { label: 'Submitted', value: new Date(e.recordedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
                      ...(e.paidTo ? [{ label: 'Paid to', value: e.paidTo }] : []),
                      ...(e.reference ? [{ label: 'Receipt no.', value: e.reference }] : []),
                      ...(e.notes ? [{ label: 'Notes', value: e.notes }] : []),
                      { label: 'Reference', value: e.id },
                    ]}
                  />
                  {e.receipt && <img src={e.receipt} alt="Receipt" className="mt-2 max-h-56 w-full rounded-2xl object-contain ring-1 ring-line" />}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <button type="button" onClick={() => setReject(e)} className="press flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-semibold text-[#b42318] ring-1 ring-[#f9d4d4]">
                  <X size={16} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    approveExpense(e.id, { name: user.name, role: user.role });
                    showToast(`${e.description} approved`);
                  }}
                  className="press flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-good text-[13.5px] font-semibold text-white"
                >
                  <Check size={16} /> Approve
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {reject && <RejectSheet e={reject} onClose={() => setReject(null)} />}
    </section>
  );
}

function RejectSheet({ e, onClose }: { e: ExpenseRecord; onClose: () => void }) {
  const { user, showToast } = useCompany();
  const [why, setWhy] = useState('');
  const ok = why.trim().length >= 3;
  return (
    <Sheet
      title="Reject this expense?"
      subtitle={`${e.description} · ${formatMoney(e.amount, 'NGN')}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!ok}
          onClick={() => {
            rejectExpense(e.id, { name: user.name, role: user.role }, why);
            showToast(`${e.description} rejected`);
            onClose();
          }}
          className="press min-h-12 w-full rounded-2xl bg-[#d93036] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Reject expense
        </button>
      }
    >
      <LongText label="Reason" required value={why} onChange={setWhy} max={300} minRows={4} placeholder={"For example: no receipt attached.\nPlease add a photo of the receipt and send it again."} hint={`${e.recordedBy.name} will see this reason and can correct and resubmit it.`} />
    </Sheet>
  );
}
