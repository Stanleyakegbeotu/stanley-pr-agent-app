/**
 * Announcement carousel (dashboard). Slides move by themselves every 5 s,
 * follow the finger when swiped, and the dots jump to a slide. Autoplay
 * pauses while touched/hovered, when the app is in the background, and for
 * people who turned on "reduce motion".
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { ANNOUNCEMENTS, type Announcement } from '@/data/content';
import { useApp } from '@/app/store';
import { Sticker } from '@/ui/kit';

const THEME: Record<Announcement['theme'], string> = {
  blue: 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]',
  indigo: 'from-[#3346c9] via-[#4f63e6] to-[#8796f7]',
  teal: 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]',
  violet: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]',
};

const AUTOPLAY_MS = 5000;

export function AnnouncementCarousel() {
  const { navigate } = useApp();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [paused, setPaused] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const width = useRef(1);
  const moved = useRef(false);
  const n = ANNOUNCEMENTS.length;

  // Autoplay.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduce) return;
    const t = window.setInterval(() => !document.hidden && setIndex((i) => (i + 1) % n), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [paused, n]);

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
      const fast = Date.now() - start.current.t < 300;
      const limit = fast ? 25 : width.current * 0.22;
      if (drag < -limit) setIndex((i) => (i + 1) % n);
      else if (drag > limit) setIndex((i) => (i - 1 + n) % n);
    }
    start.current = null;
    setDrag(0);
    window.setTimeout(() => setPaused(false), 1500);
  };

  return (
    <section aria-roledescription="carousel" aria-label="Announcements" className="mb-6">
      <div className="overflow-hidden rounded-[24px] shadow-[0_14px_34px_rgba(31,99,214,0.22)]" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onMouseEnter={() => setPaused(true)} onMouseLeave={() => !start.current && setPaused(false)} style={{ touchAction: 'pan-y' }}>
        <div className="flex" style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))`, transition: drag ? 'none' : 'transform 520ms cubic-bezier(.22,.8,.24,1)' }}>
          {ANNOUNCEMENTS.map((a, i) => (
            <Slide
              key={a.id}
              a={a}
              hidden={i !== index}
              onOpen={() => {
                if (!moved.current) navigate(a.to);
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {ANNOUNCEMENTS.map((a, i) => (
          <button key={a.id} type="button" onClick={() => setIndex(i)} aria-label={`Announcement ${i + 1} of ${n}`} aria-current={i === index} className="grid h-6 place-items-center">
            <span className={`block h-2 rounded-full transition-all duration-300 ${i === index ? 'w-2 bg-brand-600 ring-4 ring-brand-100' : 'w-2 bg-[#cfd8e6]'}`} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Slide({ a, hidden, onOpen }: { a: Announcement; hidden: boolean; onOpen: () => void }) {
  return (
    <article aria-hidden={hidden} className={`relative isolate h-[214px] w-full shrink-0 select-none overflow-hidden bg-linear-to-r text-white ${THEME[a.theme]}`}>
      {/* Soft light shapes in the background. */}
      <span aria-hidden="true" className="absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-white/10" />
      <span aria-hidden="true" className="absolute -bottom-24 right-24 -z-10 h-56 w-56 rounded-full bg-white/[0.07]" />

      <div className="relative z-10 flex h-full w-[58%] flex-col justify-center py-4 pl-5">
        <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white/95">
          <Sticker name="megaphone" size={26} className="-rotate-12" />
          {a.kicker}
        </p>
        <h3 className="whitespace-pre-line text-[22px] font-bold leading-[1.12] tracking-[-0.02em]">{a.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/90">{a.text}</p>
        <button type="button" tabIndex={hidden ? -1 : 0} onClick={onOpen} className="press mt-3.5 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-[14.5px] font-semibold text-brand-700 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
          {a.cta} <ArrowRight size={17} strokeWidth={2.4} />
        </button>
      </div>

      {/* Illustration: rising chart + 3D sticker + figure badge. */}
      <div aria-hidden="true" className="absolute bottom-0 right-0 h-full w-[42%]">
        {a.chart && (
          <div className="absolute bottom-0 left-1 flex items-end gap-1.5 opacity-90">
            {[34, 52, 70, 92].map((h, i) => (
              <span key={i} className="w-4 rounded-t-md bg-linear-to-t from-[#1b65d8] to-[#7cc0ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]" style={{ height: h }} />
            ))}
            <TrendingUp className="absolute -top-9 left-12 text-[#34d07f] drop-shadow" size={36} strokeWidth={3} />
          </div>
        )}
        <Sticker name={a.sticker} size={138} className="absolute -bottom-2 -right-4" />
        {a.badge && <span className="absolute left-[6%] top-[30%] rounded-full border-[3px] border-white bg-[#16a34a] px-2.5 py-0.5 text-[19px] font-extrabold tracking-tight text-white shadow-[0_8px_18px_rgba(0,0,0,0.2)]">{a.badge}</span>}
      </div>
    </article>
  );
}
