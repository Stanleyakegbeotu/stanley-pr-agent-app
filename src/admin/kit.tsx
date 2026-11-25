/**
 * The admin's card language (owner, 2026-11-25): the referring-clinician
 * app's look (tinted tiles with filled icons, 3D sticker illustrations, white
 * rounded cards, slide-up details), shared by every admin page so Dashboard,
 * Branches and Patients read as one app.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Bell, Clock3, CreditCard, FileText, Menu, MessageCircle, Percent, TrendingUp, Users } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import type { Currency, PaymentMethod } from '@company/data/types';
import type { Summary } from '@company/services/analytics';
import { compareCount, compareMoney } from '@company/services/analytics';
import { formatCount, formatMoney } from '@company/shared/format';
import type { StickerKey } from '@/assets';
import { Sticker } from '@/ui/kit';
import { useAdminShell } from './shell';
import type { DetailKind } from './details';

export const firstPct = (p: Partial<Record<Currency, number | null>>) => Object.values(p)[0] ?? null;

/* ─────────────── header ─────────────── */

/** Transparent top bar that turns frosted when content scrolls under it; inbox and notifications on the right. */
export function AdminTopBar({ title, back, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  const { openMenu, unread, inboxUnread, paths } = useAdminShell();
  const { navigate } = useCompany();
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} className="absolute top-0 h-px w-px" aria-hidden="true" />
      <header className={`sticky top-0 z-30 -mx-5 flex min-h-16 items-center gap-1 px-5 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-300 md:-mx-8 md:px-8 ${scrolled ? 'bg-[#eef4fe]/90 shadow-[0_6px_20px_rgba(30,74,160,0.08)] backdrop-blur-xl' : 'bg-transparent'}`}>
        {back ? (
          <button type="button" onClick={() => window.history.back()} aria-label="Back" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink">
            <ArrowLeft size={24} />
          </button>
        ) : (
          <button type="button" onClick={openMenu} aria-label="Menu" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink md:invisible">
            <Menu size={26} strokeWidth={2} />
          </button>
        )}
        <h1 className={`min-w-0 flex-1 truncate text-[21px] font-bold tracking-[-0.02em] text-ink transition-opacity ${title ? '' : 'opacity-0'}`}>{title}</h1>
        {right}
        <span className="-mr-2 flex items-center gap-1">
          {paths?.inbox !== null && (
          <button type="button" onClick={() => navigate(paths?.inbox ?? '/messages')} aria-label={inboxUnread ? `Inbox, ${inboxUnread} unread` : 'Inbox'} className="press relative grid h-11 w-11 place-items-center rounded-full text-ink">
            <MessageCircle size={25} strokeWidth={1.9} />
            {inboxUnread > 0 && <span className="absolute right-0.5 top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[#e9f1ff]">{inboxUnread > 9 ? '9+' : inboxUnread}</span>}
          </button>
          )}
          <button type="button" onClick={() => navigate(paths?.notifications ?? '/notifications')} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="press relative grid h-11 w-11 place-items-center rounded-full text-ink">
            <Bell size={26} strokeWidth={1.9} />
            {unread > 0 && <span className="absolute right-0.5 top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-[#ef4444] px-1 text-[11px] font-bold text-white ring-2 ring-[#e9f1ff]">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </span>
      </header>
    </>
  );
}

/** Soft blue glow behind the top of a page (as on the clinician Home). */
export const PageGlow = () => <div aria-hidden="true" className="pointer-events-none absolute -inset-x-5 top-0 -z-0 h-[460px] bg-[radial-gradient(120%_70%_at_75%_0%,#d6e6ff_0%,#e9f1ff_45%,rgba(244,248,254,0)_100%)] md:-inset-x-8" />;

/* ─────────────── sections and small pieces ─────────────── */

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="flex shrink-0 items-center gap-1 text-[14.5px] font-semibold text-brand-600">
          {action} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

