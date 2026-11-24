/**
 * Home sections.
 *  • Updates from your branch: a carousel under Quick Actions, one update at
 *    a time: a patient arrived, tests done, results ready, or not attended,
 *    and which tests were not done. No amounts and no reasons. These show
 *    patient names because they are inside the unlocked app; phone
 *    notifications never do (data/content NOTIFICATIONS).
 *  • Today's patients: every request sent today, with the same rules as
 *    My Patients; "No patients requested today" when there are none.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CheckCircle2, ChevronRight, DoorOpen, FileText, FlaskConical, Plus, Send, UserX, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { STATUS_LABEL, isToday, partialNote, statusOf, type Referral, type ReferralStatus } from '@/domain/referrals';
import { Button, SectionTitle } from '@/ui/kit';
import { PatientCard } from '@/screens/Referrals';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** When the branch last changed this request. */
const changedAt = (r: Referral): string | undefined => {
  const s = statusOf(r);
  if (s === 'ResultsReady') return r.resultsAt;
  if (s === 'TestsDone') return r.testsDoneAt;
  if (s === 'Arrived') return r.arrivedAt;
  if (s === 'NotAttended') return new Date(new Date(r.createdAt).getTime() + 14 * 86_400_000).toISOString();
  return undefined;
};

/* ─────────────── Updates from your branch (carousel) ─────────────── */

