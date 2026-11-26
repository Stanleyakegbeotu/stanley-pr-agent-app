/**
 * Weekly announcements for the marketer (owner, 2026-11-26): written by the
 * system from their own figures, never by a manager. A swipeable bar under
 * the weekly target says, in plain words, how the week is going against last
 * week (same days), whether they are going up or down, when they have beaten
 * a target, which hospital can do more and who to follow up. Tapping one
 * shows what changed: hospitals sending more or fewer patients, who to call,
 * and how to get more. Hospital-level money only.
 */
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Lightbulb, Sparkles } from 'lucide-react';
import { hospitalFigures, type HospitalFigures } from '@company/services/marketing';
import { resolveRange } from '@company/services/analytics';
import { formatCount } from '@company/shared/format';
import type { AgentHealth } from '@company/services/agentMonitor';
import { SlideCarousel, THEMES, type Slide } from '@/admin/kit';
import { Sheet } from '@/admin/ui';
import { first, plural, type Mine } from './data';
import { AgentRow, GrowBar, NEEDS, useMk } from './ui';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (s: string, days: number) => {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
};
const pctText = (n: number) => `${Math.abs(Math.round(n * 100))}%`;

interface Move {
  key: string;
  now: HospitalFigures;
  before: HospitalFigures;
  diff: number;
}
export type InsightKind = 'beat-week' | 'beat-month' | 'up' | 'down' | 'pace' | 'improve' | 'follow' | 'bonus';
interface Insight {
  kind: InsightKind;
  slide: Omit<Slide, 'actions'>;
  /** The hospital the slide is about, if any. */
  hospital?: string;
}

/** This week against the same days of last week, per hospital, plus what to do. */
export function useWeekReview(m: Mine) {
  return useMemo(() => {
    const p = m.my;
    if (!p || !m.mine.length) return null;
    const w = p.week;
    const keys = m.mine.map((h) => h.key);
    const nowR = resolveRange({ key: 'custom', from: w.from, to: w.to });
    const beforeR = resolveRange({ key: 'custom', from: shift(w.from, -7), to: shift(w.to, -7) });
    const fullBeforeR = resolveRange({ key: 'custom', from: shift(w.from, -7), to: shift(w.from, -1) });
    const nowF = hospitalFigures(m.branchId, nowR, m.agents);
    const beforeF = hospitalFigures(m.branchId, beforeR, m.agents);
    const fullBefore = keys.reduce((s, k) => s + (hospitalFigures(m.branchId, fullBeforeR, m.agents).get(k)?.revenue ?? 0), 0);
    const zero: HospitalFigures = { patients: 0, revenue: 0, referring: 0 };
    const moves: Move[] = keys.map((k) => {
      const now = nowF.get(k) ?? zero;
      const before = beforeF.get(k) ?? zero;
      return { key: k, now, before, diff: now.revenue - before.revenue };
    });
    const sum = (list: Move[], f: (x: Move) => number) => list.reduce((s, x) => s + f(x), 0);
    const now = { revenue: sum(moves, (x) => x.now.revenue), patients: sum(moves, (x) => x.now.patients) };
    const before = { revenue: sum(moves, (x) => x.before.revenue), patients: sum(moves, (x) => x.before.patients) };
    const change = before.revenue ? (now.revenue - before.revenue) / before.revenue : null;
    const up = moves.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff);
    const down = moves.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff);
    const due = m.myHealth.filter((a) => a.due);
    // Sent last week, nothing this week: the quickest win.
    const stopped = m.myHealth.filter((a) => a.weeks[10]! > 0 && a.weeks[11] === 0);
    const stars = m.myHealth.filter((a) => a.status === 'top' || a.status === 'rising');
    // The hospital with the most room to grow: most agents who need a follow-up, then the biggest drop.
    const needAt = (k: string) => m.myHealth.filter((a) => a.hospital === k && NEEDS.includes(a.status)).length;
    const improve = [...keys].sort((a, b) => needAt(b) - needAt(a) || (moves.find((x) => x.key === a)!.diff - moves.find((x) => x.key === b)!.diff))[0]!;
    const daysLeft = Math.max(0, 7 - Math.round((new Date(`${w.to}T12:00:00`).getTime() - new Date(`${w.from}T12:00:00`).getTime()) / 86_400_000) - 1);
    return { p, w, moves, now, before, change, fullBefore, up, down, due, stopped, stars, improve, needAt, daysLeft };
  }, [m]);
}
export type WeekReview = NonNullable<ReturnType<typeof useWeekReview>>;

