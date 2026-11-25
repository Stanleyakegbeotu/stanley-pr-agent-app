/**
 * Why a patient still owes, and when they promised to pay (owner, 2026-11-25).
 * Desktop rule: a bill saved with a part payment or nothing paid needs a
 * reason, who approved it, and optionally the date the patient promised to
 * pay (billing balanceInfo). Bills saved in STANLEY show exactly that.
 * The demonstration visits carry no such notes, so each gets a stable sample
 * (same visit, same note) in the same words staff use, marked as a sample,
 * until real bills replace the demonstration activity.
 */
import { useMemo } from 'react';
import { useBilling } from '@company/services/billing';
import type { PatientVisit } from '@company/data/demo/dailyLines';
import { useTeam, type Who } from './people';

export interface BalanceNote {
  reason: string;
  approvedBy: Who | null;
  /** Promised payment date (null when none was given). */
  promise: Date | null;
  /** Days past the promised date while still owing (0 when not overdue). */
  overdueDays: number;
  /** True for the demonstration visits (no note was recorded). */
  sample: boolean;
}

const PART = ['Will pay the balance on result collection', 'Paid part now; the rest by transfer after salary', 'Family bringing the rest of the money', 'Waiting for HMO approval for the balance', 'Paid what they had; will complete on the next visit'];
const NONE = ['Emergency case; family bringing payment', 'Urgent test requested by the doctor; will pay on collection', 'Waiting for HMO approval', 'Transfer did not go through; patient will resend', 'Known patient; will pay before collecting results'];
const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const DAY = 86_400_000;
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function useBalanceNotes() {
  const billing = useBilling();
  const team = useTeam();
  return useMemo(() => {
    const orders = new Map(billing.orders.map((o) => [o.invoiceNo, o]));
    return (v: PatientVisit): BalanceNote | null => {
      if (v.paid >= v.billed) return null;
      const today = startOf(new Date()).getTime();
      const o = orders.get(v.id);
      if (o) {
        const promise = o.balanceInfo.promiseDate ? new Date(`${o.balanceInfo.promiseDate}T00:00:00`) : null;
        return {
          reason: o.balanceInfo.reason || 'No reason recorded',
          approvedBy: o.balanceInfo.approvedBy ? { name: o.balanceInfo.approvedBy.name, role: o.balanceInfo.approvedBy.role } : null,
          promise,
          overdueDays: promise ? Math.max(0, Math.round((today - promise.getTime()) / DAY)) : 0,
          sample: false,
        };
      }
      const h = hash(v.id);
      const list = v.paid > 0 ? PART : NONE;
      const promise = new Date(startOf(v.at).getTime() + (2 + (h % 12)) * DAY);
      return {
        reason: list[h % list.length]!,
        approvedBy: team.processedBy(v) ?? team.manager(v.branchId),
        promise,
        overdueDays: Math.max(0, Math.round((today - promise.getTime()) / DAY)),
        sample: true,
      };
    };
  }, [billing.orders, team]);
}

export const promiseText = (n: BalanceNote) =>
  n.promise ? `${n.overdueDays > 0 ? 'Promised' : 'Will pay by'} ${n.promise.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: n.promise.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}` : 'No payment date given';
