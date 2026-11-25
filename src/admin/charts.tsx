/**
 * Charts that move (owner, 2026-11-25): charts must not sit still. Each one
 * animates in the first time it scrolls into view (rings sweep round, lines
 * draw themselves, bars grow) and can be tapped to read its figures.
 *  • Donut: a ring of parts (income sources, payment methods, costs, ageing)
 *    with the total in the middle; tap a part or its legend row.
 *  • LineChart: smooth lines with a soft area under the first one; tap
 *    anywhere along it to read every series on that day.
 * Respects "reduce motion" (shown complete, no animation).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view (stays true). */
export function useSeen<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(reduced);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e!.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return { ref, seen };
}

/** A number that counts up when it comes into view. */
export function CountUp({ value, format, seen, ms = 900 }: { value: number; format: (n: number) => string; seen: boolean; ms?: number }) {
  const [n, setN] = useState(seen && reduced() ? value : 0);
  useEffect(() => {
    if (!seen) return;
    if (reduced()) return setN(value);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, ms]);
  return <>{format(n)}</>;
}

export interface Part {
  label: string;
  value: number;
  color: string;
  /** Short line under the label in the legend (e.g. "412 payments"). */
  sub?: string;
  onOpen?: () => void;
}

/** Ring chart with the total (or the tapped part) in the middle and a legend beside it. */
export function Donut({ parts, total: totalText, label, format, size = 156, thickness = 20, legend = 'side' }: { parts: Part[]; total: string; label: string; format: (n: number) => string; size?: number; thickness?: number; legend?: 'side' | 'below' }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [pick, setPick] = useState<number | null>(null);
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const r = (size - thickness) / 2 - 4;
  const C = 2 * Math.PI * r;
  const gap = parts.filter((p) => p.value > 0).length > 1 ? Math.min(6, C * 0.012) : 0;
  let acc = 0;
  const arcs = parts.map((p, i) => {
    const frac = sum > 0 ? Math.max(0, p.value) / sum : 0;
    const len = Math.max(0, frac * C - gap);
    const a = { i, len, offset: -acc, frac };
    acc += frac * C;
    return a;
  });
  const cur = pick != null ? parts[pick] : null;
  const ring = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={`-rotate-90 transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,0.8,0.24,1)] ${seen ? 'scale-100' : 'scale-[0.82] rotate-[-160deg]'}`} role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f8" strokeWidth={thickness} />
        {arcs.map((a) =>
          a.len > 0 ? (
            <circle
              key={a.i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={parts[a.i]!.color}
              strokeWidth={pick === a.i ? thickness + 7 : thickness}
              strokeLinecap="round"
              strokeDasharray={`${seen ? a.len : 0} ${C}`}
              strokeDashoffset={a.offset}
              opacity={pick != null && pick !== a.i ? 0.35 : 1}
              onClick={() => setPick(pick === a.i ? null : a.i)}
              style={{ transition: `stroke-dasharray 1000ms cubic-bezier(0.22,0.8,0.24,1) ${180 + a.i * 140}ms, stroke-width 200ms, opacity 200ms`, cursor: 'pointer' }}
            />
          ) : null,
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <span className="px-5">
          <span className="block text-[11px] font-medium leading-tight text-muted">{cur ? cur.label : label}</span>
          <b className="block text-[17px] leading-tight tracking-[-0.02em] text-ink">{cur ? format(cur.value) : totalText}</b>
          {cur && sum > 0 && <span className="block text-[11.5px] font-semibold" style={{ color: cur.color }}>{`${((Math.max(0, cur.value) / sum) * 100).toFixed(1)}%`}</span>}
        </span>
      </div>
    </div>
  );
  return (
    <div ref={ref} className={legend === 'side' ? 'flex items-center gap-4' : ''}>
      {legend === 'side' ? ring : <div className="mb-3 flex justify-center">{ring}</div>}
      <ul className="min-w-0 flex-1 space-y-1">
        {parts.map((p, i) => (
          <li key={p.label}>
            <button
              type="button"
              onClick={() => (pick === i && p.onOpen ? p.onOpen() : setPick(pick === i ? null : i))}
              className={`press flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${pick === i ? 'bg-page' : ''}`}
              style={{ transition: 'opacity 500ms, transform 500ms', transitionDelay: `${300 + i * 90}ms`, opacity: seen ? 1 : 0, transform: seen ? 'none' : 'translateX(10px)' }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{p.label}</span>
                <span className="line-clamp-2 block text-[11.5px] leading-snug text-muted">
                  {format(p.value)}
                  {sum > 0 ? ` · ${Math.round((Math.max(0, p.value) / sum) * 100)}%` : ''}
                  {p.sub ? ` · ${p.sub}` : ''}
                </span>
              </span>
              {pick === i && p.onOpen && (
                <span className="flex shrink-0 items-center text-[12px] font-semibold text-brand-600">
                  Open <ChevronRight size={14} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────── line chart ─────────────── */

/** Smooth path through the points (Catmull-Rom to Bezier). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0]![0]},${pts[0]![1]}` : '';
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function LineChart({ labels, series, format, height = 170, note }: { labels: string[]; series: { name: string; color: string; values: number[]; dashed?: boolean }[]; format: (n: number) => string; height?: number; note?: ReactNode }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [w, setW] = useState(320);
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;
  const pad = 6;
  const x = (i: number) => (n <= 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (v: number) => height - 4 - (Math.max(0, v) / max) * (height - 14);
  const paths = useMemo(() => series.map((s) => smooth(s.values.map((v, i) => [x(i), y(v)]))), [series, w, height, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = series[0];
  const area = first && n > 1 ? `${paths[0]} L${x(n - 1)},${height} L${x(0)},${height} Z` : '';
  const show = (i: number) => n <= 7 || i % Math.ceil(n / 6) === 0 || i === n - 1;
  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  const touch = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || n === 0) return;
    const i = Math.round(((clientX - box.left - pad) / Math.max(1, w - pad * 2)) * (n - 1));
    setPick(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div>
      <div ref={ref} className="relative select-none" style={{ height }} data-no-swipe onPointerDown={(e) => touch(e.clientX)} onPointerMove={(e) => e.buttons && touch(e.clientX)}>
        <svg width={w} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={first?.color ?? '#1f6fe8'} stopOpacity="0.28" />
              <stop offset="100%" stopColor={first?.color ?? '#1f6fe8'} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={w} y1={height * g} y2={height * g} stroke="#eef2f8" strokeDasharray="3 5" />
          ))}
          {area && <path d={area} fill={`url(#${gid})`} style={{ opacity: seen ? 1 : 0, transition: 'opacity 900ms ease 700ms' }} />}
          {series.map((s, k) => (
            <path
              key={s.name}
              d={paths[k]}
              fill="none"
              stroke={s.color}
              strokeWidth={k === 0 ? 2.6 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={s.dashed ? '5 5' : 1}
              strokeDashoffset={s.dashed ? undefined : seen ? 0 : 1}
              style={{ transition: `stroke-dashoffset 1400ms cubic-bezier(0.22,0.8,0.24,1) ${k * 220}ms, opacity 600ms ease ${k * 220 + 400}ms`, opacity: s.dashed && !seen ? 0 : 1 }}
              strokeOpacity={s.dashed ? 0.9 : 1}
            />
          ))}
          {pick != null && (
            <g>
              <line x1={x(pick)} x2={x(pick)} y1={0} y2={height} stroke="#9fb3cf" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.name} cx={x(pick)} cy={y(s.values[pick] ?? 0)} r={4.5} fill="#fff" stroke={s.color} strokeWidth={2.5} />
              ))}
            </g>
          )}
        </svg>
        {pick != null && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-2xl bg-ink/95 px-3 py-2 text-white shadow-lg" style={{ left: Math.min(Math.max(0, x(pick) - 80), w - 160), width: 160 }}>
            <p className="text-[11.5px] font-semibold text-white/80">{labels[pick]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <b>{format(s.values[pick] ?? 0)}</b>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex">
        {labels.map((l, i) => (
          <span key={l + i} className="flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap text-[9.5px] text-muted">
            {show(i) ? l : ''}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
        {note && <span className="text-[11.5px] text-muted">{note}</span>}
        {pick == null && <span className="ml-auto text-[11.5px] text-muted">Tap the chart to read a day</span>}
      </div>
    </div>
  );
}

/** A small line that draws itself (inside hero cards); white on colour by default. */
export function Spark({ values, color = '#ffffff', height = 46, fill = true }: { values: number[]; color?: string; height?: number; fill?: boolean }) {
  const { ref, seen } = useSeen<HTMLDivElement>(0.2);
  const [w, setW] = useState(160);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(60, e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const n = values.length;
  const max = Math.max(1, ...values);
  const pts: [number, number][] = values.map((v, i) => [n <= 1 ? w / 2 : (i * w) / (n - 1), height - 3 - (Math.max(0, v) / max) * (height - 8)]);
  const d = smooth(pts);
  const gid = useMemo(() => `s${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {n > 1 && (
        <svg width={w} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {fill && <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${gid})`} style={{ opacity: seen ? 1 : 0, transition: 'opacity 800ms ease 600ms' }} />}
          <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={seen ? 0 : 1} style={{ transition: 'stroke-dashoffset 1400ms cubic-bezier(0.22,0.8,0.24,1) 150ms' }} />
          <circle cx={pts[n - 1]![0]} cy={pts[n - 1]![1]} r={3.5} fill={color} style={{ opacity: seen ? 1 : 0, transition: 'opacity 300ms ease 1400ms' }} />
        </svg>
      )}
    </div>
  );
}
