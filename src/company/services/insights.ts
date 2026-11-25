// GENERATED from the STANLEY desktop app (src/services/insights.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Attention rules and STANLEY Intelligence briefing.
 *
 * Every statement is assembled from the analytics service — no figure is
 * invented here. When a language-model connector is added later, it must call
 * these same services for numbers and only phrase the results.
 */
import { BRANCHES, getBranch } from "@company/data/company";
import { PENDING_APPROVALS, ACTIVITY } from "@company/data/demo/records";
import { LEGACY_BRANCH_ID } from "@company/data/legacy";
import { CATALOGUE_INVENTORY } from "@company/data/catalogueRules";
import { addDays } from "@company/data/demo/generator";
import type { Currency, DateRange } from "@company/data/types";
import { formatCount, formatMoney, formatPct, moneyEntries } from "@company/shared/format";
import {
  byBranch,
  compareMoney,
  doctorRanking,
  hospitalRanking,
  serviceRanking,
  summarize,
  type Summary,
} from "./analytics";
import { OPERATING_CONTRIBUTION_RULE } from "./businessRules";

export type Severity = "urgent" | "attention" | "info";

export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  branchId: string | null;
  route: string;
  action: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { urgent: 0, attention: 1, info: 2 };

export function attentionItems(branchIds: string[], range: DateRange, includeCompany: boolean): AttentionItem[] {
  const items: AttentionItem[] = [];
  const last30 = { from: addDays(range.to, -29), to: range.to, days: 30 };

  // 1. Balance ageing and outstanding ratio, calculated per branch.
  for (const id of branchIds) {
    const b = getBranch(id);
    if (!b) continue;
    const s = summarize([id], last30);
    const c = b.currency;
    const out = s.outstanding[c] ?? 0;
    const rev = s.revenue[c] ?? 0;
    const aging = s.aging[c];
    const over60 = aging ? aging.d61_90 + aging.d90p : 0;
    const ratio = rev > 0 ? out / rev : 0;
    if (over60 > 0 && out > 0 && over60 / out > 0.05) {
      items.push({
        id: `aging-${id}`,
        severity: "urgent",
        title: `Balances older than 60 days at ${b.name}`,
        detail: `${formatMoney(over60, c, true)} (${formatPct((over60 / out) * 100, 0)} of outstanding) has been unpaid for over 60 days.`,
        branchId: id,
        route: "/finance?tab=outstanding",
        action: "Review balances",
      });
    } else if (ratio > 0.2) {
      items.push({
        id: `ratio-${id}`,
        severity: "attention",
        title: `Unusual outstanding balances at ${b.name}`,
        detail: `${formatMoney(out, c, true)} outstanding — ${formatPct(ratio * 100, 0)} of the last 30 days' revenue generated.`,
        branchId: id,
        route: "/finance?tab=outstanding",
        action: "Open outstanding balances",
      });
    }
  }

  // 2. Pending approvals.
  const approvals = PENDING_APPROVALS.filter((a) => branchIds.includes(a.branchId));
  if (approvals.length) {
    const stale = approvals.filter((a) => Date.now() - a.at.getTime() > 24 * 3_600_000).length;
    items.push({
      id: "approvals",
      severity: stale ? "attention" : "info",
      title: `${approvals.length} expense approval${approvals.length > 1 ? "s" : ""} pending`,
      detail: approvals.map((a) => `${a.title} (${formatMoney(a.amount, a.currency)})`).join(" · ") + (stale ? ` — ${stale} waiting over 24 hours.` : "."),
      branchId: approvals.length === 1 ? approvals[0].branchId : null,
      route: "/finance?tab=expenses",
      action: "Review approvals",
    });
  }

  // 3. Real catalogue data-quality issue: services with no price on file cannot be billed.
  const unpriced = branchIds.includes(LEGACY_BRANCH_ID) ? CATALOGUE_INVENTORY.filter((i) => i.price === null) : [];
  if (unpriced.length) {
    items.push({
      id: "unpriced",
      severity: "attention",
      title: `${unpriced.length} catalogue service${unpriced.length > 1 ? "s have" : " has"} no price`,
      detail: `${unpriced.map((i) => `${i.name} (#${i.id})`).join(" · ")} — confirm prices with the owner before these can be billed.`,
      branchId: LEGACY_BRANCH_ID,
      route: "/inventory?filter=noprice",
      action: "Open catalogue",
    });
  }

  // 4. Flagged administrative changes.
  ACTIVITY.filter((a) => a.status === "Flagged" && a.branchId && branchIds.includes(a.branchId)).forEach((a) =>
    items.push({
      id: `flag-${a.id}`,
      severity: "info",
      title: `${a.title} at ${getBranch(a.branchId)?.name}`,
      detail: `${a.detail} — by ${a.actor}.`,
      branchId: a.branchId,
      route: a.route,
      action: "Inspect change",
    }),
  );

  // 5. Branch setup status (company-wide view only).
  if (includeCompany) {
    BRANCHES.filter((b) => b.status === "Inactive").forEach((b) =>
      items.push({
        id: `setup-${b.id}`,
        severity: "info",
        title: `${b.name} branch is not yet operational`,
        detail: "No manager assigned and no services configured. The branch is excluded from all totals until activated.",
        branchId: b.id,
        route: "/branches",
        action: "Continue setup",
      }),
    );
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/* ─────────────── Intelligence ─────────────── */

export interface BriefingPoint {
  text: string;
  source: string;
}

function moneyList(m: Partial<Record<Currency, number>>): string {
  const e = moneyEntries(m);
  return e.length ? e.map(([c, v]) => formatMoney(v, c, true)).join(" and ") : "no recorded amount";
}

export function briefing(branchIds: string[], range: DateRange, summary: Summary, prior: Summary | null): BriefingPoint[] {
  const pts: BriefingPoint[] = [];
  if (!branchIds.length) return [{ text: "This branch is not operational yet, so there is no activity to brief on.", source: "Branch registry" }];

  const change = compareMoney(summary.revenue, prior?.revenue ?? null);
  const changes = moneyEntries(summary.revenue)
    .map(([c]) => (change[c] == null ? null : `${c} ${change[c]! >= 0 ? "up" : "down"} ${formatPct(Math.abs(change[c]!))}`))
    .filter(Boolean);
  pts.push({
    text: `Revenue generated is ${moneyList(summary.revenue)}${changes.length ? ` (${changes.join(", ")} vs the previous period)` : " — no prior-period data to compare"}.`,
    source: "Analytics · revenue",
  });

  const rates = moneyEntries(summary.revenue)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `${formatPct(((summary.payments[c] ?? 0) / v) * 100, 0)} in ${c}`);
  if (rates.length) pts.push({ text: `Payments received equal ${rates.join(" and ")} of revenue generated in the same period.`, source: "Analytics · payments ÷ revenue" });

  if (branchIds.length > 1) {
    const top = byBranch(range, "NGN", "revenue", branchIds)[0];
    const total = byBranch(range, "NGN", "revenue", branchIds).reduce((s, x) => s + x.value, 0);
    if (top && total > 0)
      pts.push({ text: `${top.branch.name} leads NGN branches with ${formatPct((top.value / total) * 100, 0)} of NGN revenue generated.`, source: "Analytics · branch comparison" });
  }

  const outTop = moneyEntries(summary.outstanding)[0];
  if (outTop) {
    const byB = byBranch(range, outTop[0], "outstanding", branchIds)[0];
    pts.push({
      text: `Outstanding patient balances stand at ${moneyList(summary.outstanding)} across ${formatCount(summary.openBills)} open bills${byB && branchIds.length > 1 ? `; ${byB.branch.name} holds the largest share` : ""}.`,
      source: "Analytics · balances at period end",
    });
  }

  const doc = doctorRanking(branchIds, range)[0];
  const hosp = hospitalRanking(branchIds, range)[0];
  if (doc && doc.referrals > 0)
    pts.push({ text: `${doc.name} is the leading referring doctor (${formatCount(doc.referrals)} referrals)${hosp ? `, and ${hosp.name} the leading referring organisation` : ""}.`, source: "Analytics · referrals" });

  const svc = serviceRanking(branchIds, range)[0];
  if (svc && svc.count > 0) pts.push({ text: `${svc.name} is the most performed diagnostic service with ${formatCount(svc.count)} orders.`, source: "Analytics · services" });

  pts.push({ text: `${formatCount(summary.patients)} patient visits were recorded, including ${formatCount(summary.newPatients)} new registrations.`, source: "Analytics · patients" });
  return pts;
}

export function answerQuestion(question: string, branchIds: string[], range: DateRange, summary: Summary, prior: Summary | null): string {
  const q = question.toLowerCase();
  const pts = briefing(branchIds, range, summary, prior);
  const find = (src: string) => pts.find((p) => p.source.includes(src))?.text;

  if (/contribution|profit|margin|net/.test(q))
    return OPERATING_CONTRIBUTION_RULE
      ? "Operating contribution is calculated from the confirmed business rule."
      : "I can't calculate operating contribution yet — its formula hasn't been confirmed in STANLEY's business rules, so I won't estimate it. I can report revenue, payments, expenses and balances separately.";
  if (/expense|spend|cost/.test(q)) return `Approved expenses for this period total ${moneyList(summary.expenses)}. Expenses are shown by expense date and kept separate from revenue.`;
  if (/outstanding|balance|owe|debt|unpaid/.test(q)) return find("balances") ?? "There are no outstanding balances in this context.";
  if (/payment|collect|receipt/.test(q)) return `${find("payments ÷") ?? ""}\nPayments received total ${moneyList(summary.payments)} across ${formatCount(summary.transactions)} transactions.`.trim();
  if (/branch|best|lead|top/.test(q) && !/doctor|hospital|service/.test(q)) return find("branch comparison") ?? "Only one branch is in the current context. Switch the company context to All branches to compare.";
  if (/doctor|hospital|refer/.test(q)) return find("referrals") ?? "No referrals were recorded in this period.";
  if (/service|test|scan|diagnostic/.test(q)) return find("services") ?? "No diagnostic services were recorded in this period.";
  if (/patient|visit|attend/.test(q)) return find("patients") ?? "No patient visits in this period.";
  if (/revenue|sales|income|generated/.test(q)) return find("revenue") ?? "No revenue was recorded in this period.";
  return "I can answer questions about revenue, payments, expenses, outstanding balances, branch comparison, referrals, diagnostic services and patient activity for the current context and reporting period.";
}
