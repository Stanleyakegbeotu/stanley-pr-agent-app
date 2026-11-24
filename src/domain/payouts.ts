/**
 * Monthly commission statements and payment issues (owner, 2026-11-24).
 *  • Commission is paid once a month. Each month shows what was earned
 *    (billing completed at the branch that month) and whether it is Paid,
 *    Not paid yet, or still being earned (this month).
 *  • When a month is paid, the agent gets a notification.
 *  • The agent can report a payment issue on a month (e.g. not received in
 *    the bank). It then shows "Under investigation" with a reference.
 *    Reports are saved on this phone and reach the finance team once the
 *    cloud connection is on.
 */
import { useSyncExternalStore } from 'react';
import { commissionOf, type Referral } from './referrals';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthName = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`;
/** When commission was earned: when the branch completed billing. */
export const earnedAt = (r: Referral) => new Date(r.updatedAt ?? r.createdAt);

export type StatementState = 'paid' | 'due' | 'open';
export interface Statement {
  month: string;
  amount: number;
  patients: Referral[];
  state: StatementState;
  paidAt?: string;
  /** When this month's commission is paid (1st of the next month). */
  payday: Date;
}

/** One statement per month that earned commission, newest first. */
export function monthStatements(referrals: Referral[], now = new Date()): Statement[] {
  const byMonth = new Map<string, Referral[]>();
  for (const r of referrals) {
    if (r.status !== 'Completed') continue;
    const k = monthKey(earnedAt(r));
    byMonth.set(k, [...(byMonth.get(k) ?? []), r]);
  }
  const current = monthKey(now);
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, patients]) => {
      const paid = patients.every((r) => r.paidAt);
      const paidAt = paid ? patients.map((r) => r.paidAt!).sort().pop() : undefined;
      const [y, m] = month.split('-').map(Number) as [number, number];
      return {
        month,
        amount: patients.reduce((s, r) => s + commissionOf(r), 0),
        patients: patients.sort((a, b) => earnedAt(b).getTime() - earnedAt(a).getTime()),
        state: paid ? 'paid' : month === current ? 'open' : 'due',
        paidAt,
        payday: new Date(y, m, 1, 10),
      } satisfies Statement;
    });
}

/* ─────────────── payment issues ─────────────── */

export const ISSUE_REASONS = ['I haven’t received it in my bank account', 'The amount paid is wrong', 'It was paid into the wrong account', 'This month hasn’t been paid yet', 'Something else'];

export interface PaymentIssue {
  ref: string;
  month: string;
  reason: string;
  details?: string;
  at: string;
  status: 'Under investigation' | 'Resolved';
}

const KEY = 'stanley.pr.payment.issues';
const listeners = new Set<() => void>();
let cache: Record<string, PaymentIssue> | null = null;
const read = () => {
  if (!cache)
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, PaymentIssue>;
    } catch {
      cache = {};
    }
  return cache;
};

export function reportIssue(month: string, reason: string, details?: string): PaymentIssue {
  const all = read();
  const issue: PaymentIssue = { ref: `PAY-${month.replace('-', '')}-${String(Object.keys(all).length + 1).padStart(3, '0')}`, month, reason, details: details?.trim() || undefined, at: new Date().toISOString(), status: 'Under investigation' };
  cache = { ...all, [month]: issue };
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
  return issue;
}

export function usePaymentIssues() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    read,
  );
}
