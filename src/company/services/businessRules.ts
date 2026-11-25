// GENERATED from the STANLEY desktop app (src/services/businessRules.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Confirmed financial business rules.
 *
 * ESTIMATED OPERATING CONTRIBUTION
 * The formula for this measure has NOT been confirmed in STANLEY's business
 * rules. It is deliberately left unimplemented so the dashboard never shows a
 * figure derived from assumed logic. When the finance owner confirms the
 * definition (which revenue basis, which expense set, treatment of PR
 * commissions and outstanding balances), implement it here and the KPI card
 * will start rendering it automatically.
 */
import type { Currency } from "@company/data/types";
import type { Summary } from "./analytics";

export type ContributionRule = (summary: Summary, currency: Currency) => number;

export const OPERATING_CONTRIBUTION_RULE: ContributionRule | null = null;

/**
 * PR AGENT COMMISSION — STARTING COMPANY RATE (owner: usually 10% or 15%, rarely 20%).
 * Commission = the full bill of each patient an agent sends (all tests) × the
 * agent's rate, e.g. ₦100,000 at 10% = ₦10,000.
 * The legacy export has no commission rate or history. This is only the rate
 * the app starts with; the admin changes it on the PR page (and per agent on
 * the agent profile) — see services/commission.ts, which every figure uses.
 */
export const DEFAULT_PR_COMMISSION_RATE = 0.1;