export function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tone}`}>{children}</span>;
}

export function EmptyCard({ sticker, text }: { sticker: StickerKey; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
      <Sticker name={sticker} size={40} />
      <p className="text-[14px] text-muted">{text}</p>
    </div>
  );
}

export function Tile({ tint, icon, label, value, ink, pct, invert, onClick }: { tint: string; icon: ReactNode; label: string; value: string; ink: string; pct?: number | null; invert?: boolean; onClick: () => void }) {
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

/** The six activity tiles (revenue, payments, patients, expenses, outstanding, PR commission). */
export function ActivityTiles({ summary, prior, c, open }: { summary: Summary; prior: Summary | null; c: Currency; open: (k: DetailKind) => void }) {
  const m = (v: number) => formatMoney(v, c, true);
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Tile tint="bg-tint-blue border-[#d6e7ff]" icon={<TrendingUp size={26} className="text-brand-500" strokeWidth={2.4} />} label="Revenue" value={m(summary.revenue[c] ?? 0)} ink="text-brand-800" pct={firstPct(compareMoney(summary.revenue, prior?.revenue ?? null))} onClick={() => open('revenue')} />
      <Tile tint="bg-tint-green border-[#cdeedb]" icon={<CreditCard size={26} className="text-good" fill="currentColor" fillOpacity={0.18} strokeWidth={2.2} />} label="Payments" value={m(summary.payments[c] ?? 0)} ink="text-[#14633a]" pct={firstPct(compareMoney(summary.payments, prior?.payments ?? null))} onClick={() => open('payments')} />
      <Tile tint="bg-tint-purple border-[#e2d8ff]" icon={<Users size={26} className="text-violet" fill="currentColor" strokeWidth={1.4} />} label="Patients" value={formatCount(summary.patients)} ink="text-violet" pct={compareCount(summary.patients, prior?.patients ?? null)} onClick={() => open('patients')} />
      <Tile tint="bg-tint-orange border-[#ffe2c6]" icon={<FileText size={25} className="text-orange" fill="currentColor" fillOpacity={0.18} strokeWidth={2.2} />} label="Expenses" value={m(summary.expenses[c] ?? 0)} ink="text-warn-ink" pct={firstPct(compareMoney(summary.expenses, prior?.expenses ?? null))} invert onClick={() => open('expenses')} />
      <Tile tint="bg-[#fdecec] border-[#f9d4d4]" icon={<Clock3 size={25} className="text-[#d93036]" fill="currentColor" fillOpacity={0.15} strokeWidth={2.2} />} label="Outstanding" value={m(summary.outstanding[c] ?? 0)} ink="text-[#b42318]" pct={firstPct(compareMoney(summary.outstanding, prior?.outstanding ?? null))} invert onClick={() => open('outstanding')} />
      <Tile tint="bg-[#eef1ff] border-[#dfe3ff]" icon={<Percent size={25} className="text-[#4f46e5]" strokeWidth={2.4} />} label="PR commission" value={m(summary.prCommission[c] ?? 0)} ink="text-[#3730a3]" pct={firstPct(compareMoney(summary.prCommission, prior?.prCommission ?? null))} onClick={() => open('commission')} />
    </div>
  );
}

export function Action({ tint, sticker, label, onClick }: { tint: string; sticker: StickerKey; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[100px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border px-1 ${tint}`}>
      <Sticker name={sticker} size={40} />
      <span className="text-center text-[13px] font-medium leading-tight text-ink">{label}</span>
    </button>
  );
}

/** Live ticker: a fintech-style scrolling band of key figures (pauses on touch). */
export function Ticker({ items }: { items: { label: string; value: string; pct?: number | null; invert?: boolean }[] }) {
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

/** Payments received as an illustrated card; the method chips open the payments filtered by Cash, POS or Transfer. */
export function PaymentsCard({ title, paid, billed, c, mix, open }: { title: string; paid: number; billed: number; c: Currency; mix: { label: string; value: number }[]; open: (k: DetailKind, method?: PaymentMethod) => void }) {
  const collected = billed > 0 ? Math.min(100, (paid / billed) * 100) : 0;
  return (
    <div role="button" tabIndex={0} onClick={() => open('payments')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open('payments'))} aria-label="Payments received, see every payment" className="press relative mt-5 block w-full cursor-pointer overflow-hidden rounded-[24px] bg-linear-to-br from-[#0f8a4b] via-[#16a35a] to-[#4cc98a] p-5 text-left text-white shadow-[0_14px_30px_rgba(22,163,74,0.28)]">
      <span aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <span className="relative block max-w-[64%]">
        <span className="text-[13px] font-medium text-white/90">{title}</span>
        <span className="mt-1 block text-[30px] font-bold leading-none tracking-[-0.02em]">{formatMoney(paid, c)}</span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/25">
          <span className="block h-full rounded-full bg-white" style={{ width: `${Math.max(billed > 0 ? 3 : 0, collected)}%` }} />
        </span>
        <span className="mt-1.5 block text-[12.5px] text-white/90">{billed > 0 ? `${Math.round(collected)}% of ${formatMoney(billed, c)} billed` : 'Nothing billed in this period'}</span>
      </span>
      <span className="relative z-10 mt-3.5 grid grid-cols-3 gap-2">
        {mix.map((p) => (
          <button key={p.label} type="button" onClick={(e) => (e.stopPropagation(), open('payments', p.label as PaymentMethod))} aria-label={`Patients who paid by ${p.label}`} className="press min-w-0 rounded-xl bg-white/15 px-2.5 py-1.5 text-left text-[12px] ring-1 ring-white/20 backdrop-blur-sm hover:bg-white/25">
            <span className="flex items-center justify-between text-white/85">
              {p.label} <ArrowRight size={12} />
            </span>
            <b className="block truncate text-[13.5px]">{formatMoney(p.value, c, true)}</b>
          </button>
        ))}
      </span>
      <Sticker name="moneyBag" size={96} className="absolute right-2 top-3" />
    </div>
  );
}

