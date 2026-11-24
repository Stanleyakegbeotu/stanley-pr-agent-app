/**
 * E-request rules (compliance rebuild, 2026-11-24), shared by every screen.
 *
 *  • Request IDs keep the dashboard's Billing format: BRANCH-R + 6 digits
 *    (ABJ-R000842), so the front desk can type them straight into Billing.
 *  • Status: Requested → Arrived → Tests done → Results ready, or Not
 *    attended (automatic 14 days after the request with no arrival).
 *  • The clinician sees the QUOTED price of what they requested (so they can
 *    tell the patient). There are no referrer payments of any kind: no
 *    commission, totals per referrer, final bills or cancellation reasons.
 *  • If some tests were not done, the app says which (no amounts, no reasons).
 *  • Retention: a request leaves the list 90 days after results are ready or
 *    after it became Not attended.
 *  • Own patients only: ownOnly() filters by the signed-in clinician, but the
 *    real control is on the server (see domain/api).
 */
import { BRANCH } from '@/config/org';
import { categoryInfo, serviceById, type Service } from '@/data/services';

export type ReferralStatus = 'Requested' | 'Arrived' | 'TestsDone' | 'ResultsReady' | 'NotAttended';
export type Urgency = 'Routine' | 'Urgent';

export interface Referral {
  id: string;
  /** The requesting clinician (only they may see this request). */
  clinicianId: string;
  patient: { name: string; phone: string; gender: 'Male' | 'Female' | ''; age: string };
  serviceIds: string[];
  /** ISO date-time the request was sent. */
  createdAt: string;
  urgency: Urgency;
  /** Clinical indication / reason for the tests (required for X-ray, CT, mammogram, fluoroscopy). */
  indication?: string;
  /** Optional note and voice note for the branch. */
  note?: string;
  voiceNote?: { duration: number };
  /** The clinician told the patient their details go to Silhouette (consent record). */
  patientNotice?: { version: string; at: string };
  /** Branch updates. */
  arrivedAt?: string;
  testsDoneAt?: string;
  resultsAt?: string;
  /** Tests actually done (when not all requested tests were done). */
  doneServiceIds?: string[];
  /** Saved on this phone (encrypted), waiting for the server. */
  queued?: boolean;
}

export const NOT_ATTENDED_DAYS = 14;
export const RETENTION_DAYS = 90;
const DAY = 86_400_000;

/** The status right now (Not attended is worked out from the date). */
export function statusOf(r: Referral, now = Date.now()): ReferralStatus {
  if (r.resultsAt) return 'ResultsReady';
  if (r.testsDoneAt) return 'TestsDone';
  if (r.arrivedAt) return 'Arrived';
  if (now - new Date(r.createdAt).getTime() > NOT_ATTENDED_DAYS * DAY) return 'NotAttended';
  return 'Requested';
}
export const STATUS_LABEL: Record<ReferralStatus, string> = { Requested: 'Requested', Arrived: 'Arrived', TestsDone: 'Tests done', ResultsReady: 'Results ready', NotAttended: 'Not attended' };
export const STATUS_NOTE: Record<ReferralStatus, string> = {
  Requested: 'Sent to the branch, the patient hasn’t arrived yet',
  Arrived: 'The patient arrived at the branch',
  TestsDone: 'Tests done, waiting for the specialist to sign off results',
  ResultsReady: 'Results are ready for you to view',
  NotAttended: `The patient didn’t attend within ${NOT_ATTENDED_DAYS} days`,
};
export const STAGES: ReferralStatus[] = ['Requested', 'Arrived', 'TestsDone', 'ResultsReady'];

/** When the request stops being shown (90 days after results or Not attended); null = still open. */
export function closedAt(r: Referral, now = Date.now()): number | null {
  const s = statusOf(r, now);
  if (s === 'ResultsReady') return new Date(r.resultsAt!).getTime();
  if (s === 'NotAttended') return new Date(r.createdAt).getTime() + NOT_ATTENDED_DAYS * DAY;
  return null;
}
export const isVisible = (r: Referral, now = Date.now()) => {
  const c = closedAt(r, now);
  return c == null || now - c <= RETENTION_DAYS * DAY;
};
/** Own patients only (the server enforces this; this is the app-side guard). */
export const ownOnly = (list: Referral[], clinicianId: string | undefined) => (clinicianId ? list.filter((r) => r.clinicianId === clinicianId) : []);

export const referralId = (n: number) => `${BRANCH.idCode}-R${String(n).padStart(6, '0')}`;
export const nextReferralNumber = (list: Referral[]) => Math.max(0, ...list.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1;

export const servicesOf = (r: Pick<Referral, 'serviceIds'>): Service[] => r.serviceIds.map(serviceById).filter(Boolean) as Service[];
/** The quoted price the patient will pay for what was requested (final price confirmed at the branch). */
export const quoteOf = (r: Pick<Referral, 'serviceIds'>) => servicesOf(r).reduce((s, x) => s + (x.price ?? 0), 0);

/** Requested tests that were not done (names only, no reasons). */
export function notDoneOf(r: Referral): Service[] {
  if (!r.doneServiceIds) return [];
  const done = new Set(r.doneServiceIds);
  return servicesOf(r).filter((s) => !done.has(s.id));
}
/** "Results ready for 2 of 3 tests, FBS not done" (or null when all were done). */
export function partialNote(r: Referral): string | null {
  const missing = notDoneOf(r);
  if (!missing.length) return null;
  const total = r.serviceIds.length;
  const s = statusOf(r);
  const what = s === 'ResultsReady' ? 'Results ready' : 'Tests done';
  return `${what} for ${total - missing.length} of ${total} tests, ${missing.map((x) => x.name).join(', ')} not done`;
}

/** Short label for lists: the test's name, or its categories when there are several ("X-Ray, MRI"). */
export const serviceSummary = (r: Pick<Referral, 'serviceIds'>) => {
  const s = servicesOf(r);
  if (!s.length) return 'No tests';
  if (s.length === 1) return s[0]!.name;
  return Array.from(new Set(s.map((x) => categoryInfo(x.category).label))).join(', ');
};

/**
 * Imaging with ionising radiation must be clinically justified (NNRA): a
 * reason is required for X-ray, CT, mammography and fluoroscopy tests.
 */
const RADIATION = /MAMMO|FLUORO|BARIUM|SWALLOW|MEAL|ENEMA|HSG|HYSTEROSALPINGO|IVU|UROGRA|URETHROGRA|FISTULOGRA|SINOGRA|MYELOGRA/i;
export const needsIndication = (serviceIds: string[]) => serviceIds.some((id) => {
  const s = serviceById(id);
  return !!s && (s.category === 'X-RAY' || s.category === 'CT SCAN' || RADIATION.test(s.name));
});

/* ─────────────── counts (never money) ─────────────── */

export const reachedArrival = (s: ReferralStatus) => s === 'Arrived' || s === 'TestsDone' || s === 'ResultsReady';
export function countsFor(list: Referral[], now = Date.now()) {
  const st = list.map((r) => statusOf(r, now));
  return { referred: list.length, attended: st.filter(reachedArrival).length, resultsReady: st.filter((s) => s === 'ResultsReady').length, notAttended: st.filter((s) => s === 'NotAttended').length };
}
export const inMonth = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
export const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