function insightsFor(r: WeekReview, money: (n: number) => string, name: string): Insight[] {
  const out: Insight[] = [];
  const { p, w } = r;
  if (w.revenue >= w.target)
    out.push({
      kind: 'beat-week',
      slide: { id: 'beat-week', theme: THEMES.green, sticker: 'trophy', label: 'Weekly target · beaten', isNew: true, title: `Well done ${name}, you beat this week's target!`, text: `${money(w.revenue)} against ${money(w.target)}${w.revenue > w.target ? `, ${money(w.revenue - w.target)} over` : ''}. Keep the momentum.` },
    });
  if (p.pct >= 1)
    out.push({
      kind: 'beat-month',
      slide: { id: 'beat-month', theme: THEMES.violet, sticker: 'party', label: 'Monthly target · reached', isNew: true, title: 'Monthly target reached. Congratulations!', text: `${money(p.revenue)} against ${money(p.target)}. Everything from here is extra.` },
    });
  if (r.change !== null && r.change >= 0.05)
    out.push({
      kind: 'up',
      slide: { id: 'up', theme: THEMES.blue, sticker: 'rocket', label: 'This week · going up', title: `Up ${pctText(r.change)} on last week`, text: `${money(r.now.revenue)} so far, against ${money(r.before.revenue)} by this time last week.${r.up[0] ? ` ${r.up[0].key} is sending more.` : ''}` },
    });
  else if (r.change !== null && r.change <= -0.05)
    out.push({
      kind: 'down',
      slide: { id: 'down', theme: THEMES.red, sticker: 'bell', label: 'This week · going down', title: `Down ${pctText(r.change)} on last week`, text: `${money(r.now.revenue)} so far, against ${money(r.before.revenue)} by this time last week.${r.down[0] ? ` ${r.down[0].key} is sending fewer patients.` : ''}` },
    });
  if (w.revenue < w.target)
    out.push({
      kind: 'pace',
      slide: { id: 'pace', theme: THEMES.indigo, sticker: 'target', label: 'Weekly target', title: `${money(w.target - w.revenue)} to go this week`, text: r.daysLeft ? `${plural(r.daysLeft, 'day')} left: about ${money((w.target - w.revenue) / r.daysLeft)} a day gets you there. You're at ${pctText(w.pct)}.` : `Last day of the week. You're at ${pctText(w.pct)} of ${money(w.target)}.` },
    });
  if (r.needAt(r.improve) > 0)
    out.push({
      kind: 'improve',
      hospital: r.improve,
      slide: { id: 'improve', theme: THEMES.teal, sticker: 'hospital', label: 'Room to grow', title: `${r.improve} can send more`, text: `${plural(r.needAt(r.improve), 'PR agent')} there ${r.needAt(r.improve) === 1 ? 'needs' : 'need'} a follow-up. A visit this week could bring them back.` },
    });
  if (r.stopped.length || r.due.length)
    out.push({
      kind: 'follow',
      slide: { id: 'follow', theme: THEMES.orange, sticker: 'stethoscope', label: 'Follow up', title: r.stopped.length ? `${plural(r.stopped.length, 'agent')} sent patients last week, none yet this week` : `${plural(r.due.length, 'PR agent')} need you`, text: r.stopped.length ? `A quick call to ${r.stopped.slice(0, 2).map((a) => a.agent.name).join(' and ')}${r.stopped.length > 2 ? ' and others' : ''} is your fastest win.` : 'Slipping or gone quiet. Call, message or visit them.' },
    });
  // A bonus feeling (bonuses are not set up yet): only when they are ahead of pace or have beaten a target.
  if (p.pct < 1 && p.pace && p.pct >= p.pace)
    out.push({
      kind: 'bonus',
      slide: { id: 'bonus', theme: THEMES.green, sticker: 'gift', label: 'Bonus pace', title: 'You are ahead of pace this month', text: `${pctText(p.pct)} of your target with ${pctText(1 - p.pace)} of the month left. This is bonus-level work: keep it up.` },
    });
  return out;
}