const DISMISSED_KEY = 'stanley.pr.updates.dismissed';
const AUTOPLAY_MS = 4500;
const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function BranchUpdates() {
  const { referrals, navigate } = useApp();
  const [gone, setGone] = useState(readDismissed);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [paused, setPaused] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const width = useRef(1);
  const moved = useRef(false);

  const since = Date.now() - 2 * 86_400_000; // the last 2 days
  const updates = referrals
    .map((r) => ({ r, s: statusOf(r), at: changedAt(r) }))
    .filter((u) => u.at && new Date(u.at).getTime() >= since)
    .map((u) => ({ ...u, key: `${u.r.id}:${u.s}` }))
    .filter((u) => !gone.includes(u.key))
    .sort((a, b) => b.at!.localeCompare(a.at!));
  const n = updates.length;
  const at = n ? Math.min(index, n - 1) : 0;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduce || n < 2) return;
    const t = window.setInterval(() => !document.hidden && setIndex((i) => (i + 1) % n), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [paused, n]);

  if (!n) return null;

  const dismiss = (key: string) => {
    const next = [...gone, key].slice(-200);
    setGone(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* this session only */
    }
  };
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
      if (drag < -limit) setIndex((at + 1) % n);
      else if (drag > limit) setIndex((at - 1 + n) % n);
    }
    start.current = null;
    setDrag(0);
    window.setTimeout(() => setPaused(false), 1500);
  };

  return (
    <section aria-roledescription="carousel" aria-label="Updates from your branch" className="mt-6">
      <SectionTitle title={`Updates from your branch (${n})`} action="See all" onAction={() => navigate('/referrals')} />
      <div className="overflow-hidden rounded-[22px]" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onMouseEnter={() => setPaused(true)} onMouseLeave={() => !start.current && setPaused(false)} style={{ touchAction: 'pan-y' }}>
        <div className="flex items-stretch" style={{ transform: `translateX(calc(${-at * 100}% + ${drag}px))`, transition: drag ? 'none' : 'transform 520ms cubic-bezier(.22,.8,.24,1)' }}>
          {updates.map(({ key, r, s, at: when }, i) => (
            <div key={key} className="w-full shrink-0" aria-hidden={i !== at} aria-roledescription="slide" aria-label={`Update ${i + 1} of ${n}`}>
              <Update r={r} s={s} when={when!} onOpen={() => !moved.current && navigate(s === 'ResultsReady' ? `/results/${r.id}` : `/referrals/${r.id}`)} onDismiss={() => dismiss(key)} />
            </div>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {updates.map(({ key }, i) => (
            <button key={key} type="button" onClick={() => setIndex(i)} aria-label={`Show update ${i + 1} of ${n}`} aria-current={i === at} className="grid h-6 place-items-center">
              <span className={`block h-2 rounded-full transition-all duration-300 ${i === at ? 'w-5 bg-brand-600' : 'w-2 bg-[#cfd8e6]'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const KIND: Partial<Record<ReferralStatus, { icon: React.ReactNode; card: string; tone: string; title: (n: string) => string; text: string }>> = {
  Arrived: { icon: <DoorOpen size={21} />, card: 'from-[#eaf3ff] to-white border-[#cfe0fb]', tone: 'bg-brand-600 text-white', title: (n) => `${n} arrived at the branch`, text: 'The patient is with the front desk.' },
  TestsDone: { icon: <FlaskConical size={21} />, card: 'from-[#f3eeff] to-white border-[#e2d8ff]', tone: 'bg-violet text-white', title: (n) => `${n}: tests done`, text: 'Results come after the specialist signs them off.' },
  ResultsReady: { icon: <CheckCircle2 size={22} />, card: 'from-[#ecfbf2] to-white border-[#c8ecd7]', tone: 'bg-good text-white', title: (n) => `Results ready for ${n}`, text: 'Tap to view the signed-off result.' },
  NotAttended: { icon: <UserX size={21} />, card: 'from-[#f4f6fa] to-white border-line', tone: 'bg-[#8a94a6] text-white', title: (n) => `${n} did not attend`, text: 'No visit within 14 days of the request.' },
};

function Update({ r, s, when, onOpen, onDismiss }: { r: Referral; s: ReferralStatus; when: string; onOpen: () => void; onDismiss: () => void }) {
  const k = KIND[s]!;
  const partial = partialNote(r);
  return (
    <div className={`relative flex h-full select-none flex-col rounded-[22px] border bg-linear-to-br p-4 pr-11 shadow-[0_10px_26px_rgba(30,74,160,0.10)] ${k.card}`}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-sm ${k.tone}`}>{k.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-snug text-ink">{k.title(r.patient.name)}</span>
          <span className="mt-1 block text-[13.5px] leading-snug text-ink-2">{k.text}</span>
          {partial && <span className="mt-2 block rounded-xl bg-[#fff6e5] px-2.5 py-2 text-[12.5px] leading-snug text-[#8a5a12]">{partial}</span>}
          <span className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted">
            <span>
              {r.id}, {isToday(when) ? `today ${timeOf(when)}` : `yesterday ${timeOf(when)}`}
            </span>
            <span className="flex items-center gap-0.5 font-semibold text-brand-600">
              {s === 'ResultsReady' ? <FileText size={13} /> : null} View <ChevronRight size={14} />
            </span>
          </span>
        </span>
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss update" className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full text-faint hover:bg-white">
        <X size={16} />
      </button>
    </div>
  );
}

/* ─────────────── Today's patients ─────────────── */

export function TodayPatients() {
  const { referrals, navigate } = useApp();
  const today = referrals.filter((r) => isToday(r.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="mt-6">
      <SectionTitle title="Today’s Patients" action={today.length ? 'See all' : undefined} onAction={() => navigate('/referrals')} />
      {today.length === 0 ? (
        <div className="card flex flex-col items-center px-5 py-7 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-tint-blue text-brand-600">
            <Send size={24} />
          </span>
          <p className="mt-3 text-[16px] font-bold text-ink">No patients requested today</p>
          <p className="mt-1 text-[13.5px] text-muted">Patients you request tests for today will show here with their status.</p>
          <div className="mt-4 w-full max-w-[240px]">
            <Button block onClick={() => navigate('/refer')}>
              <Plus size={18} /> New request
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {today.map((r) => (
            <li key={r.id}>
              <PatientCard r={r} onOpen={() => navigate(`/referrals/${r.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { STATUS_LABEL };
