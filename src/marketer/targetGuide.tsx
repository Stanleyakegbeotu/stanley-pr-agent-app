/**
 * Target guide on My hospitals (owner, 2026-11-26): the pace they are at
 * against the pace they need (month and week), what is going right, what is
 * holding them back, a short plan, and the PR agents to reach out to first,
 * each with a quick call, WhatsApp or chat. Written by the system from their
 * own figures.
 */
import { useState } from 'react';
import { CheckCircle2, ChevronDown, Compass, Gauge, ListChecks, TriangleAlert } from 'lucide-react';
import { targetGuide } from './guide';
import { approachFor } from './guide';
import { AgentRow, GrowBar, useMk } from './ui';

export function TargetGuideCard() {
  const { m, openFollow } = useMk();
  const [open, setOpen] = useState(true);
  const g = targetGuide(m, (n) => m.money(n));
  const p = m.my;
  if (!g || !p) return null;
  const money = (n: number) => m.money(n);
  const ratio = g.dailyNeeded ? Math.min(1.5, g.dailyNow / g.dailyNeeded) : 1;
  return (
    <section className="mb-1 mt-3 overflow-hidden rounded-[26px] bg-white shadow-[0_12px_30px_rgba(30,74,160,0.1)] ring-1 ring-line/70">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`relative flex w-full items-center gap-3 overflow-hidden bg-linear-to-br p-4 text-left text-white ${g.onTrack ? 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]' : 'from-[#9a3412] via-[#e0601a] to-[#f59e0b]'}`}>
        <span aria-hidden="true" className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          <Compass size={22} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/80">Your target guide</span>
          <b className="block text-[17px] leading-tight">{g.onTrack ? (p.pct >= 1 ? 'Target reached. Keep going!' : 'You are on track for the month') : 'You need to speed up to hit the month'}</b>
        </span>
        <ChevronDown size={20} className={`relative shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 p-4">
          {/* Pace: where they are against where they need to be. */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">
              <Gauge size={14} /> Your pace
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[18px] bg-page p-3">
                <p className="text-[11.5px] text-muted">You are making</p>
                <b className="block text-[18px] text-ink">{money(g.dailyNow)}</b>
                <span className="text-[11.5px] text-muted">a day this month</span>
              </div>
              <div className={`rounded-[18px] p-3 ${g.onTrack ? 'bg-tint-green' : 'bg-[#fff1de]'}`}>
                <p className="text-[11.5px] text-muted">To hit the month you need</p>
                <b className={`block text-[18px] ${g.onTrack ? 'text-good-ink' : 'text-[#b45309]'}`}>{p.pct >= 1 ? 'Done' : money(g.dailyNeeded)}</b>
                <span className="text-[11.5px] text-muted">{p.pct >= 1 ? 'target reached' : `a day for ${g.daysLeft} days`}</span>
              </div>
            </div>
            {p.pct < 1 && (
              <>
                <GrowBar pct={ratio / 1.5} pace={1 / 1.5} className="mt-2.5 h-2.5 bg-page" />
                <p className="mt-1.5 text-[12px] text-muted">{g.onTrack ? `You are ${Math.round((ratio - 1) * 100)}% above the pace you need.` : `You are at ${Math.round(ratio * 100)}% of the pace you need. The mark is the pace that reaches the target.`}</p>
              </>
            )}
            <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800">
              This week: {money(p.week.revenue)} of {money(p.week.target)}. {p.week.revenue >= p.week.target ? 'Week target beaten.' : `About ${money(g.weekDailyNeeded)} a day for the ${g.weekDaysLeft} day${g.weekDaysLeft === 1 ? '' : 's'} left.`}
            </p>
          </div>

          {g.right.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-good-ink">
                <CheckCircle2 size={14} /> What you are doing right
              </p>
              <ul className="space-y-1.5">
                {g.right.map((t) => (
                  <li key={t} className="rounded-xl bg-tint-green px-3 py-2 text-[13px] leading-snug text-[#14532d]">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g.wrong.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#b42318]">
                <TriangleAlert size={14} /> What is holding you back
              </p>
              <ul className="space-y-1.5">
                {g.wrong.map((t) => (
                  <li key={t} className="rounded-xl bg-[#fdf0f0] px-3 py-2 text-[13px] leading-snug text-[#7f1d1d]">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g.plan.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#a85a00]">
                <ListChecks size={14} /> Your plan
              </p>
              <ol className="space-y-1.5">
                {g.plan.map((t, i) => (
                  <li key={t} className="flex gap-2.5 rounded-xl bg-[#fff8ec] px-3 py-2 text-[13px] leading-snug text-ink">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-[#a85a00]">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {g.reachOut.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">Reach out to these agents first</p>
              <div className="-mx-1 rounded-[18px] bg-page p-1">
                {g.reachOut.map((a) => (
                  <AgentRow key={a.agent.id} a={a} sub={`${a.hospital} · ${approachFor(a).headline}`} />
                ))}
              </div>
              <button type="button" onClick={openFollow} className="press mt-2 w-full rounded-2xl bg-brand-600 py-3 text-[14.5px] font-semibold text-white">
                See everyone to follow up
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