/** The announcement bar on the marketer's Home. */
export function WeekAnnouncements() {
  const { m, me } = useMk();
  const r = useWeekReview(m);
  const [open, setOpen] = useState<Insight | null>(null);
  const { openLog } = useMk();
  if (!r) return null;
  const list = insightsFor(r, (n) => m.money(n), first(me.name));
  if (!list.length) return null;
  const slides: Slide[] = list.map((i) => ({
    ...i.slide,
    actions: [{ label: 'See what changed', onClick: () => setOpen(i) }, ...(i.kind === 'follow' || i.kind === 'down' || i.kind === 'improve' ? [{ label: 'Follow up', onClick: openLog }] : [])],
  }));
  return (
    <>
      <SlideCarousel slides={slides} label="Your week" />
      {open && <ReviewSheet r={r} insight={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/* ─────────────── what changed ─────────────── */

function ReviewSheet({ r, insight, onClose }: { r: WeekReview; insight: Insight; onClose: () => void }) {
  const { m, openLog, openHospital } = useMk();
  const money = (n: number) => m.money(n);
  const from = new Date(`${r.w.from}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const focusHosp = insight.hospital;
  const agentsFirst = insight.kind === 'follow' || insight.kind === 'improve';
  const gainsFirst = insight.kind !== 'down';
  const movers = gainsFirst ? [...r.up, ...r.down.slice().reverse()] : [...r.down, ...r.up];
  const people: AgentHealth[] = (focusHosp ? m.myHealth.filter((a) => a.hospital === focusHosp && NEEDS.includes(a.status)) : [...r.stopped, ...r.due.filter((a) => !r.stopped.includes(a))]).slice(0, 8);
  const tips = howToGetMore(r, money, focusHosp);

  const agentsBlock = (
    <>
      <p className="mb-2 mt-4 px-1 text-[13px] font-semibold text-ink-2">{focusHosp ? `Follow up at ${focusHosp}` : 'Who to follow up'}</p>
      <div className="rounded-[20px] bg-white p-1 ring-1 ring-line/70">{people.length ? people.map((a) => <AgentRow key={a.agent.id} a={a} />) : <p className="px-3 py-3 text-[13px] text-muted">No one needs a follow-up right now.</p>}</div>
    </>
  );
  return (
    <Sheet
      back
      tall
      title={insight.slide.title}
      subtitle={`Week from ${from} · against the same days last week`}
      onClose={onClose}
      footer={
        <button type="button" onClick={() => (onClose(), openLog())} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          <Sparkles size={17} /> Follow up now
        </button>
      }
    >
      {/* The week in numbers */}
      <div className={`mb-3 rounded-[22px] bg-linear-to-br p-4 text-white ${insight.slide.theme}`}>
        <p className="text-[12px] font-semibold text-white/85">{insight.slide.label}</p>
        <p className="mt-1 text-[13.5px] leading-snug text-white/95">{insight.slide.text}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { l: 'This week', v: money(r.now.revenue), s: plural(r.now.patients, 'patient') },
            { l: 'Same days last wk', v: money(r.before.revenue), s: plural(r.before.patients, 'patient') },
            { l: 'Change', v: r.change === null ? '—' : `${r.change >= 0 ? '+' : '−'}${pctText(r.change)}`, s: `${r.now.revenue >= r.before.revenue ? '+' : '−'}${money(Math.abs(r.now.revenue - r.before.revenue))}` },
          ].map((x) => (
            <span key={x.l} className="min-w-0 rounded-2xl bg-white/15 px-2.5 py-2 ring-1 ring-white/20">
              <span className="block text-[10.5px] leading-tight text-white/80">{x.l}</span>
              <b className="block truncate text-[15px]">{x.v}</b>
              <span className="block truncate text-[10.5px] text-white/75">{x.s}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="mb-1 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
        <div className="mb-1.5 flex justify-between text-[13px]">
          <b className="text-ink">Weekly target</b>
          <span className="font-semibold text-ink-2">
            {money(r.w.revenue)} / {money(r.w.target)}
          </span>
        </div>
        <GrowBar pct={r.w.pct} pace={r.w.pace} />
        <p className="mt-1.5 text-[12px] text-muted">
          Last full week: {money(r.fullBefore)} · {r.w.revenue >= r.w.target ? 'target beaten' : `${money(r.w.target - r.w.revenue)} to go`}
        </p>
      </div>

      {agentsFirst && agentsBlock}

      <p className="mb-2 mt-4 px-1 text-[13px] font-semibold text-ink-2">What changed at your hospitals</p>
      <div className="rounded-[20px] bg-white p-1.5 ring-1 ring-line/70">
        {movers.length ? (
          movers.slice(0, 8).map((x) => {
            const h = m.mine.find((y) => y.key === x.key)!;
            return (
              <button key={x.key} type="button" onClick={() => openHospital(h)} className={`press flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left ${x.key === focusHosp ? 'bg-brand-50' : ''}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${x.diff >= 0 ? 'bg-tint-green text-good-ink' : 'bg-[#fdecec] text-[#b42318]'}`}>{x.diff >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] text-ink">{x.key}</b>
                  <span className="block text-[12px] text-muted">
                    {formatCount(x.now.patients)} patients this week · {formatCount(x.before.patients)} last week
                  </span>
                </span>
                <span className="text-right">
                  <b className={`block text-[14px] ${x.diff >= 0 ? 'text-good-ink' : 'text-[#b42318]'}`}>
                    {x.diff >= 0 ? '+' : '−'}
                    {money(Math.abs(x.diff))}
                  </b>
                  <span className="text-[11px] text-muted">{money(x.now.revenue)}</span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-3 text-[13px] text-muted">No change from last week yet.</p>
        )}
      </div>

      {!agentsFirst && agentsBlock}

      <p className="mb-2 mt-4 px-1 text-[13px] font-semibold text-ink-2">How to get more</p>
      <div className="mb-3 space-y-2">
        {tips.map((t) => (
          <div key={t} className="flex gap-3 rounded-[18px] bg-[#fffaf0] p-3 ring-1 ring-[#fde7c2]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fff1d6] text-[#b45309]">
              <Lightbulb size={16} />
            </span>
            <p className="text-[13.5px] leading-snug text-ink">{t}</p>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** Plain, data-driven tips for the week. */
function howToGetMore(r: WeekReview, money: (n: number) => string, focus?: string): string[] {
  const tips: string[] = [];
  if (r.stopped.length) tips.push(`Call the ${plural(r.stopped.length, 'agent')} who sent patients last week but none this week. They are the easiest to win back.`);
  const worst = focus ?? r.down[0]?.key;
  if (worst) tips.push(`Visit ${worst}: ${plural(r.needAt(worst), 'PR agent')} there need a follow-up${r.down.find((x) => x.key === worst) ? `, and it is ${money(Math.abs(r.down.find((x) => x.key === worst)!.diff))} down on last week` : ''}.`);
  if (r.up[0]) tips.push(`${r.up[0].key} is growing: thank the agents there and ask who else they work with.`);
  if (r.stars.length) tips.push(`Your ${plural(r.stars.length, 'top or growing agent')} keep the numbers up. A thank-you message keeps them sending.`);
  const small = r.moves.filter((x) => x.now.patients === 0 && x.before.patients === 0).length;
  if (small) tips.push(`${plural(small, 'hospital')} sent nobody in the last two weeks. Bring in a new PR agent there.`);
  if (r.daysLeft && r.w.revenue < r.w.target) tips.push(`Aim for about ${money((r.w.target - r.w.revenue) / r.daysLeft)} a day for the rest of the week.`);
  return tips.slice(0, 5);
}
