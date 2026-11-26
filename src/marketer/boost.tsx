/**
 * "Boost your target" guide (owner, 2026-11-27). A short prompt on Dashboard,
 * My hospitals and Analysis opens a slide-up that the system writes from the
 * marketer's own figures:
 *   • the pace they are at against the pace they need;
 *   • where the shortfall is coming from (hospitals down, agents who stopped,
 *     agents gone quiet, untapped agents, one hospital carrying everything,
 *     too few follow-ups);
 *   • what they are doing right, this week's plan, and who to call first;
 *   • how to approach a PR agent, step by step;
 *   • a field-marketing playbook drawn from referral and field-sales practice
 *     (physician liaison and imaging-referral guidance, territory planning,
 *     win-back, relationship building), adapted for PR agents.
 * Hospital-level money only.
 */
import { useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, Compass, Gauge, ListChecks, Search, ShieldAlert, Sparkles, Target, Users } from 'lucide-react';
import { Sheet } from '@/admin/ui';
import { Sticker } from '@/ui/kit';
import { approachFor, targetGuide } from './guide';
import { plural, type Mine } from './data';
import { AgentRow, GrowBar, NEEDS, useMk } from './ui';

/* ─────────────── where the shortfall comes from ─────────────── */

interface Cause {
  tone: 'high' | 'medium' | 'low';
  title: string;
  why: string;
  fix: string;
}
function diagnose(m: Mine, money: (n: number) => string): Cause[] {
  const p = m.my!;
  const out: Cause[] = [];
  const delta = (k: string) => (m.figs.get(k)?.revenue ?? 0) - (m.lastFigs.get(k)?.revenue ?? 0);
  const downs = m.mine.filter((h) => delta(h.key) < 0).sort((a, b) => delta(a.key) - delta(b.key));
  const lost = downs.reduce((s, h) => s - delta(h.key), 0);
  if (downs.length && lost > 0)
    out.push({
      tone: lost > p.target * 0.1 ? 'high' : 'medium',
      title: `${plural(downs.length, 'hospital')} sending less than last month`,
      why: `${downs.slice(0, 3).map((h) => `${h.key} (−${money(-delta(h.key))})`).join(', ')}. Together that is ${money(lost)} less.`,
      fix: `Visit ${downs[0]!.key} first and ask what changed: a lost doctor, a bad experience, a cheaper lab.`,
    });
  const stopped = m.myHealth.filter((a) => a.weeks[10]! > 0 && a.weeks[11] === 0);
  if (stopped.length) out.push({ tone: stopped.length >= 5 ? 'high' : 'medium', title: `${plural(stopped.length, 'agent')} sent patients last week but none this week`, why: 'They are still warm: the quickest amount to win back.', fix: 'Call them today. Ask if a patient had a problem, and say you are there to help.' });
  const slipping = m.myHealth.filter((a) => a.status === 'slipping');
  if (slipping.length) out.push({ tone: 'medium', title: `${plural(slipping.length, 'agent')} slipping`, why: 'Sending much less than the month before. Usually something changed: a result was late, a price surprised a patient, another lab visited.', fix: 'Visit, listen first, fix what they raise and tell them it is fixed.' });
  const quiet = m.myHealth.filter((a) => a.status === 'quiet' || a.status === 'inactive');
  if (quiet.length) out.push({ tone: quiet.length > m.myHealth.length * 0.3 ? 'high' : 'medium', title: `${plural(quiet.length, 'agent')} gone quiet or inactive`, why: `${Math.round((quiet.length / Math.max(1, m.myHealth.length)) * 100)}% of your PR agents sent nobody for over 15 days.`, fix: 'Message each one ("We miss your patients" is ready on their card), then visit the ones who used to send the most.' });
  const never = m.myHealth.filter((a) => a.status === 'never');
  if (never.length) out.push({ tone: 'low', title: `${plural(never.length, 'agent')} never referred`, why: 'Untapped: they are on your list but have not sent a patient in four months.', fix: 'Introduce the branch properly and send their first request together in the app.' });
  const total = m.mine.reduce((s, h) => s + (m.figs.get(h.key)?.revenue ?? 0), 0);
  const top = [...m.mine].sort((a, b) => (m.figs.get(b.key)?.revenue ?? 0) - (m.figs.get(a.key)?.revenue ?? 0))[0];
  const share = top && total ? (m.figs.get(top.key)?.revenue ?? 0) / total : 0;
  if (top && share > 0.5) out.push({ tone: 'medium', title: `${top.key} carries ${Math.round(share * 100)}% of your amount`, why: 'If that one hospital slows down, your whole month slows down.', fix: 'Grow two or three smaller hospitals this month so you do not depend on one.' });
  const empty = m.mine.filter((h) => !(m.figs.get(h.key)?.patients ?? 0));
  if (empty.length) out.push({ tone: 'low', title: `${plural(empty.length, 'hospital')} sent nobody this month`, why: `${empty.slice(0, 3).map((h) => h.key).join(', ')}${empty.length > 3 ? ' and others' : ''}.`, fix: 'Pick one this week: visit, meet a new doctor, and bring in a PR agent there.' });
  const weekFollow = m.checkUps.filter((c) => m.myAgentIds.has(c.agentId) && Date.now() - new Date(c.at).getTime() < 7 * 86_400_000).length;
  const due = m.myHealth.filter((a) => a.due).length;
  if (due && weekFollow < Math.min(10, due)) out.push({ tone: weekFollow ? 'medium' : 'high', title: weekFollow ? `Only ${plural(weekFollow, 'follow-up')} this week` : 'No follow-ups logged this week', why: `${plural(due, 'agent')} need a follow-up. Referrals follow the visits and calls.`, fix: 'Aim for at least 10 follow-ups a week, and log each one.' });
  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

/* ─────────────── the playbook ─────────────── */

const APPROACH_STEPS = [
  { t: 'Prepare', d: 'Before you go, look at their card: how many they sent before, when they last referred, what was said at the last follow-up.' },
  { t: 'Visit when you can', d: 'A short face-to-face visit beats a call. Go when the clinic is quiet, keep it to five minutes, and greet the nurses and front-desk staff too.' },
  { t: 'Ask and listen', d: 'Ask how their patients found the branch and if anything went wrong. Listen more than you talk: do not start with a pitch.' },
  { t: 'Fix it, then tell them', d: 'If a result was late or a price surprised a patient, raise it with the branch (Report centre) and go back to tell them it is sorted.' },
  { t: 'Make it easy', d: 'Show them how to send a request in the app and what the branch does well: fast results, opening hours, new tests.' },
  { t: 'Follow through', d: 'Do what you said you would, when you said. Log the follow-up and set the next date.' },
  { t: 'Say thank you', d: 'When patients arrive, thank them. A short message keeps good referrers sending.' },
];

const PLAYBOOK: { title: string; text: string }[] = [
  { title: 'Know who is not referring', text: 'The quickest growth comes from agents and hospitals that used to send patients and stopped, not from strangers. Check your list every Monday and start there.' },
  { title: 'Rank your hospitals A, B, C', text: 'A: your biggest senders and biggest potential, visit every week. B: steady, every two weeks. C: small or new, once a month. Spend your time where the amount is.' },
  { title: 'Plan your days by area', text: 'Group hospitals that are close to each other on the same day. Field marketers lose a lot of time on the road: less travel means more visits.' },
  { title: 'Keep a steady rhythm', text: 'Every agent should hear from you at least once a month, with something new to say: a new test, new hours, a quicker result time. Regular contact keeps the branch in mind.' },
  { title: 'Win back with questions, not a pitch', text: 'When someone stops, ask what changed and listen. Often it is one bad experience. Fix it, follow through, and they come back.' },
  { title: 'Win over the nurses and front desk', text: 'Doctors decide, but nurses and receptionists often point patients to a lab. Know them by name and visit them too.' },
  { title: 'Close the loop', text: 'After a referral, check the patient came and the doctor got the result. Good service is what earns the next referral.' },
  { title: 'Ask your best agents for introductions', text: 'Top referrers know other doctors who send patients out. A thank-you followed by "who else should I meet?" is the easiest new agent.' },
  { title: 'Do what you say', text: 'Reliability is rare and remembered. Small promises kept build trust faster than big ones.' },
  { title: 'Play the long game', text: 'Strong relationships take months. Consistency every week beats a big push at the end of the month.' },
  { title: 'Never offer money or gifts for referrals', text: 'Do not offer cash, gifts or discounts in exchange for patients. It breaks company rules and medical ethics, and it is not needed: service and relationships win.' },
];

/* ─────────────── the prompt ─────────────── */

/** Compact campaign card that opens the guide. */
export function BoostPrompt({ className = '' }: { className?: string }) {
  const { m } = useMk();
  const [open, setOpen] = useState(false);
  const g = targetGuide(m, (n) => m.money(n));
  const p = m.my;
  if (!g || !p) return null;
  const done = p.pct >= 1;
  const ratio = g.dailyNeeded ? g.dailyNow / g.dailyNeeded : 1;
  const title = done ? 'Target reached. Want to go further?' : g.onTrack ? 'On track. Want to finish stronger?' : 'Need a guide to boost your target?';
  const sub = done ? 'See what is working and keep the momentum.' : g.onTrack ? `You're ahead of the pace you need. See how to grow even faster.` : `You're at ${Math.round(ratio * 100)}% of the pace you need. See what's going wrong and what to do.`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`press relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-[22px] bg-linear-to-r p-3.5 text-left text-white shadow-[0_12px_28px_rgba(79,70,229,0.28)] ${done || g.onTrack ? 'from-[#0f7a43] via-[#16a35a] to-[#34c47c]' : 'from-[#3b2bb8] via-[#5b45e0] to-[#8b6cf6]'} ${className}`}>
        <span aria-hidden="true" className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10" />
        <span className="relative shrink-0">
          <Sticker name={done ? 'trophy' : 'rocket'} size={48} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/80">
            <Sparkles size={12} /> Target guide
          </span>
          <b className="block text-[15.5px] leading-tight">{title}</b>
          <span className="mt-0.5 block text-[12px] leading-snug text-white/85">{sub}</span>
        </span>
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#4f46e5]">
          <ArrowRight size={18} />
        </span>
      </button>
      {open && <BoostGuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─────────────── the guide ─────────────── */

function Block({ icon, title, tone = 'text-muted', children, defaultOpen = true }: { icon: ReactNode; title: string; tone?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-3 overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-2 px-4 py-3.5 text-left">
        <span className={`flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] ${tone}`}>
          {icon} {title}
        </span>
        <ChevronDown size={17} className={`ml-auto text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

const CAUSE_TONE = { high: 'bg-[#fdecec] text-[#b42318]', medium: 'bg-[#fff1de] text-[#b45309]', low: 'bg-brand-50 text-brand-700' } as const;
const CAUSE_TEXT = { high: 'Biggest', medium: 'Important', low: 'Worth a look' } as const;

export function BoostGuideSheet({ onClose }: { onClose: () => void }) {
  const { m, openFollow } = useMk();
  const money = (n: number) => m.money(n);
  const g = targetGuide(m, money);
  const p = m.my;
  if (!g || !p) return null;
  const causes = diagnose(m, money);
  const done = p.pct >= 1;
  const ratio = g.dailyNeeded ? Math.min(1.5, g.dailyNow / g.dailyNeeded) : 1;
  const need = m.myHealth.filter((a) => NEEDS.includes(a.status)).length;
  return (
    <Sheet
      back
      tall
      title="Your target guide"
      subtitle="Written from your own figures, this month"
      onClose={onClose}
      footer={
        <button type="button" onClick={() => (onClose(), openFollow())} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
          <Target size={17} /> Start following up ({need})
        </button>
      }
    >
      {/* Where they stand */}
      <div className={`relative mb-3 overflow-hidden rounded-[26px] bg-linear-to-br p-5 text-white shadow-[0_14px_32px_rgba(31,99,214,0.25)] ${done || g.onTrack ? 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]' : 'from-[#3b2bb8] via-[#5b45e0] to-[#8b6cf6]'}`}>
        <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <Sticker name={done ? 'trophy' : g.onTrack ? 'rocket' : 'target'} size={78} className="absolute -bottom-1 -right-1" />
        <p className="relative flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/80">
          <Gauge size={14} /> Where you stand
        </p>
        <p className="relative mt-1 w-[80%] text-[19px] font-bold leading-snug">{done ? `Target reached: ${money(p.revenue)} of ${money(p.target)}.` : g.onTrack ? 'You are on pace to hit the month.' : `You need to speed up to hit ${money(p.target)}.`}</p>
        <div className="relative mt-3 grid w-[82%] grid-cols-2 gap-2">
          <span className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
            <span className="block text-[10.5px] text-white/80">You make a day</span>
            <b className="block text-[16px]">{money(g.dailyNow)}</b>
          </span>
          <span className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
            <span className="block text-[10.5px] text-white/80">{done ? 'Over target' : 'You need a day'}</span>
            <b className="block text-[16px]">{done ? money(p.revenue - p.target) : money(g.dailyNeeded)}</b>
          </span>
        </div>
        {!done && (
          <div className="relative mt-3 w-[82%]">
            <GrowBar pct={ratio / 1.5} pace={1 / 1.5} tone="white" className="h-2.5 bg-white/20" />
            <p className="mt-1.5 text-[11.5px] text-white/85">{g.onTrack ? `${Math.round((ratio - 1) * 100)}% above the pace you need.` : `${Math.round(ratio * 100)}% of the pace you need · ${plural(g.daysLeft, 'day')} left.`}</p>
          </div>
        )}
      </div>
      <p className="mb-3 rounded-2xl bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800">
        <b>This week:</b> {money(p.week.revenue)} of {money(p.week.target)}. {p.week.revenue >= p.week.target ? 'Week target beaten.' : `About ${money(g.weekDailyNeeded)} a day for the ${plural(g.weekDaysLeft, 'day')} left.`}
      </p>

      <Block icon={<Search size={14} />} title="Where the problem is coming from" tone="text-[#b42318]">
        {causes.length ? (
          <div className="space-y-2">
            {causes.map((c) => (
              <div key={c.title} className="rounded-[18px] bg-page p-3">
                <div className="flex items-start gap-2">
                  <b className="min-w-0 flex-1 text-[14px] leading-snug text-ink">{c.title}</b>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${CAUSE_TONE[c.tone]}`}>{CAUSE_TEXT[c.tone]}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{c.why}</p>
                <p className="mt-1.5 flex gap-1.5 text-[12.5px] font-semibold leading-snug text-brand-700">
                  <ArrowRight size={14} className="mt-0.5 shrink-0" /> {c.fix}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted">Nothing is holding you back right now. Keep the rhythm.</p>
        )}
      </Block>

      {g.right.length > 0 && (
        <Block icon={<CheckCircle2 size={14} />} title="What you are doing right" tone="text-good-ink">
          <ul className="space-y-1.5">
            {g.right.map((t) => (
              <li key={t} className="rounded-xl bg-tint-green px-3 py-2 text-[13px] leading-snug text-[#14532d]">
                {t}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {g.plan.length > 0 && (
        <Block icon={<ListChecks size={14} />} title="Your plan this week" tone="text-[#a85a00]">
          <ol className="space-y-1.5">
            {g.plan.map((t, i) => (
              <li key={t} className="flex gap-2.5 rounded-xl bg-[#fff8ec] px-3 py-2 text-[13px] leading-snug text-ink">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-[#a85a00]">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {g.reachOut.length > 0 && (
        <Block icon={<Users size={14} />} title="Reach out to these first">
          <p className="mb-1.5 text-[12.5px] text-muted">They used to send the most and have slowed down or stopped.</p>
          <div className="-mx-1 rounded-[18px] bg-page p-1">
            {g.reachOut.map((a) => (
              <AgentRow key={a.agent.id} a={a} sub={`${a.hospital} · ${approachFor(a).headline}`} />
            ))}
          </div>
        </Block>
      )}

      <Block icon={<Compass size={14} />} title="How to approach a PR agent" tone="text-brand-700" defaultOpen={false}>
        <ol className="relative ml-1 border-l-2 border-brand-100 pl-5">
          {APPROACH_STEPS.map((s, i) => (
            <li key={s.t} className="relative pb-3 last:pb-0">
              <span className="absolute -left-[31px] top-0 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white ring-4 ring-white">{i + 1}</span>
              <b className="block text-[14px] text-ink">{s.t}</b>
              <span className="block text-[13px] leading-snug text-ink-2">{s.d}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block icon={<BookOpen size={14} />} title="The marketer's playbook" tone="text-violet" defaultOpen={false}>
        <p className="mb-2 text-[12.5px] text-muted">What works for people who grow referrals in the field, drawn from referral and field-sales practice.</p>
        <div className="space-y-2">
          {PLAYBOOK.map((x, i) => (
            <div key={x.title} className={`rounded-[18px] p-3 ${i === PLAYBOOK.length - 1 ? 'bg-[#fdecec]' : 'bg-page'}`}>
              <b className={`flex items-center gap-1.5 text-[14px] ${i === PLAYBOOK.length - 1 ? 'text-[#b42318]' : 'text-ink'}`}>
                {i === PLAYBOOK.length - 1 && <ShieldAlert size={15} />}
                {x.title}
              </b>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{x.text}</p>
            </div>
          ))}
        </div>
      </Block>
    </Sheet>
  );
}
