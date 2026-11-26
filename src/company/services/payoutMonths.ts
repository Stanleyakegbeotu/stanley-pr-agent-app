// GENERATED from the STANLEY desktop app (src/services/payoutMonths.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Monthly payout log (owner, 2026-11-26). PR agents are paid their monthly
 * commission at the end of each month. After paying, the branch marks the
 * month as paid for each agent (or every agent at once):
 *   • the Branch Manager for their own branch,
 *   • the Company Admin for any branch.
 * A mistaken "paid" can be undone with a reason. Every change goes to the
 * audit log.
 *
 * The PR agent never sees the words paid, payout or commission. Their app
 * shows a month log: the current month is Ongoing, a past month is Ended,
 * and a month marked paid is Ended ✓. If the agent reports an issue with a
 * month (services/issueReports, "Monthly payout"), it shows Under review
 * until the branch resolves the report, then Resolved.
 *
 * Saved on this device until the cloud connection carries it to the agents'
 * phones.
 */
import { useSyncExternalStore } from "react";
import type { IssueReport } from "./issueReports";

export interface PaidMark {
  at: string;
  by: { name: string; role: string };
  /** Bank transfer reference, when given. */
  reference?: string;
}
type Store = Record<string, PaidMark>;

const KEY = "stanley.payoutMonths.v1";
const listeners = new Set<() => void>();
let state: Store | null = null;
function load(): Store {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}
function commit(next: Store) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
}
const current = () => (state ??= load());
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = null;
      listeners.forEach((l) => l());
    }
  });

export function usePaidMarks(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
  );
}

const key = (branchId: string, month: string, agentId: number) => `${branchId}|${month}|${agentId}`;
/** "2026-11" for a date. */
export const monthOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
/** The last `n` months, newest first ("2026-11", "2026-10" …). */
export function lastMonths(n: number, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => monthOf(new Date(from.getFullYear(), from.getMonth() - i, 1)));
}

export const paidMark = (s: Store, branchId: string, month: string, agentId: number) => s[key(branchId, month, agentId)];

/** The Branch Manager marks their own branch; the Company Admin any branch. */
export const canMarkPaid = (user: { kind: string }, userBranchId: string | null, branchId: string) => user.kind === "admin" || (user.kind === "manager" && userBranchId === branchId);

export function markPaid(branchId: string, month: string, agentIds: number[], by: { name: string; role: string }, reference?: string) {
  const s = { ...current() };
  const at = new Date().toISOString();
  for (const id of agentIds) s[key(branchId, month, id)] = { at, by, reference: reference?.trim() || undefined };
  commit(s);
}
export function unmarkPaid(branchId: string, month: string, agentId: number) {
  const s = { ...current() };
  delete s[key(branchId, month, agentId)];
  commit(s);
}

/* ─────────────── the PR agent's month log ─────────────── */

export type MonthState = "ongoing" | "ended" | "ticked" | "review" | "resolved";
export const MONTH_STATE_TEXT: Record<MonthState, string> = { ongoing: "Ongoing", ended: "Ended", ticked: "Ended", review: "Under review", resolved: "Resolved" };

/** How a month looks to the PR agent (never "paid"): the reports they sent about it decide Under review / Resolved. */
export function monthStateFor(s: Store, reports: IssueReport[], branchId: string, agentId: number, month: string, now = new Date()): MonthState {
  if (month === monthOf(now)) return "ongoing";
  const mine = reports.filter((r) => r.aboutKind === "payout" && r.month === month && r.from.agentId === agentId && r.branchId === branchId);
  if (mine.some((r) => r.status !== "resolved")) return "review";
  if (mine.length) return "resolved";
  return paidMark(s, branchId, month, agentId) ? "ticked" : "ended";
}
