/**
 * The marketer's coach (owner, 2026-11-26): plain advice the system writes
 * from their own figures. How to approach each PR agent (by how they are
 * referring), ready-to-send messages they can edit, and the target guide
 * (the pace they are at against the pace they need, what is going right or
 * wrong, and who to reach out to). Hospital-level money only.
 */
import type { AgentHealth, AgentStatus } from '@company/services/agentMonitor';
import { NEEDS } from './ui';
import type { Mine } from './data';

const firstName = (name: string) => {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  const title = /^(dr|nrs|nurse|mr|mrs|ms|prof)\.?$/i.test(parts[0] ?? '') ? parts.shift() : '';
  const n = parts[0] ?? '';
  const nice = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1).toLowerCase().replace(/\.$/, '')} ${nice}` : nice;
};

/** How to approach a PR agent, by how they have been referring. */
export function approachFor(a: AgentHealth): { headline: string; steps: string[] } {
  const d = a.daysSince;
  switch (a.status) {
    case 'slipping':
      return {
        headline: 'Find out what changed, before they drift away',
        steps: [`They sent ${a.prev28} patients in the 4 weeks before and only ${a.last28} in the last 4. Ask, kindly, if anything went wrong with a patient or a result.`, 'Visit if you can: a face-to-face visit wins more than a call.', 'Fix what they raise quickly, then tell them it is fixed.'],
      };
    case 'quiet':
      return {
        headline: 'Reconnect: they have gone quiet',
        steps: [`No referral for ${d} days. Call first, then visit this week.`, 'Ask if they are still at the hospital and if their patients are going elsewhere.', 'Remind them of what makes the branch easy: fast results, the request in the app.'],
      };
    case 'inactive':
      return {
        headline: 'Win them back',
        steps: [`Over ${d ?? 45} days without a referral. Treat it like a new introduction.`, 'Bring the price list and explain any new tests.', 'If they have left the hospital, tell your manager so the record can be updated.'],
      };
    case 'never':
      return {
        headline: 'Introduce the branch',
        steps: ['No referral yet. Visit, introduce yourself and the branch.', 'Show them how to send a request in the app; send the first one together if you can.', 'Follow up a week later.'],
      };
    case 'top':
      return { headline: 'Keep a top referrer close', steps: ['Thank them: a short message goes a long way.', 'Ask who else at the hospital sends patients out, and ask for an introduction.', 'Make sure their patients are looked after quickly.'] };
    case 'rising':
      return { headline: 'They are sending more. Encourage it', steps: ['Thank them for the recent patients.', 'Ask what made the difference, and keep doing it.', 'Check their patients were happy with the visit.'] };
    default:
      return { headline: 'Keep in touch', steps: ['A friendly check-in every couple of weeks keeps them sending.', 'Share anything new at the branch: new tests, opening hours.'] };
  }
}

export interface Template {
  id: string;
  label: string;
  text: string;
}
/** Messages the marketer can send as they are or edit (WhatsApp, the in-app chat, or copy). */
export function templatesFor(a: AgentHealth, me: string, branch: string): Template[] {
  const n = firstName(a.agent.name) || 'there';
  const sign = `\n\n${me}, ${branch} branch`;
  const all: Record<string, Template> = {
    checkin: { id: 'checkin', label: 'Checking in', text: `Good day ${n}, I hope you and the team at ${a.hospital} are well. Just checking in: is there anything you need from us this week?${sign}` },
    miss: { id: 'miss', label: 'We miss your patients', text: `Good day ${n}, we haven't received any of your patients in a while and wanted to make sure all is well. If anything didn't go right with a patient, please tell me and I will sort it out.${sign}` },
    visit: { id: 'visit', label: 'Can I visit?', text: `Good day ${n}, I'll be at ${a.hospital} this week. Can I stop by for five minutes? I'll bring our updated price list.${sign}` },
    thanks: { id: 'thanks', label: 'Thank you', text: `Good day ${n}, thank you for the patients you've been sending us. We really appreciate it. If any of them needs anything, I'm a message away.${sign}` },
    app: { id: 'app', label: 'Send a request in the app', text: `Good day ${n}, you can now send your patients' requests straight from the STANLEY app: the branch sees it at once and your patient is attended faster. I can show you how in two minutes.${sign}` },
  };
  const order: Record<AgentStatus, string[]> = {
    slipping: ['checkin', 'visit', 'miss'],
    quiet: ['miss', 'visit', 'checkin'],
    inactive: ['miss', 'visit', 'app'],
    never: ['app', 'visit', 'checkin'],
    top: ['thanks', 'checkin', 'visit'],
    rising: ['thanks', 'checkin', 'app'],
    steady: ['checkin', 'thanks', 'visit'],
  };
  return order[a.status].map((k) => all[k]!);
}

/* ─────────────── target guide ─────────────── */

export interface TargetGuide {
  /** Amount a day so far this month, and what is needed from today. */
  dailyNow: number;
  dailyNeeded: number;
  daysLeft: number;
  weekDailyNeeded: number;
  weekDaysLeft: number;
  onTrack: boolean;
  right: string[];
  wrong: string[];
  plan: string[];
  /** PR agents worth a call or visit first (most to win back). */
  reachOut: AgentHealth[];
}

