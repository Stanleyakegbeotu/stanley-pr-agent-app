/**
 * Marketer Analysis (owner, 2026-11-26): their own hospitals for a day, a
 * week, a month or any dates they choose. Every card can be tapped to open a
 * slide-up that explains, in plain words, what the chart shows, how to read
 * it, their own numbers, and what to do next. Charts animate into view.
 * Hospital-level money only.
 */
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Info, Lightbulb, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import { STATUS_LABEL, type AgentStatus } from '@company/services/agentMonitor';
import { DATA_START, TODAY } from '@company/data/demo/generator';
import { dailyFor, hospitalFigures, monthKey, monthName, weekStartOf, type HospitalFigures } from '@company/services/marketing';
import { resolveRange } from '@company/services/analytics';
import { formatCount } from '@company/shared/format';
import type { StickerKey } from '@/assets';
import { Sticker } from '@/ui/kit';
import { AdminTopBar, PageGlow, StickyTools } from '@/admin/kit';
import { PageTitle } from '@/admin/branchFirst';
import { CountUp, Donut, LineChart, useSeen } from '@/admin/charts';
import { Sheet } from '@/admin/ui';
import { plural } from './data';
import { BoostPrompt } from './boost';
import { GOOD, GrowBar, GrowBars, NEEDS, STATUS_COLOR, useMk } from './ui';

/* ─────────────── the period filter ─────────────── */

