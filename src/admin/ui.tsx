/**
 * Mobile admin building blocks, in the app's mobile design (not the desktop
 * styling): page header with the branch + period selector, KPI cards,
 * section headings, money display (currencies are never combined, as on the
 * desktop), ranked bar lists, a trend chart and bottom sheets.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, Building2, CalendarDays, Check, ChevronDown, ChevronRight, Menu, Search, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, getBranch } from '@company/data/company';
import type { Currency, Money, PeriodSelection } from '@company/data/types';
import { PERIOD_OPTIONS, periodLabel, resolveRange } from '@company/services/analytics';
import { formatMoney, moneyEntries } from '@company/shared/format';
import { useAdminShell } from './shell';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ─────────────── header ─────────────── */

export function AdminHeader({ title, back, right, scope = true }: { title: string; back?: boolean; right?: ReactNode; scope?: boolean }) {
  const { openMenu, unread } = useAdminShell();
  const { navigate } = useCompany();
  return (
    <header className="sticky top-0 z-30 -mx-5 bg-page/95 px-5 pt-[var(--safe-top)] backdrop-blur-xl md:-mx-8 md:px-8">
      <div className="flex min-h-16 items-center gap-2">
        {back ? (
          <button type="button" onClick={() => window.history.back()} aria-label="Back" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink">
            <ArrowLeft size={24} />
          </button>
        ) : (
          <button type="button" onClick={openMenu} aria-label="Menu" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink md:hidden">
            <Menu size={25} />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[21px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {right}
        <button type="button" onClick={() => navigate('/notifications')} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="press relative -mr-2 grid h-11 w-11 place-items-center rounded-full text-ink">
          <Bell size={23} />
          {unread > 0 && <span className="absolute right-1 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ef4444] px-1 text-[10.5px] font-bold text-white ring-2 ring-page">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </div>
      {scope && <ScopeBar />}
    </header>
  );
}

/** "All branches · Today": the branch scope and the reporting period (desktop: context + period). */
export function ScopeBar({ branchOnly, periodOnly }: { branchOnly?: boolean; periodOnly?: boolean }) {
  const { context, setContext, period, setPeriod } = useCompany();
  const [sheet, setSheet] = useState<'branch' | 'period' | null>(null);
  const [from, setFrom] = useState(period.from ?? '');
  const [to, setTo] = useState(period.to ?? '');
  const branch = context === 'all' ? null : getBranch(context);
  return (
    <>
      <div className="flex gap-2 pb-3">
        {!periodOnly && (
          <button type="button" onClick={() => setSheet('branch')} className="press flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-ink shadow-sm ring-1 ring-line">
            <Building2 size={16} className="shrink-0 text-brand-600" />
            <span className="truncate">{branch ? `${branch.name} branch` : 'All branches'}</span>
            <ChevronDown size={15} className="ml-auto shrink-0 text-muted" />
          </button>
        )}
        {!branchOnly && (
          <button type="button" onClick={() => setSheet('period')} className="press flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-ink shadow-sm ring-1 ring-line">
            <CalendarDays size={16} className="shrink-0 text-brand-600" />
            <span className="truncate">{periodLabel(period)}</span>
            <ChevronDown size={15} className="ml-auto shrink-0 text-muted" />
          </button>
        )}
      </div>
      {sheet === 'branch' && (
        <Sheet title="Show figures for" onClose={() => setSheet(null)}>
          {[{ id: 'all', name: 'All branches', sub: `${ACTIVE_BRANCHES.length} active branch${ACTIVE_BRANCHES.length === 1 ? '' : 'es'}` }, ...ACTIVE_BRANCHES.map((b) => ({ id: b.id, name: `${b.name} branch`, sub: `${b.code} · ${b.city}` }))].map((o) => (
            <Option key={o.id} on={context === o.id} title={o.name} sub={o.sub} onClick={() => (setContext(o.id), setSheet(null))} />
          ))}
        </Sheet>
      )}
      {sheet === 'period' && (
        <Sheet title="Reporting period" onClose={() => setSheet(null)}>
          {PERIOD_OPTIONS.filter((o) => o.key !== 'custom').map((o) => (
            <Option key={o.key} on={period.key === o.key} title={o.label} onClick={() => (setPeriod({ key: o.key }), setSheet(null))} />
          ))}
          <div className="mt-2 rounded-2xl bg-page p-3">
            <p className="mb-2 text-[13.5px] font-semibold text-ink">Custom date range</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="min-h-11 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="min-h-11 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
            </div>
            <button type="button" disabled={!from || !to || from > to} onClick={() => (setPeriod({ key: 'custom', from, to }), setSheet(null))} className="press mt-2 min-h-11 w-full rounded-xl bg-brand-600 text-[14.5px] font-semibold text-white disabled:opacity-40">
              Apply range
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function Option({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cx('press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left', on ? 'bg-brand-50' : 'hover:bg-page')}>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[15.5px]', on ? 'font-bold text-brand-700' : 'font-medium text-ink')}>{title}</span>
        {sub && <span className="block text-[12.5px] text-muted">{sub}</span>}
      </span>
      {on && <Check size={19} className="text-brand-600" />}
    </button>
  );
}

/* ─────────────── sheets ─────────────── */

/**
 * Slide-up card (owner, 2026-11-25): rises from the bottom of the screen,
 * sizes itself to its content (up to just below the status bar) and scrolls
 * inside. Rendered on <body> through a portal, so a blurred sticky header can
 * never trap it (that made the period picker overflow off the top).
 */
const stack: symbol[] = [];

export interface SheetSearch {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}
export interface SheetFilter {
  /** Shown in the header when the filter differs from the page's own. */
  active: boolean;
  label: string;
  /** The drop-down content; call close() after a choice. */
  render: (close: () => void) => ReactNode;
}

/*
 * Cards stack: a card opened from a card slides up over it (a little lower, so
 * the one underneath shows), and Escape or the back arrow closes only the top one.
 * Search and filter live IN the header bar (owner, 2026-11-25): only their icons
 * show. Search turns the same bar into a search box; the filter icon drops its
 * options down from the bar. No extra sticky bars.
 */
export function Sheet({ title, subtitle, onClose, children, tall, footer, search, filter, back }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; tall?: boolean; footer?: ReactNode; search?: SheetSearch; filter?: SheetFilter; back?: boolean }) {
  const [me] = useState(() => Symbol('sheet'));
  const [level] = useState(() => stack.length);
  const [searching, setSearching] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    stack.push(me);
    return () => void stack.splice(stack.indexOf(me), 1);
  }, [me]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== me) return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose, me]);
  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  const top = `calc(var(--safe-top) + ${48 + Math.min(level, 3) * 18}px)`;
  const closeSearch = () => {
    setSearching(false);
    search?.onChange('');
  };
  const iconBtn = 'press relative grid h-9 w-9 shrink-0 place-items-center rounded-full';
  return createPortal(
    <div data-slide-layer className={cx('fade-in fixed inset-0 flex items-end justify-center md:items-center', level ? 'bg-[#0b1730]/25' : 'bg-[#0b1730]/45')} style={{ zIndex: 80 + level }} onClick={onClose}>
      <div role="dialog" aria-label={title} data-sheet-panel className="sheet-up flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(11,23,48,0.18)] md:rounded-[28px]" style={tall ? { height: `calc(100dvh - ${top})` } : { maxHeight: `calc(100dvh - ${top})` }} onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mt-2.5 block h-1.5 w-11 shrink-0 rounded-full bg-[#d6dde8] md:hidden" />
        <div className="relative shrink-0">
          {searching && search ? (
            <div className="flex items-center gap-2 px-3 pb-3 pt-2.5">
              <button type="button" onClick={closeSearch} aria-label="Close search" className={cx(iconBtn, 'text-ink')}>
                <ArrowLeft size={20} />
              </button>
              <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border-[1.5px] border-brand-500 bg-white px-3.5 ring-4 ring-brand-100">
                <Search size={17} className="shrink-0 text-brand-600" />
                <input ref={input} value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
                {search.value && (
                  <button type="button" onClick={() => search.onChange('')} aria-label="Clear search" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-page text-muted">
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 px-3 pb-3 pt-2.5">
              {back && (
                <button type="button" onClick={onClose} aria-label="Back" className={cx(iconBtn, 'mt-0.5 text-ink')}>
                  <ArrowLeft size={21} />
                </button>
              )}
              <div className={cx('min-w-0 flex-1 pt-0.5', !back && 'pl-2')}>
                <p className="line-clamp-2 text-[19px] font-bold leading-tight text-ink">{title}</p>
                {(subtitle || filter) && (
                  <p className="mt-0.5 truncate text-[13px] leading-snug text-muted">
                    {subtitle}
                    {subtitle && filter ? ' · ' : ''}
                    {filter && <span className={filter.active ? 'font-semibold text-brand-600' : ''}>{filter.label}</span>}
                  </p>
                )}
              </div>
              {search && (
                <button type="button" onClick={() => (setSearching(true), setFilterOpen(false))} aria-label="Search" className={cx(iconBtn, 'bg-page text-ink-2')}>
                  <Search size={18} />
                  {search.value && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white" />}
                </button>
              )}
              {filter && (
                <button type="button" onClick={() => setFilterOpen((o) => !o)} aria-label="Filter by date" aria-expanded={filterOpen} className={cx(iconBtn, filterOpen ? 'bg-brand-600 text-white' : 'bg-page text-ink-2')}>
                  <CalendarDays size={17} />
                  {filter.active && !filterOpen && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white" />}
                </button>
              )}
              {!back && (
                <button type="button" onClick={onClose} aria-label="Close" className={cx(iconBtn, 'bg-page text-ink-2')}>
                  <X size={19} />
                </button>
              )}
            </div>
          )}
          {filterOpen && filter && <div className="drop-down absolute inset-x-3 top-full z-10 max-h-[60vh] overflow-y-auto rounded-[22px] bg-white p-2 shadow-[0_18px_44px_rgba(11,23,48,0.2)] ring-1 ring-line">{filter.render(() => setFilterOpen(false))}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(16px,var(--safe-bottom))]" onPointerDown={() => filterOpen && setFilterOpen(false)}>
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-line px-4 pb-[max(14px,var(--safe-bottom))] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Date choices inside a slide-up's filter drop-down (never changes the dashboard's period). */
export function PeriodChoices({ value, onChange }: { value: PeriodSelection; onChange: (p: PeriodSelection) => void }) {
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  return (
    <div>
      <p className="px-3 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Show records for</p>
      {PERIOD_OPTIONS.filter((o) => o.key !== 'custom').map((o) => (
        <Option key={o.key} on={value.key === o.key} title={o.label} onClick={() => onChange({ key: o.key })} />
      ))}
      <div className="mt-1 rounded-2xl bg-page p-3">
        <p className="mb-2 text-[13.5px] font-semibold text-ink">Custom date range</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="min-h-11 min-w-0 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="min-h-11 min-w-0 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
        </div>
        <button type="button" disabled={!from || !to || from > to} onClick={() => onChange({ key: 'custom', from, to })} className="press mt-2 min-h-11 w-full rounded-xl bg-brand-600 text-[14.5px] font-semibold text-white disabled:opacity-40">
          Apply range
        </button>
      </div>
    </div>
  );
}

/** "Today", "This Month", or "3 Nov to 20 Nov" for a custom range. */
export function periodText(p: PeriodSelection) {
  if (p.key !== 'custom' || !p.from || !p.to) return periodLabel(p);
  const f = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return p.from === p.to ? f(p.from) : `${f(p.from)} to ${f(p.to)}`;
}

/** A slide-up's own date filter: starts from the page's period and never changes it. */
export function useSheetPeriod(initial: PeriodSelection) {
  const [period, setPeriod] = useState<PeriodSelection>(initial);
  const range = useMemo(() => resolveRange(period), [period]);
  const filter: SheetFilter = {
    active: period.key !== initial.key || period.from !== initial.from || period.to !== initial.to,
    label: periodText(period),
    render: (close) => <PeriodChoices value={period} onChange={(p) => (setPeriod(p), close())} />,
  };
  return { period, range, text: periodText(period), filter };
}

/* ─────────────── money and numbers ─────────────── */

/** Every currency on its own line (the desktop never combines currencies). */
export function MoneyValue({ money, compact, className = '', empty = '₦0' }: { money: Money; compact?: boolean; className?: string; empty?: string }) {
  const e = moneyEntries(money);
  if (!e.length) return <span className={className}>{empty}</span>;
  return (
    <span className={cx('flex flex-col', className)}>
      {e.map(([c, v]) => (
        <span key={c} className="truncate">
          {formatMoney(v, c, compact)}
        </span>
      ))}
    </span>
  );
}
export const money1 = (money: Money, c: Currency = 'NGN', compact = false) => formatMoney(money[c] ?? 0, c, compact);

export function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-[11.5px] text-muted">No earlier figure</span>;
  const up = pct >= 0;
  return (
    <span className={cx('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold', up ? 'bg-tint-green text-good-ink' : 'bg-[#fdecec] text-[#b42318]')}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ─────────────── cards and sections ─────────────── */

export function SectionHead({ eyebrow, title, note, action, onAction }: { eyebrow?: string; title: string; note?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-600">{eyebrow}</p>}
        <h2 className="text-[19px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{note}</p>}
      </div>
      {action && (
        <button type="button" onClick={onAction} className="flex shrink-0 items-center gap-0.5 text-[14px] font-semibold text-brand-600">
          {action} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export function Kpi({ icon, tone, title, value, delta, note, onClick }: { icon: ReactNode; tone: string; title: string; value: ReactNode; delta?: ReactNode; note?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="press flex min-w-0 flex-col items-start rounded-[20px] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70 disabled:cursor-default">
      <span className={cx('grid h-9 w-9 place-items-center rounded-xl', tone)}>{icon}</span>
      <span className="mt-2.5 text-[12.5px] font-medium leading-tight text-ink-2">{title}</span>
      <span className="mt-1 w-full text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink">{value}</span>
      {delta && <span className="mt-1.5">{delta}</span>}
      {note && <span className="mt-1 text-[11.5px] leading-snug text-muted">{note}</span>}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[22px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70', className)}>{children}</section>;
}

/** Ranked bars: label, value text and a bar scaled to the largest value. */
export function BarList({ rows, color = 'bg-brand-500', onRow }: { rows: { key: string; label: string; sub?: string; value: number; text: string }[]; color?: string; onRow?: (key: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.key}>
          <button type="button" disabled={!onRow} onClick={() => onRow?.(r.key)} className="press block w-full px-4 py-3 text-left disabled:cursor-default">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">
                <span className="mr-1.5 text-muted">{i + 1}.</span>
                {r.label}
              </span>
              <span className="shrink-0 text-[14px] font-bold text-ink">{r.text}</span>
            </span>
            {r.sub && <span className="block truncate text-[12px] text-muted">{r.sub}</span>}
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#eef2f8]">
              <span className={cx('block h-full rounded-full', color)} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Revenue / payments / expenses over time (simple grouped bars). */
export function TrendChart({ labels, series }: { labels: string[]; series: { name: string; color: string; values: number[] }[] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;
  const show = (i: number) => n <= 7 || i % Math.ceil(n / 6) === 0 || i === n - 1;
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {labels.map((l, i) => (
          <div key={l + i} className="flex h-full min-w-0 flex-1 items-end justify-center gap-[1px]" title={l}>
            {series.map((s) => (
              <span key={s.name} className="w-full max-w-[9px] rounded-t-[3px]" style={{ height: `${Math.max(1.5, (s.values[i]! / max) * 100)}%`, background: s.color }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {labels.map((l, i) => (
          <span key={l + i} className="min-w-0 flex-1 truncate text-center text-[9.5px] text-muted">
            {show(i) ? l : ''}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Share bar: one row of coloured segments with a legend (payment methods, expense categories). */
export function ShareBar({ parts, format }: { parts: { label: string; value: number; color: string }[]; format: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[#eef2f8]">
        {total > 0 && parts.map((p) => <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <ul className="mt-3 space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-ink">
              {format(p.value)} <span className="font-normal text-muted">{total ? `${Math.round((p.value / total) * 100)}%` : ''}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const PALETTE = ['#1f6fe8', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#ec4899', '#64748b'];

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {text && <p className="mt-1 text-[13px] text-muted">{text}</p>}
    </div>
  );
}
