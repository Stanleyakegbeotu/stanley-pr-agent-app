// GENERATED from the STANLEY desktop app (src/features/reports/access.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Which reports each role can create (owner, 2026-11-22). Single source for
 * the branch Analysis page. The Company Admin's Reports page is unchanged
 * (every report, every branch).
 *
 * Principle: least privilege — each role gets the reports its daily work
 * needs, nothing more (the usual pattern in clinic systems: receptionists get
 * daily payment / collection reports for cashing up; managers get the full
 * picture for their own branch).
 *
 *  • Branch Manager — every report, for their own branch only: revenue & P&L,
 *    PR agents (incl. commission payout), referring hospitals, diagnostic
 *    services, payments & balances, staff activity.
 *  • Front Desk / receptionist — what a shift needs: payments received and
 *    the payment-method summary (end-of-day cash-up), balances recovered and
 *    outstanding balances (to follow patients up), diagnostic services, and
 *    PR agent / hospital performance (marketers' monthly targets). Up to one
 *    month at a time. No revenue / profit statement, no commission payout or
 *    agents' bank details, no staff activity.
 *  STANLEY has only these two staff roles. Anyone else who needs a report
 *  (e.g. an accountant) gets it from the manager, printed or as a PDF/CSV.
 */
import type { ReportId, ReportSpec } from "./specs";
import { REPORTS } from "./specs";
import { can } from "@company/services/permissions";

type Access = Partial<Record<ReportId, readonly string[] | "all">>;

/**
 * The reports a role can create, from its permissions (Settings → Roles &
 * Permissions). Defaults (owner, 2026-11-22): front desk creates payments &
 * balances, services, PR agent and hospital reports (marketers' monthly
 * targets) — not the commission payout (bank details), revenue or staff
 * activity; the manager creates everything.
 */
export function accessFor(role: string): Access {
  if (!can(role, "reports.view")) return {};
  return {
    payments: "all",
    services: "all",
    hospitals: "all",
    agents: can(role, "referral.commission") ? "all" : ["performance", "patients"],
    ...(can(role, "reports.revenue") ? { revenue: "all" as const } : {}),
    ...(can(role, "reports.staff") ? { staff: "all" as const } : {}),
  };
}

/**
 * Longest period a role may analyse or report on: with "Yearly analysis &
 * reports" the whole year (what the branch achieved), otherwise one month.
 */
export const maxDaysFor = (role: string): number | undefined => (can(role, "analytics.year") ? undefined : 31);

/** Why a report is kept for the manager — shown to roles that don't have it. */
export const LOCKED_REASON: Partial<Record<ReportId, string>> = {
  revenue: "income, expenses and profit",
  agents: "PR commission and agents' bank details",
  hospitals: "referral revenue by hospital",
  staff: "staff performance",
  services: "test volumes and revenue",
  payments: "all payment reports",
};

/**
 * Branch roles never see net profit (Company Admin only), so the revenue
 * report is described without it — its statement becomes "income & expenses".
 */
const NO_PROFIT: Record<string, { label?: string; description: string }> = {
  summary: { label: "Income & expenses summary", description: "One statement: billed, income, every expense category, PR commission and outstanding balances." },
  daily: { description: "One line per day: patients, billed, income, expenses and PR commission." },
  monthly: { description: "One line per month: patients, billed, income, expenses and PR commission." },
};
const withoutProfit = (r: ReportSpec): ReportSpec =>
  r.id !== "revenue"
    ? r
    : { ...r, tagline: "Income and expenses", description: "Income and expenses — summary, daily, monthly or line by line.", variants: r.variants.map((v) => (NO_PROFIT[v.id] ? { ...v, label: NO_PROFIT[v.id].label ?? v.label, description: NO_PROFIT[v.id].description } : v)) };

/** The reports (and report types) this role can create. */
export function reportsFor(role: string): ReportSpec[] {
  const access = accessFor(role);
  return REPORTS.map(withoutProfit).flatMap((r) => {
    const a = access[r.id];
    if (!a) return [];
    if (a === "all") return [r];
    const variants = r.variants.filter((v) => a.includes(v.id));
    // A partial report names what this role gets (e.g. "Catalogue price list"), not the full report.
    return variants.length ? [{ ...r, variants, tagline: variants.length < r.variants.length ? variants.map((v) => v.label).join(" · ") : r.tagline }] : [];
  });
}

/** Reports this role can't create (or only partly), for the "kept for the manager" note. */
export function reportsLocked(role: string): { spec: ReportSpec; partial: boolean }[] {
  const allowed = reportsFor(role);
  return REPORTS.flatMap((r): { spec: ReportSpec; partial: boolean }[] => {
    const mine = allowed.find((x) => x.id === r.id);
    if (!mine) return [{ spec: r, partial: false }];
    return mine.variants.length < r.variants.length ? [{ spec: r, partial: true }] : [];
  });
}