type PKind = 'day' | 'week' | 'month' | 'custom';
interface Period {
  kind: PKind;
  /** yyyy-mm-dd inside the day / week / month shown. */
  anchor: string;
  from: string;
  to: string;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (s: string) => new Date(`${s}T12:00:00`);
const todayIso = iso(TODAY);
const startIso = iso(DATA_START);
const clampTo = (s: string) => (s > todayIso ? todayIso : s < startIso ? startIso : s);
const addDays = (s: string, n: number) => {
  const d = at(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};

function bounds(p: Period): { from: string; to: string } {
  const a = at(p.anchor);
  if (p.kind === 'day') return { from: p.anchor, to: p.anchor };
  if (p.kind === 'week') {
    const ws = iso(weekStartOf(a));
    return { from: clampTo(ws), to: clampTo(addDays(ws, 6)) };
  }
  if (p.kind === 'month') return { from: clampTo(iso(new Date(a.getFullYear(), a.getMonth(), 1))), to: clampTo(iso(new Date(a.getFullYear(), a.getMonth() + 1, 0))) };
  const [f, t] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
  return { from: clampTo(f), to: clampTo(t) };
}
function step(p: Period, dir: 1 | -1): Period {
  const a = at(p.anchor);
  const next = p.kind === 'day' ? addDays(p.anchor, dir) : p.kind === 'week' ? addDays(p.anchor, 7 * dir) : iso(new Date(a.getFullYear(), a.getMonth() + dir, 1));
  return { ...p, anchor: clampTo(next) };
}
const short = (s: string) => at(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
function label(p: Period, b: { from: string; to: string }): string {
  if (p.kind === 'day') return b.from === todayIso ? 'Today' : b.from === addDays(todayIso, -1) ? 'Yesterday' : at(b.from).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  if (p.kind === 'week') return `${b.from === iso(weekStartOf(TODAY)) ? 'This week · ' : ''}${short(b.from)} – ${short(b.to)}`;
  if (p.kind === 'month') return monthName(b.from.slice(0, 7), true);
  return `${short(b.from)} – ${short(b.to)} ${b.to.slice(0, 4)}`;
}
const daysBetween = (f: string, t: string) => Math.round((at(t).getTime() - at(f).getTime()) / 86_400_000) + 1;

function PeriodFilter({ p, onChange }: { p: Period; onChange: (p: Period) => void }) {
  const b = bounds(p);
  const canNext = b.to < todayIso;
  const canPrev = b.from > startIso;
  return (
    <div className="rounded-[22px] bg-white p-2 shadow-[0_8px_24px_rgba(30,74,160,0.08)] ring-1 ring-line/70">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-page p-1" role="tablist" aria-label="Period">
        {(['day', 'week', 'month', 'custom'] as PKind[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={p.kind === k} onClick={() => onChange({ ...p, kind: k, anchor: todayIso, from: k === 'custom' ? addDays(todayIso, -13) : p.from, to: k === 'custom' ? todayIso : p.to })} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold capitalize ${p.kind === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-2'}`}>
            {k === 'custom' ? 'Custom' : k}
          </button>
        ))}
      </div>
      {p.kind === 'custom' ? (
        <div className="mt-2 grid grid-cols-2 gap-2 px-1 pb-1">
          {(['from', 'to'] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">{k === 'from' ? 'From' : 'To'}</span>
              <span className="flex min-h-11 items-center gap-2 rounded-2xl bg-page px-3 ring-1 ring-line">
                <CalendarDays size={15} className="text-brand-600" />
                <input type="date" value={p[k]} min={startIso} max={todayIso} onChange={(e) => e.target.value && onChange({ ...p, [k]: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none" />
              </span>
            </label>
          ))}
          <div className="col-span-2 flex flex-wrap gap-1.5 pt-1">
            {[
              ['Last 7 days', 6],
              ['Last 30 days', 29],
              ['Last 90 days', 89],
            ].map(([l, n]) => (
              <button key={l} type="button" onClick={() => onChange({ ...p, from: addDays(todayIso, -(n as number)), to: todayIso })} className="press rounded-full bg-page px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 ring-1 ring-line">
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2 px-1 pb-0.5">
          <button type="button" disabled={!canPrev} onClick={() => onChange(step(p, -1))} aria-label={`Previous ${p.kind}`} className="press grid h-10 w-10 place-items-center rounded-full bg-page text-ink-2 disabled:opacity-30">
            <ChevronLeft size={19} />
          </button>
          <span className="min-w-0 flex-1 text-center">
            <b className="block truncate text-[15px] text-ink">{label(p, b)}</b>
            <span className="text-[11.5px] text-muted">{p.kind === 'day' ? 'One day' : `${plural(daysBetween(b.from, b.to), 'day')}`}</span>
          </span>
          <button type="button" disabled={!canNext} onClick={() => onChange(step(p, 1))} aria-label={`Next ${p.kind}`} className="press grid h-10 w-10 place-items-center rounded-full bg-page text-ink-2 disabled:opacity-30">
            <ChevronRight size={19} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── explanations ─────────────── */

type ExplainKey = 'amount' | 'patients' | 'avg' | 'followups' | 'target' | 'byHospital' | 'trend' | 'agents' | 'daily' | 'patientsByHospital' | 'six';
interface Explain {
  title: string;
  icon: LucideIcon;
  sticker: StickerKey;
  theme: string;
  what: string;
  read: string[];
  facts: { label: string; value: string; tone?: 'good' | 'bad' }[];
  todo: string[];
}

/** One clickable analysis card with a heading and an "Explain" chip. */
function Box({ title, sub, onExplain, children }: { title: string; sub?: string; onExplain: () => void; children: ReactNode }) {
  // Taps on the chart's own controls (legend, line) stay with the chart.
  const click = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, svg')) return;
    onExplain();
  };
  return (
    <section className="mt-4 cursor-pointer rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(30,74,160,0.06)] ring-1 ring-line/70 transition-transform active:scale-[0.99]" onClick={click}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {sub && <p className="text-[12px] text-muted">{sub}</p>}
        </div>
        <button type="button" onClick={onExplain} className="press flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1.5 text-[12px] font-semibold text-brand-700">
          <Info size={13} /> Explain
        </button>
      </div>
      {children}
    </section>
  );
}

function ExplainSheet({ e, onClose, action }: { e: Explain; onClose: () => void; action?: { label: string; onClick: () => void } }) {
  const Icon = e.icon;
  return (
    <Sheet back tall title={e.title} subtitle="What this card tells you" onClose={onClose} footer={action && <button type="button" onClick={() => (onClose(), action.onClick())} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">{action.label}</button>}>
      <div className={`relative mb-3 overflow-hidden rounded-[26px] bg-linear-to-br p-5 text-white shadow-[0_14px_32px_rgba(31,99,214,0.25)] ${e.theme}`}>
        <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <Sticker name={e.sticker} size={84} className="absolute -bottom-2 -right-2 opacity-95" />
        <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          <Icon size={22} />
        </span>
        <p className="relative mt-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/75">What it shows</p>
        <p className="relative mt-1 w-[78%] text-[15px] font-semibold leading-snug">{e.what}</p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {e.facts.map((f) => (
          <div key={f.label} className="rounded-[18px] bg-white p-3 ring-1 ring-line/70">
            <p className="text-[11.5px] text-muted">{f.label}</p>
            <b className={`block text-[17px] leading-tight ${f.tone === 'good' ? 'text-good-ink' : f.tone === 'bad' ? 'text-[#b42318]' : 'text-ink'}`}>{f.value}</b>
          </div>
        ))}
      </div>
      <div className="mb-3 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">How to read it</p>
        <ul className="space-y-2">
          {e.read.map((r) => (
            <li key={r} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              {r}
            </li>
          ))}
        </ul>
      </div>
      {e.todo.length > 0 && (
        <div className="mb-3 rounded-[22px] bg-linear-to-br from-[#fff8ec] to-[#ffeccc] p-4 ring-1 ring-[#fde2b3]">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#a85a00]">
            <Lightbulb size={14} /> What to do next
          </p>
          <ol className="space-y-2">
            {e.todo.map((t, i) => (
              <li key={t} className="flex gap-2.5 text-[13.5px] leading-snug text-ink">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-[#a85a00]">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Sheet>
  );
}

/* ─────────────── the page ─────────────── */

const PIE = ['#1f6fe8', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#94a3b8'];
const STATUSES: AgentStatus[] = ['top', 'rising', 'steady', 'slipping', 'quiet', 'inactive', 'never'];
const zero: HospitalFigures = { patients: 0, revenue: 0, referring: 0 };

export function MarketerAnalysis() {
  const { m, me, go, openFollow } = useMk();
  const [p, setP] = useState<Period>({ kind: 'month', anchor: todayIso, from: addDays(todayIso, -13), to: todayIso });
  const [open, setOpen] = useState<ExplainKey | null>(null);
  const b = bounds(p);
  const days = daysBetween(b.from, b.to);
  const keys = useMemo(() => m.mine.map((h) => h.key), [m.mine]);
  const range = useMemo(() => resolveRange({ key: 'custom', from: b.from, to: b.to }), [b.from, b.to]);
  const prior = useMemo(() => resolveRange({ key: 'custom', from: addDays(b.from, -days), to: addDays(b.from, -1) }), [b.from, days]);
  const figs = useMemo(() => hospitalFigures(m.branchId, range, m.agents), [m.branchId, range, m.agents]);
  const priorFigs = useMemo(() => hospitalFigures(m.branchId, prior, m.agents), [m.branchId, prior, m.agents]);
  const daily = useMemo(() => dailyFor(m.branchId, keys, range, m.agents), [m.branchId, keys, range, m.agents]);
  const priorDaily = useMemo(() => (days > 1 ? dailyFor(m.branchId, keys, prior, m.agents) : []), [m.branchId, keys, prior, m.agents, days]);
  // Target for any dates: each day gets its month's target divided by the days in that month.
  const monthTarget = useMemo(() => new Map(m.history.map((h) => [h.month, h.target])), [m.history]);
  const dayTarget = (d: string) => {
    const ym = d.slice(0, 7);
    const t = monthTarget.get(ym) ?? m.my?.target ?? 0;
    return t / new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate();
  };
  const target = Math.round(daily.reduce((s, d) => s + dayTarget(d.date), 0));
  const rows = keys.map((k) => ({ k, now: figs.get(k) ?? zero, before: priorFigs.get(k) ?? zero })).sort((a, b2) => b2.now.revenue - a.now.revenue);
  const tot = rows.reduce((s, r) => ({ revenue: s.revenue + r.now.revenue, patients: s.patients + r.now.patients, before: s.before + r.before.revenue, beforeP: s.beforeP + r.before.patients }), { revenue: 0, patients: 0, before: 0, beforeP: 0 });
  const avg = tot.patients ? tot.revenue / tot.patients : 0;
  const inRange = (s: string) => s.slice(0, 10) >= b.from && s.slice(0, 10) <= b.to;
  const follows = m.checkUps.filter((c) => c.by.name === me.name && inRange(c.at)).length;
  const recruits = m.st.entries.filter((e) => e.marketerId === me.id && e.kind === 'recruit' && inRange(e.at)).length;
  const kpi = useSeen<HTMLDivElement>(0.2);
  const money = (n: number) => m.money(n);
  const pct = (a: number, base: number) => (base ? Math.round(((a - base) / base) * 100) : null);
  const change = pct(tot.revenue, tot.before);
  const changeP = pct(tot.patients, tot.beforeP);
  // Bars: by day for up to a month, by week beyond (and by hospital for a single day).
  const bars = useMemo(() => {
    if (days === 1) return rows.slice(0, 6).map((r) => ({ label: r.k.length > 6 ? `${r.k.slice(0, 5)}…` : r.k, value: r.now.revenue }));
    if (days <= 31) return daily.map((d) => ({ label: days <= 7 ? at(d.date).toLocaleDateString('en-GB', { weekday: 'short' }) : String(Number(d.date.slice(8))), value: d.revenue, target: Math.round(dayTarget(d.date)) }));
    const out: { label: string; value: number; target: number }[] = [];
    for (const d of daily) {
      const l = short(iso(weekStartOf(at(d.date))));
      const last = out[out.length - 1];
      if (!last || last.label !== l) out.push({ label: l, value: d.revenue, target: dayTarget(d.date) });
      else (last.value += d.revenue), (last.target += dayTarget(d.date));
    }
    return out.map((x) => ({ ...x, target: Math.round(x.target) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, days, rows]);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.now.revenue, 0);
  const statusCount = (s: AgentStatus) => m.myHealth.filter((a) => a.status === s).length;
  const need = m.myHealth.filter((a) => NEEDS.includes(a.status)).length;
  const good = m.myHealth.filter((a) => GOOD.includes(a.status)).length;
  const best = rows[0];
  const growers = rows.filter((r) => r.now.revenue > r.before.revenue).sort((a, b2) => b2.now.revenue - b2.before.revenue - (a.now.revenue - a.before.revenue));
  const fallers = rows.filter((r) => r.now.revenue < r.before.revenue).sort((a, b2) => a.now.revenue - a.before.revenue - (b2.now.revenue - b2.before.revenue));
  const periodWord = p.kind === 'day' ? 'day' : p.kind === 'week' ? 'week' : p.kind === 'month' ? 'month' : 'period';
  const before = p.kind === 'day' ? 'the day before' : p.kind === 'custom' ? `the ${plural(days, 'day')} before` : `the ${periodWord} before`;

  const explain: Record<ExplainKey, Explain> = {
    amount: {
      title: 'Amount generated',
      icon: Wallet,
      sticker: 'moneyBag',
      theme: 'from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5]',
      what: `The total your hospitals' patients were billed for ${label(p, b).toLowerCase().startsWith('this') ? label(p, b) : `in ${label(p, b)}`}. This is what your target is measured on.`,
      read: ['It adds up every hospital you look after, not one PR agent.', `The change compares it with ${before}, the same number of days.`, 'Patients who came but were not billed yet are not counted until the bill is saved.'],
      facts: [
        { label: 'Generated', value: money(tot.revenue) },
        { label: `Change on ${before}`, value: change === null ? '—' : `${change >= 0 ? '+' : ''}${change}%`, tone: change === null ? undefined : change >= 0 ? 'good' : 'bad' },
        { label: 'Target for these dates', value: money(target) },
        { label: 'Reached', value: target ? `${Math.round((tot.revenue / target) * 100)}%` : '—', tone: tot.revenue >= target ? 'good' : undefined },
      ],
      todo: [...(fallers[0] ? [`${fallers[0].k} brought in ${money(fallers[0].before.revenue - fallers[0].now.revenue)} less than ${before}: visit and ask what changed.`] : []), ...(growers[0] ? [`${growers[0].k} is growing: thank the agents there and ask for introductions.`] : []), 'Follow up the agents who have gone quiet: they are the quickest way to add to this number.'],
    },
    patients: {
      title: 'Patients attended',
      icon: Users,
      sticker: 'healthWorker',
      theme: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]',
      what: `How many patients from your hospitals were attended at the branch in this ${periodWord}.`,
      read: ['A patient counts once per visit, when the bill is saved.', 'More patients usually means more amount; a few big tests can also lift the amount with fewer patients.', `Compared with ${before}.`],
      facts: [
        { label: 'Patients', value: formatCount(tot.patients) },
        { label: `Change on ${before}`, value: changeP === null ? '—' : `${changeP >= 0 ? '+' : ''}${changeP}%`, tone: changeP === null ? undefined : changeP >= 0 ? 'good' : 'bad' },
        { label: 'Busiest hospital', value: best ? best.k : '—' },
        { label: 'PR agents who referred', value: formatCount(rows.reduce((s, r) => s + r.now.referring, 0)) },
      ],
      todo: ['Ask your top agents who else at their hospital sends patients out.', 'Remind agents they can send requests in the app: patients are attended faster.'],
    },
    avg: {
      title: 'Average per patient',
      icon: TrendingUp,
      sticker: 'chart',
      theme: 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]',
      what: 'The amount generated divided by the number of patients: the value of an average referral from your hospitals.',
      read: ['Higher means patients are coming for bigger tests (scans, panels).', 'Lower means mostly small tests; more patients are needed to reach the target.'],
      facts: [
        { label: 'Average', value: money(avg) },
        { label: 'Patients', value: formatCount(tot.patients) },
      ],
      todo: ['Tell agents about the bigger tests the branch does (imaging, full panels).', 'Hospitals without a scan machine are good places to talk about imaging.'],
    },
    followups: {
      title: 'Follow-ups',
      icon: ClipboardCheck,
      sticker: 'stethoscope',
      theme: 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]',
      what: 'The visits, calls and messages you logged with your PR agents in these dates.',
      read: ['Every follow-up you log shows to your manager.', 'Agents who are slipping or have gone quiet should be followed up first.'],
      facts: [
        { label: 'Follow-ups', value: formatCount(follows) },
        { label: 'New PR agents', value: formatCount(recruits) },
        { label: 'Need you now', value: formatCount(need), tone: need ? 'bad' : 'good' },
      ],
      todo: [`${plural(need, 'agent')} need a follow-up now: start with the ones who used to send the most.`, 'Log every visit or call so your manager sees your work.'],
    },
    target: {
      title: 'Target for these dates',
      icon: Wallet,
      sticker: 'target',
      theme: 'from-[#3346c9] via-[#4f63e6] to-[#8796f7]',
      what: 'Your monthly target shared out over the days you picked, against what your hospitals generated.',
      read: ['Each day gets its month’s target divided by the days in that month.', 'For a whole month it is your full monthly target.', 'Green means the target for these dates is reached.'],
      facts: [
        { label: 'Target', value: money(target) },
        { label: 'Generated', value: money(tot.revenue), tone: tot.revenue >= target ? 'good' : undefined },
        { label: tot.revenue >= target ? 'Over by' : 'Short by', value: money(Math.abs(target - tot.revenue)), tone: tot.revenue >= target ? 'good' : 'bad' },
      ],
      todo: tot.revenue >= target ? ['Well done. Keep the same rhythm of visits and follow-ups.'] : ['Open My hospitals: the target guide shows the daily amount you need and who to call.', 'Follow up the agents who sent patients last week but none this week.'],
    },
    byHospital: {
      title: 'Amount by hospital',
      icon: Wallet,
      sticker: 'hospital',
      theme: 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]',
      what: 'Each slice is one of your hospitals: how much of your amount it brought in.',
      read: ['Tap a slice or a name to see its amount and share.', 'One very big slice means you depend on one hospital: grow the others too.'],
      facts: [
        { label: 'Biggest', value: best ? `${best.k} · ${money(best.now.revenue)}` : '—' },
        { label: 'Its share', value: best && tot.revenue ? `${Math.round((best.now.revenue / tot.revenue) * 100)}%` : '—' },
        { label: 'Hospitals that sent patients', value: formatCount(rows.filter((r) => r.now.patients).length) },
        { label: 'Sent nobody', value: formatCount(rows.filter((r) => !r.now.patients).length), tone: rows.some((r) => !r.now.patients) ? 'bad' : undefined },
      ],
      todo: ['Visit a hospital that sent nobody and introduce the branch to a new doctor there.', ...(best ? [`Keep ${best.k} close: it carries the biggest share.`] : [])],
    },
    trend: {
      title: days === 1 ? 'By hospital' : days <= 31 ? 'Day by day against target' : 'Week by week against target',
      icon: TrendingUp,
      sticker: 'chart',
      theme: 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]',
      what: days === 1 ? 'What each hospital brought in on this day.' : `Each bar is ${days <= 31 ? 'a day' : 'a week'}: the amount (blue, green when reached) next to its share of your target (grey).`,
      read: ['The percentage on top is how much of that bar’s target was reached.', 'Look for a run of low bars: that is when to step up follow-ups.'],
      facts: [
        { label: days <= 31 ? 'Days on target' : 'Weeks on target', value: `${bars.filter((x) => 'target' in x && x.value >= (x as { target: number }).target).length} of ${bars.length}` },
        { label: 'Best', value: bars.length ? money(Math.max(...bars.map((x) => x.value))) : '—' },
      ],
      todo: ['Plan your visits for the days that are usually low.'],
    },
    agents: {
      title: 'Your PR agents',
      icon: Users,
      sticker: 'womanHealthWorker',
      theme: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]',
      what: 'Every PR agent at your hospitals, grouped by how they are referring right now.',
      read: ['Top and Growing: sending well. Steady: as usual.', 'Slipping: sending much less than before. Gone quiet: nothing for 15 to 45 days. Inactive: over 45 days.', 'This always shows today’s picture, whatever dates you picked.'],
      facts: [
        { label: 'Doing well', value: formatCount(good), tone: 'good' },
        { label: 'Need you', value: formatCount(need), tone: need ? 'bad' : undefined },
        { label: 'Never referred', value: formatCount(statusCount('never')) },
        { label: 'All agents', value: formatCount(m.myHealth.length) },
      ],
      todo: ['Follow up the slipping and quiet agents first.', 'Thank your top agents: it keeps them sending.'],
    },
    daily: {
      title: 'Day by day',
      icon: TrendingUp,
      sticker: 'chart',
      theme: 'from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5]',
      what: `The amount each day (blue) against the same days of ${before} (grey dashed).`,
      read: ['Tap along the line to read a day.', 'Blue above grey means you are doing better than before.'],
      facts: [
        { label: 'These dates', value: money(tot.revenue) },
        { label: 'The dates before', value: money(tot.before) },
      ],
      todo: [],
    },
    patientsByHospital: {
      title: 'Patients by hospital',
      icon: Users,
      sticker: 'hospital',
      theme: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]',
      what: 'How many patients each of your hospitals sent, busiest first.',
      read: ['Long bars are your busiest hospitals.', 'A hospital with many PR agents but a short bar has room to grow.'],
      facts: rows.slice(0, 4).map((r) => ({ label: r.k, value: plural(r.now.patients, 'patient') })),
      todo: ['Pick one hospital with a short bar and plan a visit this week.'],
    },
    six: {
      title: 'Six months against target',
      icon: TrendingUp,
      sticker: 'calendar',
      theme: 'from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5]',
      what: 'Each month: what your hospitals generated (blue, green when reached) next to that month’s target (grey).',
      read: ['The percentage is how much of the month’s target you reached.', 'This month is still running, so its bar keeps growing.'],
      facts: m.history.slice(-4).map((h) => ({ label: monthName(h.month), value: `${Math.round(h.pct * 100)}% · ${money(h.revenue)}`, tone: h.pct >= 1 ? ('good' as const) : undefined })),
      todo: [m.history.filter((h) => h.pct >= 1).length ? `You reached your target in ${plural(m.history.filter((h) => h.pct >= 1).length, 'month')} of the last six. Do what you did then.` : 'No month at target yet: the target guide on My hospitals shows how to close the gap.'],
    },
  };
  const actionFor = (k: ExplainKey) => (k === 'followups' || k === 'agents' ? { label: 'Follow up now', onClick: openFollow } : k === 'target' || k === 'byHospital' || k === 'patientsByHospital' ? { label: 'Open My hospitals', onClick: () => go('hospitals') } : undefined);

  if (!m.mine.length)
    return (
      <div className="relative">
        <PageGlow />
        <AdminTopBar />
        <div className="relative">
          <PageTitle title="Analysis" />
          <p className="rounded-[22px] bg-white p-5 text-center text-[14px] text-muted ring-1 ring-line/70">No hospitals yet. Your Branch Manager gives you your hospitals.</p>
        </div>
      </div>
    );

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Analysis" sub={`Your ${plural(m.mine.length, 'hospital')} · tap any card to have it explained`} />
        <StickyTools>
          <PeriodFilter p={p} onChange={setP} />
        </StickyTools>

        <div ref={kpi.ref} className="mt-3 grid grid-cols-2 gap-2.5">
          {(
            [
              { k: 'amount', l: 'Amount generated', v: tot.revenue, f: money, icon: <Wallet size={22} className="text-brand-500" />, tint: 'bg-tint-blue border-[#d6e7ff]', ink: 'text-brand-800', s: change === null ? `${label(p, b)}` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs before`, good: (change ?? 0) >= 0 },
              { k: 'patients', l: 'Patients attended', v: tot.patients, f: (n: number) => formatCount(Math.round(n)), icon: <Users size={22} className="text-violet" />, tint: 'bg-tint-purple border-[#e2d8ff]', ink: 'text-violet', s: changeP === null ? '' : `${changeP >= 0 ? '▲' : '▼'} ${Math.abs(changeP)}% vs before`, good: (changeP ?? 0) >= 0 },
              { k: 'avg', l: 'Average per patient', v: avg, f: money, icon: <TrendingUp size={22} className="text-good" />, tint: 'bg-tint-green border-[#cdeedb]', ink: 'text-[#14633a]', s: 'Amount ÷ patients', good: true },
              { k: 'followups', l: 'Follow-ups', v: follows, f: (n: number) => formatCount(Math.round(n)), icon: <ClipboardCheck size={22} className="text-orange" />, tint: 'bg-tint-orange border-[#ffe2c6]', ink: 'text-warn-ink', s: `${recruits} new agents · ${need} need you`, good: true },
            ] as const
          ).map((t) => (
            <button key={t.k} type="button" onClick={() => setOpen(t.k)} className={`press min-h-[122px] rounded-[18px] border p-3 text-left ${t.tint}`}>
              <span className="flex items-start justify-between">
                {t.icon}
                <Info size={14} className="text-muted" />
              </span>
              <p className="mt-1.5 text-[12.5px] text-ink-2">{t.l}</p>
              <p className={`text-[21px] font-bold leading-tight tracking-[-0.02em] ${t.ink}`}>
                <CountUp value={t.v} format={t.f} seen={kpi.seen} />
              </p>
              <p className={`truncate text-[11px] font-semibold ${t.s.startsWith('▼') ? 'text-[#d93036]' : t.s.startsWith('▲') ? 'text-good' : 'text-muted'}`}>{t.s}</p>
            </button>
          ))}
        </div>

        <BoostPrompt />

        <Box title="Target for these dates" sub={label(p, b)} onExplain={() => setOpen('target')}>
          <div className="mb-2 flex items-end justify-between">
            <b className="text-[24px] tracking-[-0.02em] text-ink">{money(tot.revenue)}</b>
            <span className="pb-1 text-[13px] text-muted">of {money(target)}</span>
          </div>
          <GrowBar pct={target ? tot.revenue / target : 0} className="h-3 bg-page" />
          <p className="mt-2 text-[12.5px] font-semibold text-ink-2">{tot.revenue >= target ? `Target reached, ${money(tot.revenue - target)} over` : `${money(target - tot.revenue)} short · ${target ? Math.round((tot.revenue / target) * 100) : 0}% reached`}</p>
        </Box>

        <Box title="Amount by hospital" sub="Share of your amount" onExplain={() => setOpen('byHospital')}>
          <Donut parts={[...top.map((x, i) => ({ label: x.k, value: x.now.revenue, color: PIE[i]!, sub: plural(x.now.patients, 'patient') })), ...(rest > 0 ? [{ label: 'Other hospitals', value: rest, color: PIE[6]! }] : [])]} total={money(tot.revenue)} label="Generated" format={money} legend="below" />
        </Box>

        <Box title={explain.trend.title} sub={days === 1 ? 'Top hospitals' : 'Amount against the target share'} onExplain={() => setOpen('trend')}>
          <GrowBars key={`${b.from}-${b.to}`} items={bars} format={money} />
        </Box>

        <Box title="Your PR agents" sub="How they are referring now" onExplain={() => setOpen('agents')}>
          <Donut parts={STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: statusCount(s), color: STATUS_COLOR[s] })).filter((x) => x.value > 0)} total={formatCount(m.myHealth.length)} label="PR agents" format={(n) => formatCount(n)} />
        </Box>

        {days > 1 && (
          <Box title="Day by day" sub={`Against ${before}`} onExplain={() => setOpen('daily')}>
            <LineChart labels={daily.map((d) => String(Number(d.date.slice(8))))} series={[{ name: 'These dates', color: '#1f6fe8', values: daily.map((d) => d.revenue) }, { name: 'Before', color: '#94a3b8', values: priorDaily.map((d) => d.revenue), dashed: true }]} format={money} />
          </Box>
        )}

        <Box title="Patients by hospital" sub="Busiest first" onExplain={() => setOpen('patientsByHospital')}>
          <HBars key={`${b.from}-${b.to}`} rows={[...rows].sort((a, c) => c.now.patients - a.now.patients).slice(0, 8).map((x) => ({ label: x.k, value: x.now.patients }))} />
        </Box>

        <Box title="Six months against target" sub={`To ${monthName(monthKey(), true)}`} onExplain={() => setOpen('six')}>
          <GrowBars items={m.history.map((h) => ({ label: monthName(h.month).split(' ')[0]!, value: h.revenue, target: h.target }))} format={money} />
        </Box>
      </div>
      {open && <ExplainSheet e={explain[open]} action={actionFor(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function SixMonthsExplain({ onClose }: { onClose: () => void }) {
  const { m, go } = useMk();
  const money = (n: number) => m.money(n);
  const reached = m.history.filter((h) => h.pct >= 1).length;
  const e: Explain = {
    title: 'Your last six months',
    icon: TrendingUp,
    sticker: 'calendar',
    theme: 'from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5]',
    what: 'Each month: what your hospitals generated (blue, green when reached) next to that month’s target (grey).',
    read: ['The percentage on top is how much of that month’s target you reached.', 'This month is still running, so its bar keeps growing until the month ends.'],
    facts: m.history.slice(-4).map((h) => ({ label: monthName(h.month, true), value: `${Math.round(h.pct * 100)}% · ${money(h.revenue)}`, tone: h.pct >= 1 ? ('good' as const) : undefined })),
    todo: [reached ? `You reached your target in ${plural(reached, 'month')} of the last six. Think back to what you did then and repeat it.` : 'No month at target yet: the target guide on My hospitals shows the daily amount you need.', 'Open Analysis for any day, week, month or dates you choose.'],
  };
  return <ExplainSheet e={e} onClose={onClose} action={{ label: 'Open Analysis', onClick: () => go('analysis') }} />;
}

function HBars({ rows }: { rows: { label: string; value: number }[] }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div ref={ref} className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[12.5px]">
            <b className="truncate text-ink">{r.label}</b>
            <span className="font-semibold text-ink-2">{plural(r.value, 'patient')}</span>
          </div>
          <span className="block h-2.5 overflow-hidden rounded-full bg-page">
            <i className="block h-full rounded-full bg-linear-to-r from-[#7c5cff] to-[#4f46e5] transition-[width] duration-[1000ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]" style={{ width: seen ? `${(r.value / max) * 100}%` : '0%', transitionDelay: `${i * 80}ms` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
