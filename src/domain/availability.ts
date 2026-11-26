/**
 * Branch and test availability (owner, 2026-11-26): so PR agents never send
 * a patient who arrives to a closed branch or to a test nobody can run.
 *
 *   Branch: opening hours (Mon to Sat, 7:30 to 20:00 by default), and the
 *   branch can override them now: "Open now" or "Closed now" until a time,
 *   with a note (power outage, public holiday ...).
 *   Test: each test either follows the opening hours, runs on a schedule
 *   (the specialist's days and hours, e.g. MRI Mon to Fri, 9:00 to 16:00),
 *   or is "Not available" until a time, with the reason (radiologist away,
 *   machine under repair). Specialist categories start on a weekday schedule.
 *
 * The branch (Manager or Front Desk) sets it from its dashboard and
 * Inventory; PR agents see it on the catalogue, the request, the calculator
 * and in the message to the patient ("Available from Monday 9:00").
 * Kept on this device until the cloud connection carries it.
 */
import { useSyncExternalStore } from 'react';

export interface Window {
  /** 0 Sunday to 6 Saturday. */
  days: number[];
  /** "07:30" */
  from: string;
  to: string;
}
export interface BranchOverride {
  state: 'open' | 'closed';
  /** ISO: until when the override lasts (none = until changed). */
  until?: string;
  note?: string;
  by?: string;
  at: string;
}
export type TestRule = { kind: 'hours' } | ({ kind: 'schedule' } & Window) | { kind: 'off'; until?: string; note?: string };
export interface TestSetting {
  rule: TestRule;
  by?: string;
  at: string;
}

interface Store {
  hours: Window;
  override?: BranchOverride;
  tests: Record<string, TestSetting>;
}

export const DEFAULT_HOURS: Window = { days: [1, 2, 3, 4, 5, 6], from: '07:30', to: '20:00' };
/** Categories run by a visiting specialist: weekdays, 9:00 to 16:00, until the branch says otherwise. */
const SPECIALIST: Record<string, Window> = {
  MRI: { days: [1, 2, 3, 4, 5], from: '09:00', to: '16:00' },
  'CT SCAN': { days: [1, 2, 3, 4, 5], from: '09:00', to: '16:00' },
  ECHO: { days: [1, 3, 5], from: '10:00', to: '15:00' },
  EEG: { days: [2, 4], from: '10:00', to: '14:00' },
  'HOLTER ECG': { days: [1, 2, 3, 4, 5], from: '09:00', to: '15:00' },
  PHARYNGOSCOPY: { days: [2, 4], from: '09:00', to: '13:00' },
  CARDIOLOGY: { days: [3], from: '10:00', to: '15:00' },
  'MEDICAL EXAMINATION': { days: [1, 2, 3, 4, 5], from: '09:00', to: '16:00' },
};

const KEY = 'stanley.availability.v1';
const listeners = new Set<() => void>();
let cache: Store = load();
function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null;
    return s ? { hours: s.hours ?? DEFAULT_HOURS, override: s.override, tests: s.tests ?? {} } : { hours: DEFAULT_HOURS, tests: {} };
  } catch {
    return { hours: DEFAULT_HOURS, tests: {} };
  }
}
function commit(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = load();
      listeners.forEach((l) => l());
    }
  });

/** Re-render when availability changes (and every minute, so "open now" stays right). */
export function useAvailability(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const t = window.setInterval(l, 60_000);
      return () => {
        listeners.delete(l);
        window.clearInterval(t);
      };
    },
    () => cache,
  );
}

export const setBranchHours = (hours: Window) => commit({ ...cache, hours });
export const setBranchOverride = (o: BranchOverride | null) => commit({ ...cache, override: o ?? undefined });
export function setTestSetting(id: string | number, rule: TestRule | null, by?: string) {
  const tests = { ...cache.tests };
  if (rule) tests[String(id)] = { rule, by, at: new Date().toISOString() };
  else delete tests[String(id)];
  commit({ ...cache, tests });
}

/* ─────────────── reading ─────────────── */

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** "07:30" → "7:30", "20:00" → "20:00" */
const hm = (hhmm: string) => hhmm.replace(/^0(\d)/, '$1');
export const daysText = (days: number[]) => {
  const d = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const run = d.every((x, i) => i === 0 || (d[i - 1]! + 1) % 7 === x);
  return d.length >= 3 && run ? `${SHORT[d[0]!]} to ${SHORT[d[d.length - 1]!]}` : d.map((x) => SHORT[x]).join(', ');
};
export const windowText = (w: Window) => `${daysText(w.days)}, ${hm(w.from)} to ${hm(w.to)}`;

