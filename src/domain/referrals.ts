/**
 * Referral rules — shared by every screen so the figures always agree.
 *
 *  • Referral IDs use the dashboard's Billing format: BRANCH-R + 6 digits
 *    (ABJ-R000842), so the front desk can type them straight into Billing.
 *  • Commission = the referred patient's FULL bill × the company rate
 *    (owner rule). Pending referrals show an ESTIMATE; it is confirmed once
 *    the patient's tests are completed and paid.
 */
import { BRANCH, RULES } from '@/config/org';
import { categoryInfo, serviceById, type Service } from '@/data/services';

export type ReferralStatus = 'Pending' | 'Arrived' | 'Completed' | 'Cancelled';

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
}

export const referralId = (n: number) => `${BRANCH.idCode}-R${String(n).padStart(6, '0')}`;
export const nextReferralNumber = (list: Referral[]) => Math.max(0, ...list.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1;

export const servicesOf = (r: Pick<Referral, 'serviceIds'>): Service[] => r.serviceIds.map(serviceById).filter(Boolean) as Service[];
/** Patient bill = the recorded prices of every service (a service with no price can't be referred). */
export const billOf = (r: Pick<Referral, 'serviceIds'>) => servicesOf(r).reduce((s, x) => s + (x.price ?? 0), 0);
export const commissionOf = (r: Pick<Referral, 'serviceIds'>, rate = RULES.commissionRate) => Math.round(billOf(r) * rate);
/** Short service label for lists: the service's name, or its categories when there are several ("X-Ray, MRI"). */
export const serviceSummary = (r: Pick<Referral, 'serviceIds'>) => {
  const s = servicesOf(r);
  if (!s.length) return '—';
  if (s.length === 1) return s[0]!.name;
  return Array.from(new Set(s.map((x) => categoryInfo(x.category).label))).join(', ');
};

export const isEstimate = (r: Referral) => r.status === 'Pending' || r.status === 'Arrived';

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
  arrived: number;
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
    arrived: inP.filter((r) => r.status === 'Arrived' || r.status === 'Completed').length,
    completed: completed.length,
    estimated: inP.reduce((s, r) => s + commissionOf(r), 0),
    confirmed,
    paid,
    outstanding: confirmed - paid,
  };
}