export function targetGuide(m: Mine, money: (n: number) => string): TargetGuide | null {
  const p = m.my;
  if (!p || !m.mine.length) return null;
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysIn = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysIn - dayOfMonth + 1);
  const dailyNow = p.revenue / Math.max(1, dayOfMonth);
  const dailyNeeded = Math.max(0, (p.target - p.revenue) / daysLeft);
  const w = p.week;
  const weekDaysLeft = Math.max(1, 7 - ((today.getDay() + 6) % 7));
  const weekDailyNeeded = Math.max(0, (w.target - w.revenue) / weekDaysLeft);
  const onTrack = p.revenue >= p.target || dailyNow >= dailyNeeded;

  const ups = m.mine.filter((h) => (m.figs.get(h.key)?.revenue ?? 0) > (m.lastFigs.get(h.key)?.revenue ?? 0)).sort((a, b) => (m.figs.get(b.key)?.revenue ?? 0) - (m.lastFigs.get(b.key)?.revenue ?? 0) - ((m.figs.get(a.key)?.revenue ?? 0) - (m.lastFigs.get(a.key)?.revenue ?? 0)));
  const downs = m.mine.filter((h) => (m.figs.get(h.key)?.revenue ?? 0) < (m.lastFigs.get(h.key)?.revenue ?? 0)).sort((a, b) => (m.figs.get(a.key)?.revenue ?? 0) - (m.lastFigs.get(a.key)?.revenue ?? 0) - ((m.figs.get(b.key)?.revenue ?? 0) - (m.lastFigs.get(b.key)?.revenue ?? 0)));
  const stars = m.myHealth.filter((a) => a.status === 'top' || a.status === 'rising');
  const need = m.myHealth.filter((a) => NEEDS.includes(a.status));
  const quiet = m.myHealth.filter((a) => a.status === 'quiet');
  const never = m.myHealth.filter((a) => a.status === 'never');
  const stopped = m.myHealth.filter((a) => a.weeks[10]! > 0 && a.weeks[11] === 0);
  const followedThisWeek = m.checkUps.filter((c) => m.myAgentIds.has(c.agentId) && Date.now() - new Date(c.at).getTime() < 7 * 86_400_000).length;

  const right: string[] = [];
  if (p.revenue >= p.lastMonthSoFarRevenue) right.push(`You're ${money(p.revenue - p.lastMonthSoFarRevenue)} ahead of the same days last month.`);
  if (ups[0]) right.push(`${ups.slice(0, 2).map((h) => h.key).join(' and ')} ${ups.length > 1 ? 'are' : 'is'} up on last month.`);
  if (stars.length) right.push(`${stars.length} PR agent${stars.length === 1 ? ' is' : 's are'} top or growing. Keep them close.`);
  if (followedThisWeek) right.push(`${followedThisWeek} follow-up${followedThisWeek === 1 ? '' : 's'} logged this week.`);
  if (w.revenue >= w.target) right.push('This week’s target is already beaten.');

  const wrong: string[] = [];
  if (!onTrack) wrong.push(`At ${money(dailyNow)} a day you'll miss the month: you need ${money(dailyNeeded)} a day from today.`);
  if (p.revenue < p.lastMonthSoFarRevenue) wrong.push(`You're ${money(p.lastMonthSoFarRevenue - p.revenue)} behind the same days last month.`);
  if (downs[0]) wrong.push(`${downs.slice(0, 2).map((h) => h.key).join(' and ')} ${downs.length > 1 ? 'are' : 'is'} sending less than last month.`);
  if (quiet.length) wrong.push(`${quiet.length} PR agent${quiet.length === 1 ? ' has' : 's have'} gone quiet (15 to 45 days without a referral).`);
  if (!followedThisWeek && need.length) wrong.push('No follow-ups logged this week yet.');

  const plan: string[] = [];
  if (stopped.length) plan.push(`Today: call the ${stopped.length} agent${stopped.length === 1 ? '' : 's'} who sent patients last week but none this week.`);
  if (downs[0]) plan.push(`This week: visit ${downs[0].key} and ask what changed.`);
  if (quiet.length) plan.push(`Message the ${quiet.length} quiet agent${quiet.length === 1 ? '' : 's'}: the "We miss your patients" message is ready on each one.`);
  if (stars.length) plan.push(`Thank your ${stars.length} top and growing agent${stars.length === 1 ? '' : 's'}, and ask them for introductions.`);
  if (never.length) plan.push(`Introduce the branch to the ${never.length} agent${never.length === 1 ? '' : 's'} who have never referred.`);
  if (w.revenue < w.target) plan.push(`Aim for ${money(weekDailyNeeded)} a day to finish this week on target.`);

  // Reach out first to agents who used to send the most and have stopped or slipped.
  const reachOut = [...m.myHealth.filter((a) => a.due || stopped.includes(a))].sort((a, b) => b.prev28 + b.weeks[10]! * 3 - (a.prev28 + a.weeks[10]! * 3)).slice(0, 6);
  return { dailyNow, dailyNeeded, daysLeft, weekDailyNeeded, weekDaysLeft, onTrack, right, wrong, plan, reachOut };
}
