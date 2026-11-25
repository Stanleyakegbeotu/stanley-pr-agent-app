// GENERATED from the STANLEY desktop app (src/services/commission.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * PR agent commission — one place for the rate used everywhere.
 *
 *  • Company rate: a flat rate for every PR agent (changed on the PR page).
 *  • Agent rate: an optional rate for one agent (changed on the agent's
 *    profile); it replaces the company rate for that agent only.
 *
 * Commission is always worked out from the bills of the patients an agent
 * referred, so changing a rate updates the PR page, Finance, the dashboard and
 * every report at once. Settings last for the session until the database is
 * connected (no persistence layer exists yet).
 */
import { useSyncExternalStore } from "react";
import type { DayRecord } from "@company/data/types";
import { DEFAULT_PR_COMMISSION_RATE } from "./businessRules";
import { logAudit } from "./audit";

interface CommissionState {
  rate: number;
  /** agentId → own rate (0–1). */
  overrides: Record<number, number>;
  version: number;
}

let state: CommissionState = { rate: DEFAULT_PR_COMMISSION_RATE, overrides: {}, version: 0 };
const listeners = new Set<() => void>();

function commit(next: Partial<CommissionState>) {
  state = { ...state, ...next, version: state.version + 1 };
  listeners.forEach((l) => l());
}

const clamp = (r: number) => Math.min(1, Math.max(0, Math.round(r * 10000) / 10000));

export const companyRate = () => state.rate;
export const agentRate = (agentId: number): number | undefined => state.overrides[agentId];
/** The rate that applies to an agent: their own rate, else the company rate. */
export const rateFor = (agentId: number) => state.overrides[agentId] ?? state.rate;
export const hasAgentRates = () => Object.keys(state.overrides).length > 0;

export function setCompanyRate(rate: number) {
  const before = state.rate;
  commit({ rate: clamp(rate) });
  if (before !== state.rate) logAudit({ category: "Commission", action: "Company rate changed", record: "All PR agents", details: `${pct(before)} → ${pct(state.rate)} (agents with their own rate keep it)`, branchId: null });
}

/** Set (or with null, remove) an agent's own rate. `label` names the agent in the audit log. */
export function setAgentRate(agentId: number, rate: number | null, label?: string) {
  const before = state.overrides[agentId];
  const overrides = { ...state.overrides };
  if (rate === null) delete overrides[agentId];
  else overrides[agentId] = clamp(rate);
  commit({ overrides });
  logAudit({
    category: "Commission",
    action: rate === null ? "Agent rate removed" : before === undefined ? "Agent rate set" : "Agent rate changed",
    record: `${label ?? "PR agent"} (#${agentId})`,
    details: rate === null ? `Back to the company rate (${pct(state.rate)})` : `${before === undefined ? `Company rate ${pct(state.rate)}` : pct(before)} → ${pct(clamp(rate))}`,
    branchId: null,
  });
}

/** Commission on one referred bill. */
export const commissionOn = (billed: number, agentId: number) => billed * rateFor(agentId);

/** A day's accrued PR commission at the current rates (whole naira). */
export function dayCommission(rec: DayRecord): number {
  let total = 0;
  rec.referralAgentIds.forEach((id, k) => (total += rec.referralRevenue[k] * rateFor(id)));
  return Math.round(total);
}

/** "5%" / "7.5%" */
export const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;

/** One line describing the rates in force, for notes and footers. */
export const rateSummary = () => `Company rate ${pct(state.rate)}${hasAgentRates() ? `; ${Object.keys(state.overrides).length} agent(s) on their own rate` : ""}`;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-renders when any rate changes; use `version` in memo dependencies. */
export function useCommission() {
  return useSyncExternalStore(subscribe, () => state);
}

/** The rates the business normally uses (owner: 10% or 15%, rarely 20%). */
export const COMMON_RATES = [0.1, 0.15, 0.2] as const;
