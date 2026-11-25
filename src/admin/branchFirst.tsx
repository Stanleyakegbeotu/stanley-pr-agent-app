/**
 * Branch-first pages (desktop rule): Finance & Expenses, PR Management and
 * Staff Management each belong to one branch, so on "All branches" the admin
 * first picks a branch card; when the scope is already one branch the page
 * opens straight on it. Routes: "#/admin/<page>" (choose) and
 * "#/admin/<page>/<branchId>" (the branch). Also the shared page title and
 * the page's own date chip (never changes the dashboard's period).
 */
import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { BRANCHES, getBranch } from '@company/data/company';
import type { Branch, PeriodSelection } from '@company/data/types';
import type { StickerKey } from '@/assets';
import { Sticker } from '@/ui/kit';
import { PeriodChoices, Sheet, periodText } from './ui';

/** The branch this page is about: the scope's branch, else the one in the address. */
export function useBranchFirst(sub?: string): { branch: Branch | null; fromScope: boolean } {
  const { context } = useCompany();
  if (context !== 'all') return { branch: getBranch(context) ?? null, fromScope: true };
  const b = sub ? getBranch(sub) : undefined;
  return { branch: b ?? null, fromScope: false };
}

export function PageTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-4 flex items-end justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[14.5px] text-ink-2">{sub}</p>}
      </div>
      {action}
    </section>
  );
}

export interface PickStat {
  label: string;
  value: string;
  danger?: boolean;
}

/** "Choose a branch": one card per branch with the page's own figures. */
export function BranchPick({ page, note, sticker = 'hospital', stats, foot, go = 'Open' }: { page: string; note: string; sticker?: StickerKey; stats: (b: Branch) => PickStat[]; foot: (b: Branch) => string; go?: string }) {
  const { navigate } = useCompany();
  return (
    <>
      <p className="mb-3 text-[14px] text-ink-2">{note}</p>
      <div className="space-y-3">
        {BRANCHES.map((b) => {
          const active = b.status === 'Active';
          return (
            <button key={b.id} type="button" disabled={!active} onClick={() => navigate(`/${page}/${b.id}`)} className="press block w-full rounded-[22px] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70 disabled:opacity-70">
              <span className="flex items-start gap-3">
                <span className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[16px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff]">
                  <Sticker name={sticker} size={40} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[17px] font-bold text-ink">{b.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${active ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{b.status}</span>
                  </span>
                  <span className="flex items-center gap-1 text-[12.5px] text-muted">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">
                      {b.code} · {b.city}, {b.country} · {b.currency}
                    </span>
                  </span>
                </span>
              </span>
              {active ? (
                <>
                  <span className="mt-3 grid grid-cols-2 gap-2">
                    {stats(b).map((s) => (
                      <span key={s.label} className="min-w-0 rounded-2xl bg-page px-3 py-2">
                        <span className="block truncate text-[11.5px] text-muted">{s.label}</span>
                        <b className={`block truncate text-[15.5px] ${s.danger ? 'text-[#b42318]' : 'text-ink'}`}>{s.value}</b>
                      </span>
                    ))}
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[12.5px]">
                    <span className="min-w-0 truncate text-muted">{foot(b)}</span>
                    <span className="flex shrink-0 items-center gap-0.5 font-semibold text-brand-600">
                      {go} <ChevronRight size={15} />
                    </span>
                  </span>
                </>
              ) : (
                <span className="mt-2.5 block rounded-2xl bg-page px-3 py-2 text-[12.5px] text-muted">Setup in progress. Activate it in Settings, Branch Management.</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** "All branches ›  Lekki branch": shown when the admin came through the branch cards. */
export function BranchCrumb({ page, label, branch }: { page: string; label: string; branch: Branch }) {
  const { navigate } = useCompany();
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[13px]">
      <button type="button" onClick={() => navigate(`/${page}`)} className="press rounded-full bg-white px-3 py-1.5 font-semibold text-brand-600 ring-1 ring-line">
        All branches
      </button>
      <ChevronRight size={14} className="text-faint" />
      <span className="truncate text-ink-2">
        {label} · <b className="text-ink">{branch.name}</b>
      </span>
    </nav>
  );
}

/** A page's own date choice (starts from a base period; never changes the dashboard's). */
export function PeriodChip({ value, onChange, prefix }: { value: PeriodSelection; onChange: (p: PeriodSelection) => void; prefix?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press flex min-h-10 items-center gap-2 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-ink shadow-sm ring-1 ring-line">
        <CalendarDays size={16} className="shrink-0 text-brand-600" />
        <span className="truncate">
          {prefix}
          {periodText(value)}
        </span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>
      {open && (
        <Sheet title="Show figures for" onClose={() => setOpen(false)}>
          <PeriodChoices value={value} onChange={(p) => (onChange(p), setOpen(false))} />
        </Sheet>
      )}
    </>
  );
}

/** White rounded card with a title row (the admin's standard section card). */
export function Panel({ title, note, action, onAction, children, className = '' }: { title: string; note?: string; action?: string; onAction?: () => void; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-4 rounded-[22px] bg-white p-4 shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16.5px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {note && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{note}</p>}
        </div>
        {action && (
          <button type="button" onClick={onAction} className="press flex shrink-0 items-center gap-0.5 pt-0.5 text-[13.5px] font-semibold text-brand-600">
            {action} <ChevronRight size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Horizontal filter chips. */
export function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)} className={`press min-h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold ${on ? 'bg-brand-600 text-white shadow-[0_6px_16px_rgba(31,111,232,0.28)]' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
            {o.label}
            {o.count != null && <span className={`ml-1.5 ${on ? 'text-white/80' : 'text-muted'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Label / value rows inside a card. */
export function Facts({ rows, plain }: { rows: { label: string; value: ReactNode; sub?: string; tone?: 'out' | 'in' | 'due' }[]; plain?: boolean }) {
  return (
    <dl className={`divide-y divide-line text-[13.5px] ${plain ? 'px-1' : 'rounded-2xl bg-page'}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
          <dt className="shrink-0 pt-0.5 text-muted">{r.label}</dt>
          <dd className="min-w-0 text-right">
            <span className={`block font-semibold ${r.tone === 'out' ? 'text-warn-ink' : r.tone === 'in' ? 'text-good-ink' : r.tone === 'due' ? 'text-[#b42318]' : 'text-ink'}`}>{r.value}</span>
            {r.sub && <span className="block text-[12px] text-muted">{r.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
