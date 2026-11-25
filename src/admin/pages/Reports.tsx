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
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Download, Eye, FileSpreadsheet, Printer, ZoomIn, ZoomOut } from 'lucide-react';
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
import { AdminTopBar, PageGlow, SectionTitle } from '../kit';
import { Donut, LineChart } from '../charts';
import { useAgentBanks } from '../agentBanks';
import { Chips, PageTitle } from '../branchFirst';

const BRAND = '#1f6fe8';
const BRAND_INK = '#1449a6';
const naira = (n: number, compact = false) => formatMoney(n, 'NGN', compact);
const SHORT: Partial<Record<PeriodSelection['key'], string>> = { today: 'Today', yesterday: 'Yesterday', week: 'This week', month: 'This month', year: 'This year' };
const rangeText = (r: DateRange) => (r.days <= 1 ? `${formatShortDate(r.from)} ${r.from.getFullYear()}` : `${formatShortDate(r.from)} to ${formatShortDate(r.to)} ${r.to.getFullYear()}`);

export function ReportsPage() {
  const { context } = useCompany();
  const ids = useMemo(() => (context === 'all' ? ACTIVE_BRANCHES.map((b) => b.id) : [context]), [context]);
  const scopeLabel = context === 'all' ? 'All branches' : `${getBranch(context)?.name ?? ''} branch`;
  const [open, setOpen] = useState<ReportSpec | null>(null);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Reports" sub={`Reports and exports · ${scopeLabel}`} />
        <ScopeBar branchOnly />
        <Analysis ids={ids} />

        <SectionTitle title="Choose a report" />
        <p className="-mt-1 mb-3 text-[13px] text-muted">Create report lets you choose the period, branch and content, then preview it before printing, downloading or exporting.</p>
        <div className="space-y-3">
          {REPORTS.map((r) => (
            <ReportCard key={r.id} spec={r} onCreate={() => setOpen(r)} />
          ))}
        </div>
      </div>
      {open && <BuilderSheet spec={open} initialBranch={context === 'all' ? 'all' : context} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ─────────────── analysis ─────────────── */

function Analysis({ ids }: { ids: string[] }) {
  const { version } = useCommission();
  const [key, setKey] = useState<PeriodSelection['key']>('month');
  const [focus, setFocus] = useState<Focus | null>(null);
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
      (['today', 'week', 'month', 'year'] as const).map((k) => {
        const r = resolveRange({ key: k });
        return { key: k, value: summarize(ids, r).payments.NGN ?? 0, sub: rangeText(r) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join('|'), version],
  );
  const { s, p, fin } = data;
  const change = (cur: number, prev: number | null | undefined) => (prev == null ? null : compareCount(cur, prev));
  const tiles: { label: string; value: string; sub: string; delta: number | null; tone?: string; invert?: boolean }[] = [
    { label: 'Money in', value: naira(s.payments.NGN ?? 0, true), sub: 'Paid at visits and balances recovered', delta: p ? (compareMoney(s.payments, p.payments).NGN ?? null) : null },
    { label: 'Billed', value: naira(s.revenue.NGN ?? 0, true), sub: `${formatCount(s.transactions)} bills`, delta: p ? (compareMoney(s.revenue, p.revenue).NGN ?? null) : null },
    { label: 'Patients', value: formatCount(s.patients), sub: `${formatCount(s.newPatients)} new · ${formatCount(s.patients - s.newPatients)} returning`, delta: change(s.patients, p?.patients) },
    { label: 'Tests done', value: formatCount(data.tests), sub: s.patients ? `${(data.tests / s.patients).toFixed(1)} per patient` : 'None', delta: null },
    { label: 'Referred patients', value: formatCount(s.referrals), sub: s.patients ? `${Math.round((s.referrals / s.patients) * 100)}% of patients` : 'None', delta: change(s.referrals, p?.referrals) },
    { label: 'Still owed', value: naira(s.outstanding.NGN ?? 0, true), sub: `${formatCount(s.openBills)} open bills at the end`, delta: null, tone: (s.outstanding.NGN ?? 0) > 0 ? 'text-[#b42318]' : undefined },
    { label: 'Costs', value: naira(fin.costs, true), sub: 'Approved expenses and PR commission', delta: null, tone: 'text-warn-ink' },
    { label: fin.net < 0 ? 'Net loss' : 'Net profit', value: naira(Math.abs(fin.net), true), sub: fin.income ? `${fin.net < 0 ? 'Costs above money in' : `${Math.round((fin.net / fin.income) * 100)}% of money in`} · admin only` : 'Admin only', delta: null, tone: fin.net < 0 ? 'text-[#b42318]' : 'text-good-ink' },
  ];
  const methodTotal = data.methods.reduce((n, m) => n + m.value, 0);
  return (
    <>
      <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
        {glance.map((g) => (
          <button key={g.key} type="button" onClick={() => setKey(g.key)} aria-pressed={key === g.key} className={`press min-w-[150px] shrink-0 rounded-[20px] p-3.5 text-left ${key === g.key ? 'bg-linear-to-br from-[#1b5fd6] to-[#5ea6f7] text-white shadow-[0_10px_24px_rgba(31,99,214,0.28)]' : 'bg-white text-ink ring-1 ring-line/70'}`}>
            <span className={`block text-[12px] font-medium ${key === g.key ? 'text-white/90' : 'text-muted'}`}>Money in · {SHORT[g.key]}</span>
            <b className="mt-0.5 block text-[19px] leading-tight">{naira(g.value, true)}</b>
            <span className={`block text-[11px] ${key === g.key ? 'text-white/80' : 'text-muted'}`}>{g.sub}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Chips label="Analysis period" value={key} onChange={setKey} options={(['today', 'yesterday', 'week', 'month', 'year'] as const).map((k) => ({ value: k, label: SHORT[k]! }))} />
      </div>
      <p className="-mt-1 mb-2 text-[12.5px] text-muted">
        {rangeText(range)}
        {prior ? ' · compared with the period before' : ''}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-[18px] bg-white p-3 ring-1 ring-line/70">
            <p className="truncate text-[12px] font-medium text-muted">{t.label}</p>
            <p className={`mt-0.5 truncate text-[20px] font-bold leading-tight ${t.tone ?? 'text-ink'}`}>{t.value}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-snug text-muted">
              {t.delta !== null && Number.isFinite(t.delta) && (
                <span className={`inline-flex shrink-0 items-center font-semibold ${t.delta >= 0 ? 'text-good' : 'text-[#d93036]'}`}>
                  {t.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(t.delta).toFixed(1)}%
                </span>
              )}
              <span className="line-clamp-2">{t.sub}</span>
            </p>
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <h2 className="text-[16px] font-bold text-ink">Billed and money in</h2>
        <p className="mb-3 text-[12px] text-muted">{data.tr.note}</p>
        <LineChart
          labels={data.tr.labels}
          format={(n) => naira(n, true)}
          series={[
            { name: 'Money in', color: BRAND, values: data.tr.payments },
            { name: 'Billed', color: '#8fb8ff', values: data.tr.revenue, dashed: true },
            { name: 'Expenses', color: '#f27a1a', values: data.tr.expenses },
          ]}
        />
      </section>
      <section className="mt-4 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <h2 className="text-[16px] font-bold text-ink">Money in and costs</h2>
        <p className="mb-3 text-[12px] text-muted">What the money received paid for, and what was left as profit</p>
        <Donut
          label="Money in"
          total={naira(fin.income, true)}
          format={(n) => naira(n, true)}
          parts={[
            { label: 'Costs', value: fin.costs, color: '#f27a1a', sub: 'expenses and PR commission' },
            ...(fin.net > 0 ? [{ label: 'Net profit', value: fin.net, color: '#16a34a', sub: 'admin only' }] : []),
          ]}
        />
        {fin.net < 0 && <p className="mt-2 rounded-2xl bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#b42318]">Costs were {naira(-fin.net, true)} more than the money received.</p>}
      </section>
      {methodTotal > 0 && (
        <section className="mt-4 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
          <h2 className="mb-3 text-[16px] font-bold text-ink">Payment methods</h2>
          <Donut label="Received" total={naira(methodTotal, true)} format={(v) => naira(v, true)} parts={data.methods.map((m, i) => ({ label: m.label, value: m.value, color: ['#1f6fe8', '#16a34a', '#f59e0b'][i] ?? '#64748b' }))} />
        </section>
      )}
      {data.services.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70">
          <h2 className="px-4 pt-4 text-[16px] font-bold text-ink">Most done tests</h2>
          <BarList
            rows={data.services.map((x) => ({ key: String(x.id), label: x.name, sub: x.category, value: x.count, text: `×${formatCount(x.count)}` }))}
            onRow={(k) => {
              const x = data.services.find((y) => String(y.id) === k);
              if (x) setFocus({ kind: 'service', id: x.id, name: x.name });
            }}
          />
        </section>
      )}
      {data.agents.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70">
          <h2 className="px-4 pt-4 text-[16px] font-bold text-ink">Top PR agents</h2>
          <BarList color="bg-violet" rows={data.agents.map((a) => ({ key: String(a.id), label: a.name, sub: a.hospitalKey || 'No hospital assigned', value: a.referrals, text: `${formatCount(a.referrals)} ref.` }))} onRow={(k) => setFocus({ kind: 'agent', id: Number(k) })} />
        </section>
      )}
      {focus && <FocusSheet focus={focus} branchIds={ids} period={{ key }} onClose={() => setFocus(null)} />}
    </>
  );
}

/* ─────────────── report cards ─────────────── */

const STICKER: Record<string, 'chart' | 'stethoscope' | 'hospital' | 'testTube' | 'moneyBag' | 'womanHealthWorker'> = { revenue: 'chart', agents: 'stethoscope', hospitals: 'hospital', services: 'testTube', payments: 'moneyBag', staff: 'womanHealthWorker' };

function ReportCard({ spec, onCreate }: { spec: ReportSpec; onCreate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-[22px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
      <div className="flex items-start gap-3 p-3.5">
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff]">
          <Sticker name={STICKER[spec.id] ?? 'chart'} size={36} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-ink">{spec.title}</span>
          <span className="block text-[12.5px] text-muted">{spec.tagline}</span>
        </span>
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center justify-between border-t border-line px-3.5 py-2.5 text-[13px] font-semibold text-ink-2">
        {spec.variants.length} report type{spec.variants.length === 1 ? '' : 's'}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="drop-down mx-3.5 mb-2 space-y-1.5">
          {spec.variants.map((v) => (
            <li key={v.id} className="rounded-2xl bg-page px-3 py-2">
              <b className="block text-[13.5px] text-ink">{v.label}</b>
              <span className="block text-[12px] leading-snug text-muted">{v.description}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="px-3.5 pb-3.5">
        <button type="button" onClick={onCreate} className="press flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white">
          Create report <ChevronRight size={17} />
        </button>
      </div>
    </article>
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

function BuilderSheet({ spec, initialBranch, onClose }: { spec: ReportSpec; initialBranch: string; onClose: () => void }) {
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
                    {PRESETS.map((p) => (
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
          <div>
            <p className="mb-2 text-[14px] font-semibold text-ink">Branch</p>
            <div className="flex flex-wrap gap-2">
              <Pill on={branch === 'all'} label="All branches" onClick={() => setBranch('all')} />
              {BRANCHES.filter((b) => b.status === 'Active').map((b) => (
                <Pill key={b.id} on={branch === b.id} label={`${b.name} · ${b.code}`} onClick={() => setBranch(b.id)} />
              ))}
            </div>
          </div>
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
