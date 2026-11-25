/**
 * Referral status from the branch (owner, 2026-11-25). The front desk or the
 * Branch Manager says what happened to a referral the patient has not been
 * billed for yet, so nothing hangs on "waiting" for ever:
 *   • Coming later (with the day the patient said they will come),
 *   • Did not come,
 *   • Cancelled (with the reason).
 * Attended and Bill started are never set by hand: they come from the bill.
 * The PR agent who referred the patient sees the update on the request
 * (Referrer Portal), so they can follow up. Kept on this device until the
 * cloud connection carries it between the branch and the agent.
 */
import { useSyncExternalStore } from 'react';

export type BranchUpdateKind = 'coming' | 'no_show' | 'cancelled';
export interface BranchUpdate {
  status: BranchUpdateKind;
  /** Coming later: the day (YYYY-MM-DD). */
  date?: string;
  note?: string;
  by: { name: string; role: string };
  at: string;
}

const KEY = 'stanley.referral.status.v1';
const listeners = new Set<() => void>();
let cache: Record<string, BranchUpdate> = load();

function load(): Record<string, BranchUpdate> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, BranchUpdate>;
  } catch {
    return {};
  }
}
function commit(next: Record<string, BranchUpdate>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: kept for this session */
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

export const BRANCH_UPDATE_LABEL: Record<BranchUpdateKind, string> = { coming: 'Coming later', no_show: 'Did not come', cancelled: 'Cancelled' };

/** Set (or clear with null) the branch's update for a referral ID. */
export function setBranchUpdate(id: string, u: BranchUpdate | null) {
  const next = { ...cache };
  if (u) next[id.toUpperCase()] = u;
  else delete next[id.toUpperCase()];
  commit(next);
}
export const branchUpdateOf = (id: string): BranchUpdate | undefined => cache[id.toUpperCase()];

export function useBranchUpdates(): Record<string, BranchUpdate> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
}

/** One line for the PR agent: what the branch said. */
export function branchUpdateText(u: BranchUpdate) {
  const day = u.date ? new Date(`${u.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : '';
  const head = u.status === 'coming' ? `The patient is coming later${day ? `, on ${day}` : ''}` : u.status === 'no_show' ? 'The patient did not come' : 'The referral was cancelled';
  return u.note ? `${head}. ${u.note}` : `${head}.`;
}