const inWindow = (w: Window, at: Date) => w.days.includes(at.getDay()) && mins(`${at.getHours()}:${at.getMinutes()}`) >= mins(w.from) && mins(`${at.getHours()}:${at.getMinutes()}`) < mins(w.to);
/** The next time a window opens (within two weeks). */
function nextStart(w: Window, after: Date): Date | null {
  for (let d = 0; d < 15; d++) {
    const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + d);
    if (!w.days.includes(day.getDay())) continue;
    const [h, m] = w.from.split(':').map(Number);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0);
    if (start > after) return start;
  }
  return null;
}
/** "today 9:00", "tomorrow 7:30", "Monday 9:00" */
export function whenText(d: Date, now = new Date()) {
  const t = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  return days === 0 ? `today ${t}` : days === 1 ? `tomorrow ${t}` : `${DAY[d.getDay()]} ${t}`;
}

export interface Status {
  ok: boolean;
  /** Short badge text: "Open now", "Available now", "From Monday 9:00" */
  label: string;
  /** One line for the patient message and the card. */
  detail: string;
  next?: Date;
  note?: string;
}

export function branchStatus(s: Store = cache, now = new Date()): Status {
  const o = s.override;
  if (o && (!o.until || new Date(o.until) > now)) {
    if (o.state === 'closed') {
      const back = o.until ? new Date(o.until) : null;
      const reopen = back ? (inWindow(s.hours, back) ? back : nextStart(s.hours, back)) : null;
      return { ok: false, label: 'Closed now', detail: `The branch is closed${reopen ? `, back ${whenText(reopen, now)}` : ''}${o.note ? ` (${o.note})` : ''}.`, next: reopen ?? undefined, note: o.note };
    }
    return { ok: true, label: 'Open now', detail: `The branch is open now${o.until ? ` until ${whenText(new Date(o.until), now)}` : ''}.`, note: o.note };
  }
  if (inWindow(s.hours, now)) return { ok: true, label: 'Open now', detail: `Open now until ${hm(s.hours.to)}. Hours: ${windowText(s.hours)}.` };
  const next = nextStart(s.hours, now);
  return { ok: false, label: 'Closed now', detail: `Closed now${next ? `, opens ${whenText(next, now)}` : ''}. Hours: ${windowText(s.hours)}.`, next: next ?? undefined };
}

/** The rule for a test: its own setting, else the specialist schedule of its category, else opening hours. */
export function ruleOf(id: string | number, category: string, s: Store = cache): TestRule {
  const own = s.tests[String(id)];
  if (own) {
    if (own.rule.kind === 'off' && own.rule.until && new Date(own.rule.until) <= new Date()) return { kind: 'hours' };
    return own.rule;
  }
  const sp = SPECIALIST[category.toUpperCase()];
  return sp ? { kind: 'schedule', ...sp } : { kind: 'hours' };
}

export function testStatus(id: string | number, category: string, s: Store = cache, now = new Date()): Status {
  const branch = branchStatus(s, now);
  const rule = ruleOf(id, category, s);
  if (rule.kind === 'off') {
    const back = rule.until ? new Date(rule.until) : null;
    return { ok: false, label: back ? `Back ${whenText(back, now)}` : 'Not available', detail: `Not available now${back ? `, back ${whenText(back, now)}` : ''}${rule.note ? ` (${rule.note})` : ''}.`, next: back ?? undefined, note: rule.note };
  }
  const w = rule.kind === 'schedule' ? rule : s.hours;
  if (inWindow(w, now) && branch.ok) return { ok: true, label: 'Available now', detail: rule.kind === 'schedule' ? `Available now. Usually ${windowText(w)}.` : 'Available now, during opening hours.' };
  const after = branch.ok ? now : (branch.next ?? now);
  const next = inWindow(w, after) ? after : nextStart(w, after);
  return { ok: false, label: next ? `From ${whenText(next, now)}` : 'Not available', detail: `${rule.kind === 'schedule' ? `Done ${windowText(w)}` : `Done during opening hours, ${windowText(w)}`}${next ? `. Next: ${whenText(next, now)}` : ''}.`, next: next ?? undefined };
}
