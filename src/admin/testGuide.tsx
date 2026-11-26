/**
 * Test guide, everywhere tests are listed (owner, 2026-11-26), like the
 * desktop Inventory's Guide button: each test shows its one line "what it
 * is", and Guide opens the full guide in a slide-up (what it is, what it is
 * used for, how it is done, how to prepare, sample, usual time, keywords)
 * without adding the test. Written test information (serviceInfo) replaces
 * the general guide where it exists.
 */
import { useState } from 'react';
import { BookOpen, Clock3, Droplet } from 'lucide-react';
import { GUIDE_SOURCES, guideFor } from '@company/data/serviceGuide';
import { formatMoney } from '@company/shared/format';
import { Sheet } from './ui';
import { mergeGuide, useServiceInfo } from './serviceInfo';
import { plainAll, plainText } from '@/data/services';
import { Art, resolveIcon, serviceIconOf } from './catalogueIcons';
import { meta } from './pages/Inventory';

/** One plain line about a test (for list rows). */
export const aboutOf = (name: string, category: string) => plainText(guideFor(name, category).about);

/** The small Guide button for a test row. */
export function GuideButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`Guide for ${label}`}
      className="press flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 text-[12px] font-semibold text-brand-700"
    >
      <BookOpen size={13} /> Guide
    </button>
  );
}

/** Guide state for a list: \`guide.open(item)\` and render \`guide.sheet\`. */
export function useGuide() {
  const [item, setItem] = useState<{ id: number; name: string; category: string; label?: string; price?: number | null } | null>(null);
  return {
    open: (i: { id: number; name: string; category: string; label?: string; price?: number | null }) => setItem(i),
    sheet: item ? <TestGuideSheet {...item} onClose={() => setItem(null)} /> : null,
  };
}

export function TestGuideSheet({ id, name, category, label, price, onClose }: { id: number; name: string; category: string; label?: string; price?: number | null; onClose: () => void }) {
  const written = useServiceInfo(id);
  // No dashes in visible text (owner): the same cleaning as the PR agent catalogue.
  const g = plainAll(mergeGuide(guideFor(name, category), written));
  const cm = meta(category);
  const own = serviceIconOf(id);
  const m = own ? { ...cm, ...resolveIcon(own, name, cm.sticker) } : cm;
  return (
    <Sheet title={name} subtitle={`Test guide · ${label ?? category}`} onClose={onClose} tall>
      <div className="px-1 pb-4">
        <div className={`relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br p-4 ${cm.tint}`}>
          <span className="absolute -bottom-1 right-1">
            <Art photo={m.photo} sticker={m.sticker} size={76} />
          </span>
          <p className="max-w-[72%] text-[12.5px] font-semibold text-ink-2">{label ?? category}</p>
          {price !== undefined && <p className="mt-0.5 text-[24px] font-extrabold leading-tight text-ink">{price === null ? 'No price on file' : formatMoney(price, 'NGN')}</p>}
          <p className="mt-1 max-w-[72%] text-[13.5px] leading-snug text-ink">{g.about}</p>
          {g.written && <span className="mt-2 inline-block rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-good-ink">Written in STANLEY</span>}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <span className="flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-line/70">
            <Droplet size={17} className="shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block text-[11px] text-muted">Sample or test</span>
              <b className="block text-[13px] leading-snug text-ink">{g.sample}</b>
            </span>
          </span>
          <span className="flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-line/70">
            <Clock3 size={17} className="shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block text-[11px] text-muted">Usual time</span>
              <b className="block text-[13px] leading-snug text-ink">{g.duration}</b>
            </span>
          </span>
        </div>
        <Part title="What it is used for">{g.usedFor}</Part>
        <Part title="How it is done">
          <ol className="relative ml-1 mt-1">
            {g.procedure.map((x, i) => (
              <li key={i} className="relative flex gap-3 pb-2.5 last:pb-0">
                {i < g.procedure.length - 1 && <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-16px)] w-[2px] bg-line" />}
                <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[11.5px] font-bold text-white">{i + 1}</span>
                <span className="pt-0.5 text-[13.5px] leading-snug text-ink">{x}</span>
              </li>
            ))}
          </ol>
        </Part>
        <Part title="How to prepare">{g.preparation}</Part>
        {g.keywords.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {g.keywords.map((k) => (
              <span key={k} className="rounded-full bg-page px-2.5 py-1 text-[12px] text-ink-2">
                {k}
              </span>
            ))}
          </div>
        )}
        <p className="text-[11.5px] leading-snug text-muted">{g.written ? 'Written in STANLEY; anything left empty uses the general guide.' : `General guidance written from ${GUIDE_SOURCES.join(', ')}.`} The requesting doctor and the branch confirm the details for each patient.</p>
      </div>
    </Sheet>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
      <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.05em] text-muted">{title}</p>
      <div className="text-[13.5px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}
