/**
 * The app's building blocks, styled after the owner's reference design.
 * Screens compose these — no screen invents its own button or card style.
 * (In the React Native version each becomes the same-named native component.)
 */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, Check, Search, SlidersHorizontal } from 'lucide-react';
import { PHOTOS, STICKERS, type StickerKey } from '@/assets';
import type { Service } from '@/data/services';
import { initials } from '@/domain/format';
import { STATUS_LABEL, type ReferralStatus } from '@/domain/referrals';
import { useApp } from '@/app/store';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ─────────────── Images ─────────────── */

export function Sticker({ name, size = 48, className = '', alt = '' }: { name: StickerKey; size?: number; className?: string; alt?: string }) {
  return <img src={STICKERS[name]} width={size} height={size} alt={alt} draggable={false} className={cx('pointer-events-none select-none object-contain drop-shadow-[0_8px_14px_rgba(20,60,140,0.18)]', className)} style={{ width: size, height: size }} />;
}

/** Service picture: its photo, or a sticker on a soft tile. */
export function ServiceThumb({ service, className = '' }: { service: Service; className?: string }) {
  if (service.photo) return <img src={PHOTOS[service.photo].thumb} alt="" draggable={false} className={cx('object-cover', className)} />;
  return (
    <span className={cx('grid place-items-center bg-tint-blue', className)}>
      <Sticker name={service.sticker ?? 'microscope'} size={44} />
    </span>
  );
}

/* ─────────────── Layout ─────────────── */

/** Sticky screen title bar with a back arrow (inner screens). */
export function ScreenHeader({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const { back: goBack } = useApp();
  return (
    <header className="sticky top-0 z-30 -mx-5 flex min-h-16 items-center gap-3 bg-page px-5 pt-[var(--safe-top)] md:-mx-8 md:px-8">
      {back && (
        <button type="button" onClick={goBack} aria-label="Back" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-white">
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
      {right}
    </header>
  );
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <p className="-mt-1 mb-5 text-[15px] leading-relaxed text-muted">{children}</p>;
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('card', className)}>{children}</As>;
}

export function SectionTitle({ title, action, onAction, icon }: { title: string; action?: string; onAction?: () => void; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[19px] font-bold tracking-[-0.01em] text-ink">
        {icon}
        {title}
      </h2>
      {action && (
        <button type="button" onClick={onAction} className="flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-brand-600">
          {action} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

/* ─────────────── Controls ─────────────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; block?: boolean };
export function Button({ variant = 'primary', block, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'press inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl px-5 text-[16px] font-semibold disabled:opacity-50',
        variant === 'primary' && 'bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_10px_22px_rgba(31,111,232,0.28)]',
        variant === 'secondary' && 'border border-line bg-white text-ink-2',
        variant === 'ghost' && 'text-brand-600',
        block && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Pill filter chip (category, status). */
export function Chip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('press shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium', active ? 'bg-brand-600 text-white shadow-[0_6px_14px_rgba(31,111,232,0.25)]' : 'border border-line bg-white text-ink-2')}
    >
      {children}
    </button>
  );
}

/** Horizontal, swipeable row of chips that runs edge to edge. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="-mx-5 mb-4 flex gap-2.5 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">{children}</div>;
}

export const SearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchField({ className = '', ...rest }, ref) {
  return (
    <label className={cx('flex min-h-13 flex-1 items-center gap-3 rounded-full border border-line bg-white px-5 shadow-[0_6px_18px_rgba(30,74,160,0.06)] focus-within:border-brand-400', className)}>
      <Search size={21} className="shrink-0 text-ink-2" />
      <input ref={ref} type="search" {...rest} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
    </label>
  );
});

export function FilterButton({ onClick, label = 'Filters', icon }: { onClick?: () => void; label?: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="press grid h-13 w-13 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink-2 shadow-[0_6px_18px_rgba(30,74,160,0.06)]">
      {icon ?? <SlidersHorizontal size={21} />}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mb-5 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={cx('press min-h-11 rounded-full text-[14px] font-semibold', o.value === value ? 'bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.28)]' : 'border border-line bg-white text-ink-2')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e6ebf3]">
      <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-brand-600 transition-[width] duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Numbered steps with connecting lines; completed steps show a tick. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex items-start" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center gap-2" aria-current={on ? 'step' : undefined}>
            {/* Line from the previous step's circle to this one. */}
            {i > 0 && <span className={cx('absolute top-[17px] h-0.5', done || on ? 'bg-brand-500' : 'bg-[#d7dfeb]')} style={{ left: 'calc(-50% + 26px)', right: 'calc(50% + 26px)' }} />}
            <span className={cx('relative z-10 grid h-9 w-9 place-items-center rounded-full text-[15px] font-semibold', done || on ? 'bg-brand-600 text-white shadow-[0_6px_14px_rgba(31,111,232,0.3)]' : 'border-2 border-[#d7dfeb] bg-white text-ink-2')}>{done ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
            <span className={cx('text-[14px]', on ? 'font-semibold text-brand-600' : 'text-ink-2')}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

const STATUS_STYLE: Record<ReferralStatus, string> = {
  Completed: 'bg-[#dcf5e6] text-good-ink',
  Arrived: 'bg-brand-50 text-brand-700',
  Pending: 'bg-[#ffecd9] text-warn-ink',
  Cancelled: 'bg-[#fde2e2] text-[#b42318]',
};
export function StatusBadge({ status }: { status: ReferralStatus }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1 text-[13px] font-semibold', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

const AVATAR_TINTS = ['bg-tint-blue text-brand-700', 'bg-tint-purple text-violet', 'bg-tint-orange text-orange', 'bg-tint-green text-good-ink', 'bg-tint-pink text-[#c2255c]'];
export function InitialsAvatar({ name, size = 52 }: { name: string; size?: number }) {
  const tint = AVATAR_TINTS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full font-bold', tint)} style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** WhatsApp-green button with the WhatsApp mark (sharing referrals with patients). */
export function WhatsAppButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="press inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-linear-to-b from-[#2bd468] to-[#1ebe5a] px-5 text-[16px] font-semibold text-white shadow-[0_10px_22px_rgba(30,190,90,0.3)]">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
      </svg>
      {children}
    </button>
  );
}

/* ─────────────── Forms ─────────────── */

export function Field({ label, required, optional, error, children, id }: { label: string; required?: boolean; optional?: boolean; error?: string; children: ReactNode; id?: string }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-ink">
        {label}
        {required && <span className="text-[#e5484d]"> *</span>}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-[13px] font-medium text-[#d93036]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (error?: string) => cx('min-h-13 w-full rounded-2xl border bg-white px-4 text-[15px] text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100', error ? 'border-[#e5484d]' : 'border-line');

export function EmptyState({ sticker, title, text, action }: { sticker: StickerKey; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Sticker name={sticker} size={84} />
      <h3 className="mt-4 text-[17px] font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-72 text-[14px] leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