/* ─────────────── announcement bar (carousel of slides) ─────────────── */

export interface Slide {
  id: string;
  /** Tailwind gradient stops, e.g. "from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]". */
  theme: string;
  sticker: StickerKey;
  label: string;
  isNew?: boolean;
  title: string;
  text: string;
  actions: { label: string; onClick: () => void }[];
}

export const THEMES = {
  blue: 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]',
  violet: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]',
  teal: 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]',
  green: 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]',
  orange: 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]',
  red: 'from-[#b42318] via-[#d93036] to-[#f0646a]',
  indigo: 'from-[#3346c9] via-[#4f63e6] to-[#8796f7]',
};

const AUTOPLAY_MS = 5500;

/** Swipeable, self-advancing announcement bar; each slide has one or two actions. */
export function SlideCarousel({ slides, label = 'Announcements' }: { slides: Slide[]; label?: string }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [paused, setPaused] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const width = useRef(1);
  const moved = useRef(false);
  const n = slides.length;
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
    <section aria-roledescription="carousel" aria-label={label} className="mt-2">
      <div className="overflow-hidden rounded-[24px] shadow-[0_14px_34px_rgba(31,99,214,0.22)]" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: 'pan-y' }}>
        <div className="flex" style={{ transform: `translateX(calc(${-at * 100}% + ${drag}px))`, transition: drag ? 'none' : 'transform 520ms cubic-bezier(.22,.8,.24,1)' }}>
          {slides.map((s, i) => (
            <article key={s.id} aria-hidden={i !== at} className={`relative isolate h-[204px] w-full shrink-0 select-none overflow-hidden bg-linear-to-r text-white ${s.theme}`}>
              <span aria-hidden="true" className="absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-white/10" />
              <div className="relative z-10 flex h-full w-[66%] flex-col justify-center py-4 pl-5">
                <p className="mb-1.5 flex items-center gap-2 text-[12.5px] font-medium text-white/95">
                  <Sticker name="megaphone" size={22} className="-rotate-12" />
                  <span className="truncate">{s.label}</span>
                  {s.isNew && <span className="shrink-0 rounded-full bg-white px-1.5 text-[10.5px] font-bold text-brand-700">NEW</span>}
                </p>
                <h3 className="line-clamp-2 text-[17.5px] font-bold leading-[1.15] tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-white/90">{s.text}</p>
                <span className="mt-3 flex gap-2">
                  {s.actions.slice(0, 2).map((a, k) => (
                    <button
                      key={a.label}
                      type="button"
                      tabIndex={i === at ? 0 : -1}
                      onClick={() => !moved.current && a.onClick()}
                      className={`press inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${k === 0 ? 'bg-white text-brand-700 shadow-[0_6px_16px_rgba(0,0,0,0.12)]' : 'bg-white/15 text-white ring-1 ring-white/40'}`}
                    >
                      {a.label} {k === 0 && <ArrowRight size={14} strokeWidth={2.4} />}
                    </button>
                  ))}
                </span>
              </div>
              <Sticker name={s.sticker} size={118} className="absolute -bottom-2 -right-3" />
            </article>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setIndex(i)} aria-label={`Slide ${i + 1} of ${n}`} aria-current={i === at} className="grid h-6 place-items-center">
              <span className={`block h-2 rounded-full transition-all duration-300 ${i === at ? 'w-5 bg-brand-600' : 'w-2 bg-[#cfd8e6]'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
