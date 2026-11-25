// GENERATED from the STANLEY desktop app (src/services/finance.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Branch finance — income, costs and profit for a period.
 *
 * Cash basis: income is money actually received (paid at the visit + older
 * balances recovered). Costs are approved operating expenses plus accrued PR
 * commission (placeholder rate until confirmed). Net profit = income − costs.
 * Billed revenue and the outstanding position are shown alongside, never netted.
 *
 * Every figure reconciles with the finance log (data/demo/dailyLines → ledger).
 */
import { DAILY, DATA_START, TODAY, addDays, diffDays, isoDate } from "@company/data/demo/generator";
import type { DateRange, DayRecord } from "@company/data/types";
import { EXPENSE_CATEGORIES } from "@company/data/types";
import { dayCommission } from "./commission";

export interface FinanceTotals {
  billed: number;
  paidAtVisit: number;
  recovered: number;
  /** paidAtVisit + recovered. */
  income: number;
  expenses: number;
  commission: number;
  /** expenses + commission. */
  costs: number;
  net: number;
  /** net ÷ income × 100 (null when there is no income). */
  margin: number | null;
  /** Patient balances owed at the end of the period. */
  outstanding: number;
  openBills: number;
  patients: number;
  transactions: number;
  expensesByCategory: { label: string; value: number }[];
}

function days(branchId: string, r: DateRange): DayRecord[] {
  const all = DAILY[branchId] ?? [];
  const start = Math.max(0, diffDays(DATA_START, r.from));
  const end = Math.min(all.length - 1, diffDays(DATA_START, r.to));
  return end < start ? [] : all.slice(start, end + 1);
}

export function financeTotals(branchId: string, r: DateRange): FinanceTotals {
  const list = days(branchId, r);
  const t = { billed: 0, paidAtVisit: 0, recovered: 0, expenses: 0, commission: 0, patients: 0, transactions: 0 };
  const byCat = EXPENSE_CATEGORIES.map(() => 0);
  for (const d of list) {
    t.billed += d.revenue;
    t.paidAtVisit += d.paidAtVisit;
    t.recovered += d.recovered;
    t.expenses += d.expenses;
    t.commission += dayCommission(d);
    t.patients += d.patients;
    t.transactions += d.transactions;
    d.expensesByCategory.forEach((v, i) => (byCat[i] += v));
  }
  const end = list[list.length - 1];
  const income = t.paidAtVisit + t.recovered;
  const costs = t.expenses + t.commission;
  return {
    ...t,
    income,
    costs,
    net: income - costs,
    margin: income > 0 ? ((income - costs) / income) * 100 : null,
    outstanding: end?.outstanding ?? 0,
    openBills: end?.openBills ?? 0,
    expensesByCategory: EXPENSE_CATEGORIES.map((label, i) => ({ label, value: byCat[i] })),
  };
}

export interface FinanceTrend {
  labels: string[];
  income: number[];
  costs: number[];
  net: number[];
  billed: number[];
  recovered: number[];
  note: string;
}

const dayShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short" });

/** Income, costs and net profit over time (daily, weekly or monthly buckets). */
export function financeTrend(branchId: string, r: DateRange): FinanceTrend {
  // A single day has no shape, so short periods show the trailing 14 days for context.
  const short = r.days < 7;
  let from = short ? addDays(r.to, -13) : r.from;
  if (from < DATA_START) from = DATA_START;
  const to = r.to > TODAY ? TODAY : r.to;
  const span = diffDays(from, to) + 1;
  const bucket: "day" | "week" | "month" = span <= 45 ? "day" : span <= 120 ? "week" : "month";
  const map = new Map<string, { label: string; income: number; costs: number; billed: number; recovered: number }>();
  const all = DAILY[branchId] ?? [];
  for (let i = 0; i < span; i++) {
    const d = addDays(from, i);
    const key = bucket === "day" ? isoDate(d) : bucket === "week" ? isoDate(addDays(d, -((d.getDay() + 6) % 7))) : `${d.getFullYear()}-${d.getMonth()}`;
    const label = bucket === "month" ? monthShort.format(d) : dayShort.format(bucket === "week" ? addDays(d, -((d.getDay() + 6) % 7)) : d);
    const e = map.get(key) ?? { label, income: 0, costs: 0, billed: 0, recovered: 0 };
    const rec = all[diffDays(DATA_START, d)];
    if (rec) {
      e.income += rec.payments;
      e.costs += rec.expenses + dayCommission(rec);
      e.billed += rec.revenue;
      e.recovered += rec.recovered;
    }
    map.set(key, e);
  }
  const rows = [...map.values()];
  return {
    labels: rows.map((x) => x.label),
    income: rows.map((x) => x.income),
    costs: rows.map((x) => x.costs),
    net: rows.map((x) => x.income - x.costs),
    billed: rows.map((x) => x.billed),
    recovered: rows.map((x) => x.recovered),
    note: short ? "Trailing 14 days shown for context" : bucket === "day" ? "Daily totals" : bucket === "week" ? "Weekly totals (week starting)" : "Monthly totals",
  };
}
