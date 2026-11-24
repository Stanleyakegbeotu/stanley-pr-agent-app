/**
 * Referral rules — shared by every screen so the figures always agree.
 *
 *  • Referral IDs use the dashboard's Billing format: BRANCH-R + 6 digits
 *    (ABJ-R000842), so the front desk can type them straight into Billing.
 *  • Commission = the referred patient's FULL bill × the company rate
 *    (owner rule). Pending referrals show an ESTIMATE; it is confirmed once
 *    the patient's tests are completed and paid.
 *  • Status (owner, 2026-11-24): every referral starts as SUBMITTED (stored as
 *    'Pending'), then becomes Completed once billing is done at the branch, or
 *    Cancelled: before visiting, or at the branch (the patient came but
 *    decided not to do the tests). There is no "Arrived" status.
 *  • The branch may bill different tests than were referred (the patient drops
 *    or adds tests). Commission follows what was BILLED, and testChanges()
 *    tells the agent exactly what changed and by how much.
 */
import { BRANCH, RULES } from '@/config/org';
import { categoryInfo, serviceById, type Service } from '@/data/services';

export type ReferralStatus = 'Pending' | 'Completed' | 'Cancelled';

export interface Referral {
  id: string;
  patient: { name: string; phone: string; gender: 'Male' | 'Female' | ''; age: string };
  serviceIds: string[];
  status: ReferralStatus;
  /** ISO date-time the referral was sent. */
  createdAt: string;
  /** Commission paid out to the agent (payout date), if any. */
  paidAt?: string;
  /** Saved on this phone, waiting for the cloud database. */
  queued?: boolean;
  /** What the branch actually billed (set at billing). Absent = the referred tests. */
  billedServiceIds?: string[];
  /** When the status last changed at the branch (completed or cancelled). */
  updatedAt?: string;
  /** Where the patient cancelled: before visiting, or after coming to the branch. */
  cancelStage?: 'before-visit' | 'at-branch';
  /** Anything else the branch recorded about the cancellation. */
  cancelReason?: string;
  /** Optional note from the agent to the branch (owner, 2026-11-24). */
  note?: string;
  /** A voice note is attached (the recording itself is in domain/referralVoice). */
  voiceNote?: { duration: number };
}

/** What the agent sees for each status. */
export const STATUS_LABEL: Record<ReferralStatus, string> = { Pending: 'Submitted', Completed: 'Completed', Cancelled: 'Cancelled' };
/** One line explaining where the patient is. */
export const STATUS_NOTE: Record<ReferralStatus, string> = {
  Pending: 'Sent to the branch, billing not done yet',
  Completed: 'Completed at the branch, billing done',
  Cancelled: 'Cancelled by the patient',
};

/** Plain words for a cancellation: where it happened, plus any note from the branch. */
export function cancelSummary(r: Pick<Referral, 'cancelStage' | 'cancelReason'>) {
  const where = r.cancelStage === 'at-branch' ? 'The patient came to the branch but decided not to do the tests.' : 'The patient cancelled before visiting the branch and won’t be doing the tests.';
  return r.cancelReason ? `${where} ${r.cancelReason}` : where;
}
export const cancelTitle = (r: Pick<Referral, 'cancelStage'>) => (r.cancelStage === 'at-branch' ? 'Cancelled at the branch' : 'Cancelled before visiting');

type Billable = Pick<Referral, 'serviceIds'> & { billedServiceIds?: string[] };
/** The tests that count for the bill: what the branch billed, or what was referred. */
export const billedIds = (r: Billable) => r.billedServiceIds ?? r.serviceIds;

export const referralId = (n: number) => `${BRANCH.idCode}-R${String(n).padStart(6, '0')}`;
export const nextReferralNumber = (list: Referral[]) => Math.max(0, ...list.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1;

export const servicesOf = (r: Pick<Referral, 'serviceIds'>): Service[] => r.serviceIds.map(serviceById).filter(Boolean) as Service[];
/** Patient bill = the recorded prices of every service (a service with no price can't be referred). */
export const billOf = (r: Billable) => servicesOf({ serviceIds: billedIds(r) }).reduce((s, x) => s + (x.price ?? 0), 0);
export const commissionOf = (r: Billable, rate = RULES.commissionRate) => Math.round(billOf(r) * rate);

/** Tests the patient dropped or added at billing, and how that moved the commission. Null when nothing changed. */
export function testChanges(r: Billable) {
  if (!r.billedServiceIds) return null;
  const billed = new Set(r.billedServiceIds);
  const referred = new Set(r.serviceIds);
  const removed = servicesOf({ serviceIds: r.serviceIds.filter((id) => !billed.has(id)) });
  const added = servicesOf({ serviceIds: r.billedServiceIds.filter((id) => !referred.has(id)) });
  if (!removed.length && !added.length) return null;
  const delta = commissionOf(r) - commissionOf({ serviceIds: r.serviceIds });
  return { removed, added, delta };
}
/** Short service label for lists: the service's name, or its categories when there are several ("X-Ray, MRI"). */
export const serviceSummary = (r: Pick<Referral, 'serviceIds'>) => {
  const s = servicesOf(r);
  if (!s.length) return 'No services';
  if (s.length === 1) return s[0]!.name;
  return Array.from(new Set(s.map((x) => categoryInfo(x.category).label))).join(', ');
};

export const isEstimate = (r: Referral) => r.status === 'Pending';

/* ─────────────── periods ─────────────── */

export type Period = 'today' | 'week' | 'month';
export const PERIOD_LABEL: Record<Period, string> = { today: 'Today', week: 'This Week', month: 'This Month' };

export function periodStart(p: Period, now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (p === 'month') d.setDate(1);
  return d;
}
export const inPeriod = (iso: string, p: Period, now = new Date()) => {
  const t = new Date(iso).getTime();
  return t >= periodStart(p, now).getTime() && t <= now.getTime() + 60_000;
};

export interface PeriodStats {
  referred: number;
  completed: number;
  /** Commission of everything referred in the period that isn't cancelled. */
  estimated: number;
  /** Commission of completed referrals. */
  confirmed: number;
  paid: number;
  outstanding: number;
}

export function statsFor(list: Referral[], p: Period, now = new Date()): PeriodStats {
  const inP = list.filter((r) => inPeriod(r.createdAt, p, now) && r.status !== 'Cancelled');
  const completed = inP.filter((r) => r.status === 'Completed');
  const confirmed = completed.reduce((s, r) => s + commissionOf(r), 0);
  const paid = completed.filter((r) => r.paidAt && inPeriod(r.paidAt, p, now)).reduce((s, r) => s + commissionOf(r), 0);
  return {
    referred: inP.length,
    completed: completed.length,
    estimated: inP.reduce((s, r) => s + commissionOf(r), 0),
    confirmed,
    paid,
    outstanding: confirmed - paid,
  };
}
