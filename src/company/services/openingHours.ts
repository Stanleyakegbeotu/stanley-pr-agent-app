// GENERATED from the STANLEY desktop app (src/services/openingHours.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Branch opening hours and map link (owner, 2026-11-26).
 *
 * The Company Admin and the Branch Manager set them in the branch settings
 * (desktop and mobile). The PR agents' message to a patient carries them:
 * the opening hours, and the Google Maps link so the patient taps it and
 * sees exactly where the branch is.
 *
 * Hours: open 24 hours, 7 days a week; or per day (closed, open 24 hours, or
 * from a time to a time; a closing time before the opening time runs past
 * midnight).
 */

export interface DayHours {
  open: boolean;
  /** Open the whole day (24 hours). */
  allDay: boolean;
  /** "07:30" */
  from: string;
  to: string;
}
export interface WeekHours {
  /** Open 24 hours, 7 days a week. */
  always: boolean;
  /** Index 0 Sunday to 6 Saturday. */
  days: DayHours[];
}

const day = (open: boolean, from = "07:30", to = "20:00"): DayHours => ({ open, allDay: false, from, to });
/** Monday to Saturday, 7:30 to 20:00; closed on Sunday (until the branch sets its own). */
export const DEFAULT_WEEK: WeekHours = { always: false, days: [day(false), day(true), day(true), day(true), day(true), day(true), day(true)] };

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first, as people read a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** "07:30" → "7:30" */
export const hm = (hhmm: string) => hhmm.replace(/^0(\d)/, "$1");

const dayText = (d: DayHours) => (!d.open ? "closed" : d.allDay ? "24 hours" : `${hm(d.from)} to ${hm(d.to)}`);

/** "Open 24 hours, 7 days a week" or "Mon to Fri 7:30 to 20:00, Sat 8:00 to 14:00, Sun closed". */
export function weekText(w: WeekHours): string {
  if (w.always) return "Open 24 hours, 7 days a week";
  const groups: { days: number[]; text: string }[] = [];
  for (const i of WEEK_ORDER) {
    const t = dayText(w.days[i] ?? day(false));
    const last = groups[groups.length - 1];
    if (last && last.text === t) last.days.push(i);
    else groups.push({ days: [i], text: t });
  }
  if (groups.length === 1) return groups[0]!.text === "24 hours" ? "Open 24 hours, 7 days a week" : groups[0]!.text === "closed" ? "Closed" : `Every day ${groups[0]!.text}`;
  return groups
    .map((g) => {
      const name = g.days.length === 1 ? SHORT[g.days[0]!] : g.days.length === 2 ? `${SHORT[g.days[0]!]}, ${SHORT[g.days[1]!]}` : `${SHORT[g.days[0]!]} to ${SHORT[g.days[g.days.length - 1]!]}`;
      return `${name} ${g.text}`;
    })
    .join(", ");
}

/** Is the branch open at this moment? (Includes hours running past midnight from the day before.) */
export function isOpenAt(w: WeekHours, at: Date): boolean {
  if (w.always) return true;
  const t = at.getHours() * 60 + at.getMinutes();
  const today = w.days[at.getDay()];
  if (today?.open) {
    if (today.allDay) return true;
    const f = mins(today.from);
    const e = mins(today.to);
    if (e > f ? t >= f && t < e : t >= f) return true;
  }
  const y = w.days[(at.getDay() + 6) % 7];
  if (y?.open && !y.allDay && mins(y.to) <= mins(y.from) && t < mins(y.to)) return true;
  return false;
}

/** When it closes next, if open now (null for 24/7). */
export function closesAt(w: WeekHours, at: Date): Date | null {
  if (w.always || !isOpenAt(w, at)) return null;
  for (let step = 1; step <= 8 * 24 * 4; step++) {
    const d = new Date(at.getTime() + step * 15 * 60_000);
    d.setSeconds(0, 0);
    if (!isOpenAt(w, d)) {
      // back to the exact minute
      for (let m = 15; m > 0; m--) {
        const e = new Date(d.getTime() - m * 60_000);
        if (!isOpenAt(w, e)) return e;
      }
      return d;
    }
  }
  return null;
}

/** The next time it opens after this moment (within two weeks). */
export function nextOpen(w: WeekHours, after: Date): Date | null {
  if (w.always) return after;
  for (let d = 0; d < 15; d++) {
    const date = new Date(after.getFullYear(), after.getMonth(), after.getDate() + d);
    const h = w.days[date.getDay()];
    if (!h?.open) continue;
    const [hh, mm] = (h.allDay ? "00:00" : h.from).split(":").map(Number);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh ?? 0, mm ?? 0);
    if (start > after) return start;
  }
  return null;
}

/** A week with at least one open day, and each open day's times filled in. */
export function weekProblem(w: WeekHours): string | null {
  if (w.always) return null;
  if (!w.days.some((d) => d.open)) return "Choose at least one open day, or Open 24 hours, 7 days a week.";
  const bad = w.days.findIndex((d) => d.open && !d.allDay && (!d.from || !d.to || d.from === d.to));
  return bad >= 0 ? `${DAY_NAMES[bad]}: choose an opening and a closing time.` : null;
}

/** A Google Maps link the patient can tap (maps.app.goo.gl, goo.gl/maps, google.com/maps, maps.google.com). */
export const MAP_LINK_RE = /^https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\S*$/i;
export function mapLinkProblem(link: string): string | null {
  const v = link.trim();
  if (!v) return "Paste the branch's Google Maps link. PR agents send it to patients.";
  return MAP_LINK_RE.test(v) ? null : "That isn't a Google Maps link. In Google Maps, open the branch, tap Share, then Copy link.";
}
