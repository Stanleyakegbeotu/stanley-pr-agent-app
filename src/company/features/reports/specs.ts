// GENERATED from the STANLEY desktop app (src/features/reports/specs.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Report definitions: what each report can contain, the options shown in the
 * builder (with plain-language help), and how the document is built.
 *
 * Every figure comes from the same sources as the rest of the app (daily
 * figures, patient visits, the finance log, open balances, the catalogue and
 * the PR network), so reports always match the pages they summarise.
 */
import { ChartLine, FlaskConical, Handshake, Hospital, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { BRANCHES, COMPANY, SERVICES, getBranch, servicePrice } from "@company/data/company";
import { CATALOGUE_INVENTORY } from "@company/data/catalogueRules";
import { DAILY, DATA_START, addDays, diffDays, isoDate } from "@company/data/demo/generator";
import { ledger, openBalances, patientVisits, type LedgerEntry, type PatientVisit } from "@company/data/demo/dailyLines";
import { LEGACY_BRANCH_ID, buildHospitalDirectory, hasPhone, hospitalKey } from "@company/data/legacy";
import { netPay, usesApp, type AgentRecord, type StaffRecord } from "@company/data/userRecords";
import { STATUS_HINT as AGENT_STATUS_HINT, STATUS_LABEL as AGENT_STATUS_LABEL, agentHealth, checkUpsNow, type AgentHealth, type AgentStatus } from "@company/services/agentMonitor";
import type { Currency, DateRange } from "@company/data/types";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@company/data/types";
import { financeTotals } from "@company/services/finance";
import { serviceRanking } from "@company/services/analytics";
import { dayCommission, pct as ratePct, rateFor, rateSummary } from "@company/services/commission";
import { formatCount, formatMoney, formatShortDate, formatTime } from "@company/shared/format";
import { num, txt, type Block, type Cell, type Column, type Paper, type ReportDoc } from "./model";

export type ReportId = "revenue" | "agents" | "hospitals" | "services" | "payments" | "staff";

export interface ReportParams {
  variant: string;
  range: DateRange;
  /** "all" or a branch id. */
  branch: string;
  options: Record<string, boolean>;
  columns: string[];
  selects: Record<string, string>;
  paper: Paper;
}

export interface ReportCtx {
  agents: readonly AgentRecord[];
  /** Staff on record (Staff Management), for the staff directory and salary reports. */
  staff?: readonly StaffRecord[];
  /** Owner rule: only the Company Admin sees net profit / margin — reports for anyone else leave them out. */
  hideProfit?: boolean;
}

export interface VariantDef {
  id: string;
  label: string;
  description: string;
  /** False when the report does not depend on a date range (e.g. a price list). */
  dated?: boolean;
  /** Short note shown under the period ("Balances are shown as of the end date"). */
  periodNote?: string;
  /** "month": the period is one calendar month, picked from a month list. */
  periodMode?: "month";
}

export interface OptionDef {
  id: string;
  label: string;
  help: string;
  default: boolean;
  variants?: string[];
}

export interface ColumnDef {
  id: string;
  label: string;
  default: boolean;
  required?: boolean;
}

export interface SelectDef {
  id: string;
  label: string;
  help: string;
  options: (ctx: ReportCtx) => { value: string; label: string }[];
  default: string;
  variants?: string[];
}

export interface ReportSpec {
  id: ReportId;
  title: string;
  short: string;
  /** One short line for the compact report card. */
  tagline: string;
  icon: LucideIcon;
  description: string;
  /** What the person can do with this report, in plain words. */
  guide: string;
  variants: VariantDef[];
  columns?: Record<string, ColumnDef[]>;
  options?: OptionDef[];
  selects?: SelectDef[];
  suggestPaper: (p: ReportParams) => Paper;
  build: (p: ReportParams, ctx: ReportCtx) => ReportDoc;
}

/* ─────────────── Shared helpers ─────────────── */

const curOf = (branchId: string): Currency => getBranch(branchId)?.currency ?? "NGN";
const branchIdsOf = (p: ReportParams) => (p.branch === "all" ? BRANCHES.filter((b) => b.status === "Active").map((b) => b.id) : [p.branch]);
const branchLabel = (p: ReportParams) => (p.branch === "all" ? "All branches" : `${getBranch(p.branch)?.name ?? p.branch} branch`);
const day = (d: Date) => `${formatShortDate(d)} ${d.getFullYear()}`;
const rangeLabel = (r: DateRange) => (r.days === 1 ? day(r.from) : `${day(r.from)} – ${day(r.to)}`);
const money = (n: number, c: Currency = "NGN", extra: Partial<Cell> = {}) => num(formatMoney(n, c), n, extra);
const count = (n: number, extra: Partial<Cell> = {}) => num(formatCount(n), n, extra);
const pct = (part: number, whole: number) => (whole > 0 ? num(`${((part / whole) * 100).toFixed(1)}%`, Math.round((part / whole) * 1000) / 10) : txt("—"));
const COMPANY_NAME = COMPANY.name;
const AGENT_BRANCH = getBranch(LEGACY_BRANCH_ID);

/** Who is creating the report (set by the builder from the signed-in user). */
let preparer = "Company Admin";
export function setReportPreparer(name: string, role: string) {
  preparer = role && role !== name ? `${name} · ${role}` : name;
}

function baseMeta(spec: ReportSpec, p: ReportParams, extra: { label: string; value: string }[] = []) {
  const v = spec.variants.find((x) => x.id === p.variant);
  return [
    { label: "Report", value: v?.label ?? spec.title },
    ...(v?.dated === false ? [] : [{ label: "Period", value: rangeLabel(p.range) }]),
    { label: "Branch", value: branchLabel(p) },
    { label: "Generated", value: `${day(new Date())} · ${formatTime(new Date())}` },
    { label: "Prepared by", value: preparer },
    ...extra,
  ];
}

const FOOT_DEMO = "Demonstration activity built from the real Silhouette catalogue, prices and PR network.";

function fileName(spec: ReportSpec, p: ReportParams) {
  const v = spec.variants.find((x) => x.id === p.variant);
  const b = p.branch === "all" ? "all-branches" : (getBranch(p.branch)?.code ?? p.branch).toLowerCase();
  const dated = v?.dated === false ? "" : `-${isoDate(p.range.from)}_${isoDate(p.range.to)}`;
  return `silhouette-${spec.id}-${(v?.id ?? "report").toLowerCase()}-${b}${dated}`;
}

/** Wide tables print better in landscape; very wide ones on A3. */
const paperFor = (columns: number): Paper => (columns <= 5 ? { size: "A4", orientation: "portrait" } : columns <= 10 ? { size: "A4", orientation: "landscape" } : { size: "A3", orientation: "landscape" });

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ─────────────── 1. Revenue (finance) ─────────────── */

const REVENUE: ReportSpec = {
  id: "revenue",
  title: "Revenue report",
  short: "Revenue",
  tagline: "Income, expenses and profit",
  icon: ChartLine,
  description: "Income, expenses and net profit — summary, daily, monthly or line by line.",
  guide: "Shows how much came in (paid at visit + balances recovered), how much went out (expenses + PR commission) and the profit left. Same figures as the Finance & Expenses page.",
  variants: [
    { id: "summary", label: "Profit & loss summary", description: "One statement: billed, income, every expense category, PR commission, net profit and outstanding." },
    { id: "daily", label: "Daily breakdown", description: "One line per day: patients, billed, income, expenses and net profit." },
    { id: "monthly", label: "Monthly breakdown", description: "One line per month — best for the year or several months." },
    { id: "income", label: "Income log", description: "Every payment received, with its source (patient bill or recovered balance)." },
    { id: "expenses", label: "Expense log", description: "Every expense and PR commission entry, with what it was for." },
  ],
  options: [
    { id: "details", label: "Show details column", help: "Adds tests performed, the original visit or what an expense covers. Makes the report longer.", default: true, variants: ["income", "expenses"] },
    { id: "explain", label: "Explain each figure", help: "Adds a short note under the statement describing how income, expenses and profit are counted.", default: true, variants: ["summary"] },
  ],
  suggestPaper: (p) => (p.variant === "summary" ? { size: "A4", orientation: "portrait" } : { size: "A4", orientation: "landscape" }),
  build(p, ctx) {
    const hide = !!ctx.hideProfit;
    const ids = branchIdsOf(p);
    const blocks: Block[] = [];
    const multi = ids.length > 1;
    const c0 = curOf(ids[0]);
    const sameCur = ids.every((id) => curOf(id) === c0);

    if (p.variant === "summary") {
      const per = ids.map((id) => ({ id, t: financeTotals(id, p.range), c: curOf(id) }));
      const all = per.reduce(
        (a, x) => ({ income: a.income + x.t.income, costs: a.costs + x.t.costs, net: a.net + x.t.net, billed: a.billed + x.t.billed }),
        { income: 0, costs: 0, net: 0, billed: 0 },
      );
      if (sameCur)
        blocks.push({
          kind: "summary",
          items: [
            { label: "Total income", value: formatMoney(all.income, c0) },
            { label: "Total expenses", value: formatMoney(all.costs, c0) },
            ...(hide
              ? [{ label: "Revenue billed", value: formatMoney(all.billed, c0) }]
              : [
                  { label: "Net profit", value: formatMoney(all.net, c0), tone: (all.net < 0 ? "bad" : "good") as "bad" | "good" },
                  { label: "Profit margin", value: all.income ? `${((all.net / all.income) * 100).toFixed(1)}%` : "—" },
                ]),
          ],
        });
      const cols: Column[] = [{ key: "item", label: "Item", weight: 2.4 }, ...per.map((x) => ({ key: x.id, label: getBranch(x.id)?.name ?? x.id, align: "right" as const })), ...(multi && sameCur ? [{ key: "total", label: "All branches", align: "right" as const }] : [])];
      const line = (label: string, f: (t: ReturnType<typeof financeTotals>) => number, extra: Partial<Cell> = {}, isCount = false): Cell[] => {
        const vals = per.map((x) => f(x.t));
        const cells = per.map((x, i) => (isCount ? count(vals[i], extra) : money(vals[i], x.c, extra)));
        const total = multi && sameCur ? [isCount ? count(sum(vals, (v) => v), extra) : money(sum(vals, (v) => v), c0, extra)] : [];
        return [txt(label, { b: extra.b }), ...cells, ...total];
      };
      const sect = (label: string): Cell[] => [txt(label, { b: true, tone: "muted" }), ...per.map(() => txt("")), ...(multi && sameCur ? [txt("")] : [])];
      const rows: Cell[][] = [
        line("Patients seen", (t) => t.patients, {}, true),
        line("Revenue billed", (t) => t.billed),
        sect("Income (money received)"),
        line("Paid at visit", (t) => t.paidAtVisit),
        line("Balances recovered", (t) => t.recovered),
        line("Total income", (t) => t.income, { b: true }),
        sect("Expenses"),
        ...EXPENSE_CATEGORIES.map((cat, i) => line(cat, (t) => t.expensesByCategory[i].value)),
        line(`PR commission (${rateSummary()})`, (t) => t.commission),
        line("Total expenses", (t) => t.costs, { b: true }),
        ...(hide
          ? [sect("Balances")]
          : [
              sect("Result"),
              line("Net profit", (t) => t.net, { b: true }),
              [txt("Profit margin"), ...per.map((x) => (x.t.margin === null ? txt("—") : num(`${x.t.margin.toFixed(1)}%`, Math.round(x.t.margin * 10) / 10))), ...(multi && sameCur ? [pct(all.net, all.income)] : [])],
            ]),
        line("Outstanding at period end", (t) => t.outstanding),
      ];
      blocks.push({ kind: "table", title: hide ? "Income & expenses statement" : "Profit & loss statement", subtitle: rangeLabel(p.range), columns: cols, rows });
      if (p.options.explain)
        blocks.push({
          kind: "note",
          text: hide
            ? "Income is money actually received: paid by patients at their visit plus older balances paid back. Expenses are approved operating costs plus PR commission (placeholder rate until confirmed). Net profit is shown to the Company Admin only."
            : "Income is money actually received: paid by patients at their visit plus older balances paid back. Expenses are approved operating costs plus PR commission (placeholder rate until confirmed). Net profit = income − expenses. Revenue billed and outstanding balances are shown for reference and are not added into profit.",
        });
    }

    if (p.variant === "daily" || p.variant === "monthly") {
      const monthly = p.variant === "monthly";
      const cols: Column[] = [
        { key: "d", label: monthly ? "Month" : "Date", weight: 1.3 },
        ...(multi ? [{ key: "b", label: "Branch" }] : []),
        { key: "p", label: "Patients", align: "right", weight: 0.8 },
        { key: "bl", label: "Billed", align: "right" },
        { key: "pv", label: "Paid at visit", align: "right" },
        { key: "rc", label: "Recovered", align: "right" },
        { key: "in", label: "Income", align: "right" },
        { key: "ex", label: "Expenses", align: "right" },
        { key: "cm", label: "PR commission", align: "right" },
        ...(hide ? [] : [{ key: "np", label: "Net profit", align: "right" as const }]),
      ];
      const rows: Cell[][] = [];
      const tot = { p: 0, bl: 0, pv: 0, rc: 0, ex: 0, cm: 0 };
      for (const id of ids) {
        const c = curOf(id);
        const groups = new Map<string, { label: string; p: number; bl: number; pv: number; rc: number; ex: number; cm: number }>();
        for (let i = 0; i < p.range.days; i++) {
          const d = addDays(p.range.from, i);
          const rec = DAILY[id]?.[diffDays(DATA_START, d)];
          if (!rec) continue;
          const key = monthly ? monthKey(d) : isoDate(d);
          const g = groups.get(key) ?? { label: monthly ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${day(d)}`, p: 0, bl: 0, pv: 0, rc: 0, ex: 0, cm: 0 };
          g.p += rec.patients;
          g.bl += rec.revenue;
          g.pv += rec.paidAtVisit;
          g.rc += rec.recovered;
          g.ex += rec.expenses;
          g.cm += dayCommission(rec);
          groups.set(key, g);
        }
        for (const g of groups.values()) {
          const net = g.pv + g.rc - g.ex - g.cm;
          rows.push([txt(g.label), ...(multi ? [txt(getBranch(id)?.name ?? id)] : []), count(g.p), money(g.bl, c), money(g.pv, c), money(g.rc, c), money(g.pv + g.rc, c, { b: true }), money(g.ex, c), money(g.cm, c), ...(hide ? [] : [money(net, c, { b: true, tone: net < 0 ? "bad" : undefined })])]);
          tot.p += g.p;
          tot.bl += g.bl;
          tot.pv += g.pv;
          tot.rc += g.rc;
          tot.ex += g.ex;
          tot.cm += g.cm;
        }
      }
      const net = tot.pv + tot.rc - tot.ex - tot.cm;
      blocks.push({
        kind: "table",
        title: monthly ? "Monthly income & expenses" : "Daily income & expenses",
        columns: cols,
        rows,
        total: sameCur ? [txt("Total", { b: true }), ...(multi ? [txt("")] : []), count(tot.p), money(tot.bl, c0), money(tot.pv, c0), money(tot.rc, c0), money(tot.pv + tot.rc, c0), money(tot.ex, c0), money(tot.cm, c0), ...(hide ? [] : [money(net, c0, { tone: net < 0 ? "bad" : undefined })])] : undefined,
      });
    }

    if (p.variant === "income" || p.variant === "expenses") {
      const income = p.variant === "income";
      const list = ledger(ids, p.range)
        .filter((e) => (income ? e.direction === "in" : e.direction === "out"))
        .reverse();
      const details = !!p.options.details;
      const cols: Column[] = income
        ? [
            { key: "d", label: "Date & time", weight: 1.2 },
            { key: "r", label: "Reference", weight: 1.3 },
            ...(multi ? [{ key: "b", label: "Branch", weight: 0.9 }] : []),
            { key: "t", label: "Type", weight: 0.9 },
            { key: "s", label: "Source", weight: 1.5 },
            ...(details ? [{ key: "x", label: "Details", weight: 2.6 }] : []),
            { key: "m", label: "Method", weight: 0.8 },
            { key: "by", label: "Recorded by", weight: 1 },
            { key: "a", label: "Amount", align: "right" as const, weight: 1 },
          ]
        : [
            { key: "d", label: "Date & time", weight: 1.2 },
            { key: "r", label: "Reference", weight: 1.4 },
            ...(multi ? [{ key: "b", label: "Branch", weight: 0.9 }] : []),
            { key: "c", label: "Category", weight: 1.3 },
            { key: "s", label: "Item", weight: 1.6 },
            ...(details ? [{ key: "x", label: "Details", weight: 2.2 }] : []),
            { key: "by", label: "Recorded by", weight: 1.1 },
            { key: "a", label: "Amount", align: "right" as const, weight: 1 },
          ];
      const rows = list.map((e) => {
        const c = curOf(e.branchId);
        const when = txt(`${day(e.at)} · ${formatTime(e.at)}`);
        return income
          ? [when, txt(e.id), ...(multi ? [txt(getBranch(e.branchId)?.name ?? "")] : []), txt(e.kind === "visit" ? "Patient bill" : "Recovered"), txt(e.source), ...(details ? [txt(e.detail)] : []), txt(e.method ?? "—"), txt(e.recordedBy), money(e.amount, c)]
          : [when, txt(e.id), ...(multi ? [txt(getBranch(e.branchId)?.name ?? "")] : []), txt(e.category), txt(e.source), ...(details ? [txt(e.detail)] : []), txt(e.recordedBy), money(e.amount, c)];
      });
      const total = sum(list, (e) => e.amount);
      blocks.push({
        kind: "summary",
        items: income
          ? [
              { label: "Payments", value: formatCount(list.length) },
              { label: "Paid at visit", value: formatMoney(sum(list.filter((e) => e.kind === "visit"), (e) => e.amount), c0) },
              { label: "Balances recovered", value: formatMoney(sum(list.filter((e) => e.kind === "recovery"), (e) => e.amount), c0) },
              { label: "Total income", value: formatMoney(total, c0) },
            ]
          : [
              { label: "Entries", value: formatCount(list.length) },
              { label: "Operating expenses", value: formatMoney(sum(list.filter((e) => e.kind === "expense"), (e) => e.amount), c0) },
              { label: "PR commission", value: formatMoney(sum(list.filter((e) => e.kind === "commission"), (e) => e.amount), c0) },
              { label: "Total expenses", value: formatMoney(total, c0) },
            ],
      });
      blocks.push({
        kind: "table",
        title: income ? "Income log" : "Expense log",
        subtitle: "Oldest first",
        columns: cols,
        rows,
        empty: income ? "No payments received in this period." : "No expenses recorded in this period.",
        total: sameCur ? [...cols.slice(0, -1).map((_, i) => (i === 0 ? txt("Total", { b: true }) : txt(""))), money(total, c0)] : undefined,
      });
    }

    // Branch roles never see "profit" — the summary is their income & expenses statement.
    const vLabel = hide && p.variant === "summary" ? "Income & expenses summary" : REVENUE.variants.find((v) => v.id === p.variant)?.label;
    return { title: "Revenue report", subtitle: `${vLabel} · ${branchLabel(p)} · ${rangeLabel(p.range)}`, meta: baseMeta(REVENUE, p).map((m) => (m.label === "Report" ? { ...m, value: vLabel ?? m.value } : m)), blocks, footnote: FOOT_DEMO, filename: fileName(REVENUE, p) };
  },
};

/* ─────────────── 2. PR agents ─────────────── */

interface AgentAgg {
  agent: AgentRecord;
  visits: PatientVisit[];
  billed: number;
  paid: number;
  /** At the agent's rate (own rate, else company rate), whole naira. */
  commission: number;
  rate: number;
}

function agentAggregates(p: ReportParams, ctx: ReportCtx): AgentAgg[] {
  const ids = branchIdsOf(p);
  const visits = ids.includes(LEGACY_BRANCH_ID) ? patientVisits([LEGACY_BRANCH_ID], p.range).filter((v) => v.agentId !== null) : [];
  const by = new Map<number, PatientVisit[]>();
  for (const v of visits) by.set(v.agentId!, [...(by.get(v.agentId!) ?? []), v]);
  const hospital = p.selects.hospital ?? "all";
  return ctx.agents
    .filter((a) => (hospital === "all" ? true : hospital === "__none" ? !hospitalKey(a.hospital) : hospitalKey(a.hospital) === hospital))
    .map((a) => {
      const list = (by.get(a.id) ?? []).slice().sort((x, y) => x.at.getTime() - y.at.getTime());
      const billed = sum(list, (v) => v.billed);
      return { agent: a, visits: list, billed, paid: sum(list, (v) => v.paid), rate: rateFor(a.id), commission: Math.round(billed * rateFor(a.id)) };
    })
    .filter((x) => p.options.inactive || x.visits.length > 0)
    .sort((a, b) => {
      const s = p.selects.sort ?? "referrals";
      if (s === "name") return a.agent.name.localeCompare(b.agent.name);
      if (s === "revenue") return b.billed - a.billed;
      if (s === "id") return a.agent.id - b.agent.id;
      return b.visits.length - a.visits.length || b.billed - a.billed;
    });
}

const hospitalOptions = (ctx: ReportCtx) => [
  { value: "all", label: "All hospitals" },
  { value: "__none", label: "No hospital assigned" },
  ...buildHospitalDirectory(ctx.agents)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((h) => ({ value: h.key, label: `${h.key} · ${h.agentCount} agent${h.agentCount === 1 ? "" : "s"}` })),
];

const AGENT_COLUMNS: ColumnDef[] = [
  { id: "id", label: "Agent ID", default: true },
  { id: "name", label: "PR agent name", default: true, required: true },
  { id: "phone", label: "Phone number", default: true },
  { id: "hospital", label: "Hospital", default: true },
  { id: "branch", label: "Branch", default: false },
  { id: "referrals", label: "Patients referred", default: true },
  { id: "billed", label: "Revenue generated", default: true },
  { id: "paid", label: "Paid by patients", default: false },
  { id: "commission", label: "Commission earned", default: true },
  { id: "first", label: "First referral", default: false },
  { id: "last", label: "Last referral", default: false },
];

/* ── Monthly commission payout (grouped by bank, A–Z) ── */

const PAYOUT_COLUMNS: ColumnDef[] = [
  { id: "name", label: "PR agent name", default: true, required: true },
  { id: "phone", label: "Phone number", default: true },
  { id: "accountName", label: "Account name", default: true },
  { id: "accountNumber", label: "Account number", default: true },
  { id: "bankName", label: "Bank name", default: true },
  { id: "hospital", label: "Hospital", default: false },
  { id: "patients", label: "Patients sent", default: true },
  { id: "referrals", label: "Referrals (visits)", default: false },
  { id: "billed", label: "Revenue generated", default: false },
  { id: "rate", label: "Commission rate", default: true },
  { id: "commission", label: "Commission to pay", default: true, required: true },
  { id: "paid", label: "Paid tick box", default: true },
];

const NO_BANK = "No bank details on record";

function buildPayout(p: ReportParams, ctx: ReportCtx): ReportDoc {
  const c: Currency = AGENT_BRANCH?.currency ?? "NGN";
  const monthName = p.range.from.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const partial = p.range.to < new Date(p.range.from.getFullYear(), p.range.from.getMonth() + 1, 0);
  const list = agentAggregates({ ...p, options: { inactive: true }, selects: { hospital: "all", sort: "name" } }, ctx).filter((x) => p.options.zero || x.commission > 0);
  const bankOf = (x: AgentAgg) => x.agent.bank?.bankName.trim() || NO_BANK;
  const banks = [...new Set(list.map(bankOf))].sort((a, b) => (a === NO_BANK ? 1 : b === NO_BANK ? -1 : a.localeCompare(b, "en", { sensitivity: "base" })));
  const total = sum(list, (x) => x.commission);
  const missing = list.filter((x) => !x.agent.bank);

  const COLS: Record<string, Column> = {
    name: { key: "name", label: "PR agent", weight: 1.6 },
    phone: { key: "phone", label: "Phone", weight: 1.1 },
    accountName: { key: "accountName", label: "Account name", weight: 1.6 },
    accountNumber: { key: "accountNumber", label: "Account number", weight: 1.1 },
    bankName: { key: "bankName", label: "Bank name", weight: 1.3 },
    hospital: { key: "hospital", label: "Hospital", weight: 0.9 },
    patients: { key: "patients", label: "Patients", align: "right", weight: 0.7 },
    referrals: { key: "referrals", label: "Referrals", align: "right", weight: 0.7 },
    billed: { key: "billed", label: "Revenue generated", align: "right", weight: 1.1 },
    rate: { key: "rate", label: "Rate", align: "right", weight: 0.6 },
    commission: { key: "commission", label: "Commission", align: "right", weight: 1.1 },
    paid: { key: "paid", label: "Paid (tick)", weight: 0.7 },
  };
  const chosen = PAYOUT_COLUMNS.filter((d) => p.columns.includes(d.id));
  const columns: Column[] = [{ key: "sn", label: "S/N", weight: 0.4 }, ...chosen.map((d) => COLS[d.id])];
  const cell = (id: string, x: AgentAgg): Cell => {
    const a = x.agent;
    switch (id) {
      case "name":
        return txt(a.name, { b: true });
      case "phone":
        return txt(hasPhone(a.phone) ? a.phone : "N/A", { tone: hasPhone(a.phone) ? undefined : "muted", keepText: true });
      case "accountName":
        return txt(a.bank?.accountName ?? "Not on record", { tone: a.bank ? undefined : "muted" });
      case "accountNumber":
        return txt(a.bank?.accountNumber ?? "—", { tone: a.bank ? undefined : "muted", keepText: true });
      case "bankName":
        return txt(a.bank?.bankName ?? "Not on record", { tone: a.bank ? undefined : "muted" });
      case "hospital":
        return txt(hospitalKey(a.hospital) || "No hospital", { tone: hospitalKey(a.hospital) ? undefined : "muted" });
      case "patients":
        return count(new Set(x.visits.map((v) => v.patientRef)).size);
      case "referrals":
        return count(x.visits.length);
      case "billed":
        return money(x.billed, c);
      case "rate":
        return num(ratePct(x.rate), Math.round(x.rate * 10000) / 100);
      case "commission":
        return money(x.commission, c, { b: true });
      case "paid":
        return txt("");
      default:
        return txt("");
    }
  };
  const totalRow = (rows: AgentAgg[]): Cell[] => [
    txt("Total", { b: true }),
    ...chosen.map((d) =>
      d.id === "commission"
        ? money(sum(rows, (x) => x.commission), c)
        : d.id === "patients"
          ? count(sum(rows, (x) => new Set(x.visits.map((v) => v.patientRef)).size))
          : d.id === "referrals"
            ? count(sum(rows, (x) => x.visits.length))
            : d.id === "billed"
              ? money(sum(rows, (x) => x.billed), c)
              : txt(""),
    ),
  ];

  const blocks: Block[] = [
    {
      kind: "summary",
      items: [
        { label: "Agents to pay", value: formatCount(list.filter((x) => x.commission > 0).length) },
        { label: `Total commission · ${monthName}`, value: formatMoney(total, c) },
        { label: "Banks", value: formatCount(banks.filter((b) => b !== NO_BANK).length) },
        { label: "Missing bank details", value: formatCount(missing.length), tone: missing.length ? "bad" : "good", note: missing.length ? formatMoney(sum(missing, (x) => x.commission), c) + " cannot be paid yet" : undefined },
      ],
    },
  ];
  if (partial) blocks.push({ kind: "note", text: `${monthName} is not over yet — figures cover ${day(p.range.from)} to ${day(p.range.to)}. Print again after the month ends for the final payout.` });

  for (const bank of banks) {
    const rows = list.filter((x) => bankOf(x) === bank).sort((a, b) => (a.agent.bank?.accountName ?? a.agent.name).localeCompare(b.agent.bank?.accountName ?? b.agent.name, "en", { sensitivity: "base" }));
    blocks.push({
      kind: "table",
      title: bank,
      subtitle: `${formatCount(rows.length)} agent${rows.length === 1 ? "" : "s"} · ${formatMoney(sum(rows, (x) => x.commission), c)}${bank === NO_BANK ? " · add bank details on each agent's profile before paying" : ""}`,
      columns,
      rows: rows.map((x, i) => [num(String(i + 1), i + 1), ...chosen.map((d) => cell(d.id, x))]),
      total: totalRow(rows),
    });
  }
  if (!list.length) blocks.push({ kind: "note", text: `No commission is due for ${monthName}.` });

  if (p.options.bankSummary && banks.length) {
    blocks.push({
      kind: "table",
      title: "Total per bank",
      columns: [
        { key: "b", label: "Bank", weight: 2 },
        { key: "n", label: "Agents", align: "right", weight: 0.7 },
        { key: "c", label: "Commission", align: "right", weight: 1.1 },
        { key: "s", label: "Share", align: "right", weight: 0.6 },
      ],
      rows: banks.map((b) => {
        const rows = list.filter((x) => bankOf(x) === b);
        const amt = sum(rows, (x) => x.commission);
        return [txt(b, { b: true, tone: b === NO_BANK ? "bad" : undefined }), count(rows.length), money(amt, c), pct(amt, total)];
      }),
      total: [txt("Total to pay", { b: true }), count(list.length), money(total, c), txt("100%")],
    });
  }
  blocks.push({ kind: "note", text: `Commission = bills of the patients each agent sent in ${monthName} × that agent's rate (${rateSummary()}). Agents are grouped by bank in alphabetical order, then by account name.` });

  return {
    title: "PR commission payout",
    subtitle: `${monthName}${partial ? " (so far)" : ""} · ${AGENT_BRANCH?.name ?? ""} branch · grouped by bank`,
    meta: [
      { label: "Report", value: "Monthly commission payout" },
      { label: "Month", value: `${monthName}${partial ? " (so far)" : ""}` },
      { label: "Branch", value: `${AGENT_BRANCH?.name ?? ""} · ${AGENT_BRANCH?.code ?? ""}` },
      { label: "Commission rate", value: rateSummary() },
      { label: "Generated", value: `${day(new Date())} · ${formatTime(new Date())}` },
      { label: "Prepared by", value: preparer },
    ],
    blocks,
    footnote: "PR commission payout · check account details before paying.",
    filename: `silhouette-pr-payout-${monthKey(p.range.from)}`,
  };
}

const AGENTS: ReportSpec = {
  id: "agents",
  title: "PR agents report",
  short: "PR agents",
  tagline: "Referrals and commission per agent",
  icon: Handshake,
  description: "Referrals, revenue and commission per PR agent — optionally with every referred patient.",
  guide: "Choose the agents (all, or one hospital), the details to print, and whether to list each patient an agent referred with the amount billed and paid.",
  variants: [
    { id: "payout", label: "Monthly commission payout", description: "What to pay each agent for a month, grouped by bank (A–Z) with bank name, account name and number, phone, patients, rate and commission.", periodMode: "month" },
    { id: "performance", label: "Agent performance", description: "One line per agent with the columns you choose." },
    { id: "patients", label: "Agents with referred patients", description: "Each agent followed by the patients they referred: date, tests, billed, paid and commission." },
    { id: "monitor", label: "Activity monitor and visit plan", description: "Who is slipping, gone quiet, inactive or growing, with what to do, the last check-up, and a visit plan by hospital for the marketers.", dated: false },
  ],
  columns: { performance: AGENT_COLUMNS, payout: PAYOUT_COLUMNS },
  selects: [
    { id: "hospital", label: "Hospital", help: "Print every agent, only the agents of one hospital, or agents with no hospital.", options: hospitalOptions, default: "all", variants: ["performance", "patients"] },
    {
      id: "sort",
      label: "Order agents by",
      help: "How agents are listed in the report.",
      options: () => [
        { value: "referrals", label: "Most referrals first" },
        { value: "revenue", label: "Highest revenue first" },
        { value: "name", label: "Name A–Z" },
        { value: "id", label: "Agent ID" },
      ],
      default: "referrals",
      variants: ["performance", "patients"],
    },
  ],
  options: [
    { id: "zero", label: "Include agents with nothing to pay", help: "Adds agents who referred no patients this month (₦0).", default: false, variants: ["payout"] },
    { id: "bankSummary", label: "Add a total per bank at the end", help: "A short table of how much to send to each bank — handy when paying in bulk.", default: true, variants: ["payout"] },
    { id: "inactive", label: "Include agents with no referrals", help: "Adds every agent on record, even those who referred nobody in the period.", default: false, variants: ["performance"] },
    { id: "tests", label: "Show tests performed", help: "Lists the tests each referred patient had.", default: true, variants: ["patients"] },
    { id: "patientPhone", label: "Show patient phone numbers", help: "Adds the patient's phone (optional at registration — blank when not provided).", default: false, variants: ["patients"] },
  ],
  suggestPaper: (p) => (p.variant === "patients" || p.variant === "payout" ? { size: "A4", orientation: "landscape" } : paperFor(p.columns.length)),
  build(p, ctx) {
    if (p.variant === "monitor") return agentMonitorDoc(p, ctx);
    if (p.variant === "payout") return buildPayout(p, ctx);
    const list = agentAggregates(p, ctx);
    const blocks: Block[] = [];
    const c: Currency = AGENT_BRANCH?.currency ?? "NGN";
    const totals = { refs: sum(list, (x) => x.visits.length), billed: sum(list, (x) => x.billed), paid: sum(list, (x) => x.paid), commission: sum(list, (x) => x.commission) };
    blocks.push({
      kind: "summary",
      items: [
        { label: "Agents listed", value: formatCount(list.length) },
        { label: "Patients referred", value: formatCount(totals.refs) },
        { label: "Revenue generated", value: formatMoney(totals.billed, c) },
        { label: "Commission earned", value: formatMoney(totals.commission, c), note: rateSummary() },
      ],
    });

    if (p.variant === "performance") {
      const defs = AGENT_COLUMNS.filter((d) => p.columns.includes(d.id));
      const meta: Record<string, Column> = {
        id: { key: "id", label: "ID", weight: 0.5 },
        name: { key: "name", label: "PR agent", weight: 1.8 },
        phone: { key: "phone", label: "Phone", weight: 1.1 },
        hospital: { key: "hospital", label: "Hospital", weight: 1 },
        branch: { key: "branch", label: "Branch", weight: 0.8 },
        referrals: { key: "referrals", label: "Patients referred", align: "right", weight: 0.8 },
        billed: { key: "billed", label: "Revenue generated", align: "right", weight: 1.1 },
        paid: { key: "paid", label: "Paid by patients", align: "right", weight: 1.1 },
        commission: { key: "commission", label: "Commission", align: "right", weight: 1 },
        first: { key: "first", label: "First referral", weight: 1 },
        last: { key: "last", label: "Last referral", weight: 1 },
      };
      const cell = (id: string, x: AgentAgg): Cell => {
        const a = x.agent;
        switch (id) {
          case "id":
            return num(String(a.id), a.id);
          case "name":
            return txt(a.name);
          case "phone":
            return txt(hasPhone(a.phone) ? a.phone : "N/A", { tone: hasPhone(a.phone) ? undefined : "muted" });
          case "hospital":
            return txt(hospitalKey(a.hospital) || "No hospital", { tone: hospitalKey(a.hospital) ? undefined : "muted" });
          case "branch":
            return txt(AGENT_BRANCH?.name ?? "");
          case "referrals":
            return count(x.visits.length);
          case "billed":
            return money(x.billed, c);
          case "paid":
            return money(x.paid, c);
          case "commission":
            return money(x.commission, c);
          case "first":
            return txt(x.visits[0] ? day(x.visits[0].at) : "—");
          case "last":
            return txt(x.visits.length ? day(x.visits[x.visits.length - 1].at) : "—");
          default:
            return txt("");
        }
      };
      const totalCell = (id: string, i: number): Cell =>
        id === "referrals" ? count(totals.refs) : id === "billed" ? money(totals.billed, c) : id === "paid" ? money(totals.paid, c) : id === "commission" ? money(totals.commission, c) : i === 0 ? txt("Total", { b: true }) : txt("");
      blocks.push({
        kind: "table",
        title: "PR agent performance",
        columns: defs.map((d) => meta[d.id]),
        rows: list.map((x) => defs.map((d) => cell(d.id, x))),
        total: defs.map((d, i) => totalCell(d.id, i)),
        empty: "No PR agents match these choices.",
      });
    } else {
      for (const x of list) {
        const a = x.agent;
        blocks.push({
          kind: "heading",
          text: `${a.name} · #${a.id}`,
          sub: `${hospitalKey(a.hospital) || "No hospital"} · ${hasPhone(a.phone) ? a.phone : "Phone N/A"} · ${formatCount(x.visits.length)} patient${x.visits.length === 1 ? "" : "s"} · ${formatMoney(x.billed, c)} billed · ${formatMoney(x.commission, c)} commission at ${ratePct(x.rate)}`,
        });
        const cols: Column[] = [
          { key: "d", label: "Date", weight: 1 },
          { key: "p", label: "Patient", weight: 0.9 },
          ...(p.options.patientPhone ? [{ key: "ph", label: "Phone", weight: 1 }] : []),
          ...(p.options.tests ? [{ key: "t", label: "Tests performed", weight: 3 }] : []),
          { key: "b", label: "Billed", align: "right" as const, weight: 0.9 },
          { key: "pd", label: "Paid", align: "right" as const, weight: 0.9 },
          { key: "bal", label: "Balance", align: "right" as const, weight: 0.9 },
          { key: "cm", label: "Commission", align: "right" as const, weight: 0.9 },
        ];
        const lead = 2 + (p.options.patientPhone ? 1 : 0) + (p.options.tests ? 1 : 0);
        blocks.push({
          kind: "table",
          columns: cols,
          rows: x.visits.map((v) => [
            txt(`${day(v.at)} · ${formatTime(v.at)}`),
            txt(v.patientRef),
            ...(p.options.patientPhone ? [txt(v.phone ?? "Not provided", { tone: v.phone ? undefined : "muted" })] : []),
            ...(p.options.tests ? [txt(v.services.map((s) => s.name).join(", "))] : []),
            money(v.billed, c),
            money(v.paid, c),
            money(v.billed - v.paid, c, { tone: v.billed - v.paid > 0 ? "bad" : undefined }),
            money(v.billed * x.rate, c),
          ]),
          total: [txt("Total", { b: true }), ...Array.from({ length: lead - 1 }, () => txt("")), money(x.billed, c), money(x.paid, c), money(x.billed - x.paid, c), money(x.commission, c)],
          empty: "No referred patients in this period.",
        });
      }
      if (!list.length) blocks.push({ kind: "note", text: "No PR agents referred patients with these choices." });
    }
    blocks.push({ kind: "note", text: `Commission: ${rateSummary()}. Agent names, phones and hospitals are the real legacy records (with any edits made in the app).` });
    const hosp = p.selects.hospital ?? "all";
    return {
      title: "PR agents report",
      subtitle: `${AGENTS.variants.find((v) => v.id === p.variant)?.label} · ${hosp === "all" ? "All hospitals" : hosp === "__none" ? "No hospital assigned" : hosp} · ${rangeLabel(p.range)}`,
      meta: baseMeta(AGENTS, p, [{ label: "Hospital", value: hosp === "all" ? "All hospitals" : hosp === "__none" ? "No hospital assigned" : hosp }]),
      blocks,
      footnote: FOOT_DEMO,
      filename: fileName(AGENTS, p),
    };
  },
};

/* ─────────────── 3. Referring hospitals ─────────────── */

const HOSPITALS: ReportSpec = {
  id: "hospitals",
  title: "Referring hospitals report",
  short: "Hospitals",
  tagline: "Referrals and revenue per hospital",
  icon: Hospital,
  description: "Referrals, patients and revenue per hospital — optionally with each hospital's agents.",
  guide: "Shows, for the dates you pick, how many patients each hospital's PR agents referred and the money those patients generated.",
  variants: [
    { id: "summary", label: "Hospital summary", description: "One line per hospital: agents, referrals, patients, revenue and commission." },
    { id: "agents", label: "Hospitals with their agents", description: "Each hospital followed by its PR agents and what each referred." },
  ],
  options: [
    { id: "inactive", label: "Include hospitals with no referrals", help: "Lists every hospital, even those with no referred patients in the period.", default: false },
    { id: "unassigned", label: "Include agents with no hospital", help: "Adds a line for referrals from agents who have no hospital on record (never guessed into a hospital).", default: true },
  ],
  suggestPaper: (p) => (p.variant === "summary" ? { size: "A4", orientation: "landscape" } : { size: "A4", orientation: "portrait" }),
  build(p, ctx) {
    const aggs = agentAggregates({ ...p, options: { inactive: true }, selects: { hospital: "all", sort: "referrals" } }, ctx);
    const dir = buildHospitalDirectory(ctx.agents);
    const c: Currency = AGENT_BRANCH?.currency ?? "NGN";
    type H = { key: string; raw: string[]; agents: AgentAgg[] };
    const groups: H[] = dir.map((h) => ({ key: h.key, raw: h.rawVariants, agents: aggs.filter((a) => hospitalKey(a.agent.hospital) === h.key) }));
    if (p.options.unassigned) groups.push({ key: "No hospital assigned", raw: [], agents: aggs.filter((a) => !hospitalKey(a.agent.hospital)) });
    const stat = (h: H) => {
      const visits = h.agents.flatMap((a) => a.visits);
      return { refs: visits.length, patients: new Set(visits.map((v) => v.patientRef)).size, billed: sum(visits, (v) => v.billed), commission: sum(h.agents, (a) => a.commission), active: h.agents.filter((a) => a.visits.length > 0).length };
    };
    const rows = groups
      .map((h) => ({ h, s: stat(h) }))
      .filter((x) => p.options.inactive || x.s.refs > 0)
      .sort((a, b) => b.s.refs - a.s.refs || b.s.billed - a.s.billed || a.h.key.localeCompare(b.h.key));
    const totalBilled = sum(rows, (x) => x.s.billed);
    const blocks: Block[] = [
      {
        kind: "summary",
        items: [
          { label: "Hospitals listed", value: formatCount(rows.filter((x) => x.h.raw.length).length) },
          { label: "Referrals", value: formatCount(sum(rows, (x) => x.s.refs)) },
          { label: "Patients", value: formatCount(sum(rows, (x) => x.s.patients)) },
          { label: "Revenue generated", value: formatMoney(totalBilled, c) },
        ],
      },
    ];
    if (p.variant === "summary") {
      blocks.push({
        kind: "table",
        title: "Referrals by hospital",
        columns: [
          { key: "h", label: "Hospital", weight: 1.2 },
          { key: "r", label: "Recorded as", weight: 1.4 },
          { key: "a", label: "PR agents", align: "right", weight: 0.7 },
          { key: "aa", label: "Active agents", align: "right", weight: 0.7 },
          { key: "rf", label: "Referrals", align: "right", weight: 0.7 },
          { key: "pt", label: "Patients", align: "right", weight: 0.7 },
          { key: "b", label: "Revenue", align: "right", weight: 1.1 },
          { key: "cm", label: "Commission", align: "right", weight: 1 },
          { key: "sh", label: "Share", align: "right", weight: 0.6 },
        ],
        rows: rows.map(({ h, s }) => [txt(h.key, { b: true }), txt(h.raw.join(", ") || "—", { tone: "muted" }), count(h.agents.length), count(s.active), count(s.refs), count(s.patients), money(s.billed, c), money(s.commission, c), pct(s.billed, totalBilled)]),
        total: [txt("Total", { b: true }), txt(""), count(sum(rows, (x) => x.h.agents.length)), count(sum(rows, (x) => x.s.active)), count(sum(rows, (x) => x.s.refs)), count(sum(rows, (x) => x.s.patients)), money(totalBilled, c), money(sum(rows, (x) => x.s.commission), c), txt("100%")],
        empty: "No hospitals had referrals in this period.",
      });
    } else {
      for (const { h, s } of rows) {
        blocks.push({ kind: "heading", text: h.key, sub: `${h.raw.length ? `Recorded as ${h.raw.join(", ")} · ` : ""}${formatCount(h.agents.length)} agents · ${formatCount(s.refs)} referrals · ${formatCount(s.patients)} patients · ${formatMoney(s.billed, c)}` });
        const list = h.agents.filter((a) => p.options.inactive || a.visits.length > 0).sort((a, b) => b.visits.length - a.visits.length || a.agent.name.localeCompare(b.agent.name));
        blocks.push({
          kind: "table",
          columns: [
            { key: "n", label: "PR agent", weight: 2 },
            { key: "ph", label: "Phone", weight: 1.2 },
            { key: "r", label: "Referrals", align: "right", weight: 0.8 },
            { key: "b", label: "Revenue", align: "right", weight: 1.1 },
            { key: "cm", label: "Commission", align: "right", weight: 1 },
          ],
          rows: list.map((a) => [txt(a.agent.name), txt(hasPhone(a.agent.phone) ? a.agent.phone : "N/A", { tone: hasPhone(a.agent.phone) ? undefined : "muted" }), count(a.visits.length), money(a.billed, c), money(a.commission, c)]),
          total: [txt("Total", { b: true }), txt(""), count(s.refs), money(s.billed, c), money(s.commission, c)],
          empty: "No agents referred patients in this period.",
        });
      }
    }
    blocks.push({ kind: "note", text: "Hospitals come from the PR agents' recorded assignments; spellings are kept exactly as recorded (\"Recorded as\") and are never merged by guesswork." });
    return { title: "Referring hospitals report", subtitle: `${HOSPITALS.variants.find((v) => v.id === p.variant)?.label} · ${rangeLabel(p.range)}`, meta: baseMeta(HOSPITALS, p), blocks, footnote: FOOT_DEMO, filename: fileName(HOSPITALS, p) };
  },
};

/* ─────────────── 4. Diagnostic services ─────────────── */

const SERVICES_SPEC: ReportSpec = {
  id: "services",
  title: "Diagnostic services report",
  short: "Services",
  tagline: "Tests performed and revenue",
  icon: FlaskConical,
  description: "Tests performed and revenue per service or category — or the full price list.",
  guide: "See which tests were done and what they earned, grouped by category if you like, or print the current catalogue price list.",
  variants: [
    { id: "service", label: "By service", description: "Every test with its price, times performed and revenue." },
    { id: "category", label: "By category", description: "One line per category with totals and its top test." },
    { id: "prices", label: "Catalogue price list", description: "Every service and its price — no dates needed.", dated: false },
  ],
  options: [
    { id: "unused", label: "Include tests not performed", help: "Lists every service in the catalogue, even those not done in the period.", default: false, variants: ["service"] },
    { id: "group", label: "Group by category", help: "Starts a new section for each category with its own totals.", default: true, variants: ["service", "prices"] },
  ],
  suggestPaper: () => ({ size: "A4", orientation: "portrait" }),
  build(p) {
    const ids = branchIdsOf(p);
    const c = curOf(ids[0]);
    const blocks: Block[] = [];
    const rank = new Map(serviceRanking(ids, p.range).map((r) => [r.id, r]));
    const performed = SERVICES.map((s) => ({ s, count: rank.get(s.id)?.count ?? 0, revenue: rank.get(s.id)?.revenue[c] ?? 0 }));
    const totalRev = sum(performed, (x) => x.revenue);
    const totalCount = sum(performed, (x) => x.count);

    if (p.variant === "prices") {
      const items = CATALOGUE_INVENTORY.slice().sort((a, b) => a.catalogueCategory.localeCompare(b.catalogueCategory) || a.name.localeCompare(b.name));
      const cols: Column[] = [
        { key: "n", label: "Service", weight: 3 },
        ...(p.options.group ? [] : [{ key: "c", label: "Category", weight: 1.2 }]),
        { key: "id", label: "Code", align: "right" as const, weight: 0.6 },
        { key: "p", label: "Price", align: "right" as const, weight: 1 },
      ];
      const row = (i: (typeof items)[number]): Cell[] => [txt(i.name), ...(p.options.group ? [] : [txt(i.catalogueCategory)]), num(`#${i.id}`, i.id), i.price === null ? txt("No price on file", { tone: "muted" }) : money(i.price, c)];
      blocks.push({ kind: "summary", items: [{ label: "Services", value: formatCount(items.length) }, { label: "Categories", value: formatCount(new Set(items.map((i) => i.catalogueCategory)).size) }, { label: "Without a price", value: formatCount(items.filter((i) => i.price === null).length) }] });
      if (p.options.group) {
        for (const cat of [...new Set(items.map((i) => i.catalogueCategory))]) {
          const list = items.filter((i) => i.catalogueCategory === cat);
          blocks.push({ kind: "table", title: `${cat} · ${list.length} service${list.length === 1 ? "" : "s"}`, columns: cols, rows: list.map(row) });
        }
      } else blocks.push({ kind: "table", title: "Price list", columns: cols, rows: items.map(row) });
      return { title: "Catalogue price list", subtitle: `${items.length} services · prices in ${c}`, meta: baseMeta(SERVICES_SPEC, p), blocks, footnote: "Prices from the Silhouette catalogue (owner category rules applied).", filename: fileName(SERVICES_SPEC, p) };
    }

    blocks.push({ kind: "summary", items: [{ label: "Tests performed", value: formatCount(totalCount) }, { label: "Revenue billed", value: formatMoney(totalRev, c) }, { label: "Services used", value: formatCount(performed.filter((x) => x.count > 0).length) }, { label: "Average per test", value: totalCount ? formatMoney(totalRev / totalCount, c) : "—" }] });

    if (p.variant === "category") {
      const cats = [...new Set(SERVICES.map((s) => s.category))].map((cat) => {
        const list = performed.filter((x) => x.s.category === cat);
        const top = list.slice().sort((a, b) => b.count - a.count)[0];
        return { cat, offered: list.length, count: sum(list, (x) => x.count), revenue: sum(list, (x) => x.revenue), top };
      });
      cats.sort((a, b) => b.revenue - a.revenue);
      blocks.push({
        kind: "table",
        title: "Revenue by category",
        columns: [
          { key: "c", label: "Category", weight: 1.3 },
          { key: "o", label: "Services offered", align: "right", weight: 0.8 },
          { key: "n", label: "Tests performed", align: "right", weight: 0.8 },
          { key: "r", label: "Revenue", align: "right", weight: 1.1 },
          { key: "s", label: "Share", align: "right", weight: 0.6 },
          { key: "t", label: "Most performed test", weight: 2 },
        ],
        rows: cats.map((x) => [txt(x.cat, { b: true }), count(x.offered), count(x.count), money(x.revenue, c), pct(x.revenue, totalRev), txt(x.top && x.top.count > 0 ? `${x.top.s.name} (${formatCount(x.top.count)})` : "—", { tone: x.top && x.top.count > 0 ? undefined : "muted" })]),
        total: [txt("Total", { b: true }), count(SERVICES.length), count(totalCount), money(totalRev, c), txt("100%"), txt("")],
      });
    } else {
      const list = performed.filter((x) => p.options.unused || x.count > 0).sort((a, b) => b.revenue - a.revenue || a.s.name.localeCompare(b.s.name));
      const cols: Column[] = [
        { key: "n", label: "Service", weight: 2.6 },
        ...(p.options.group ? [] : [{ key: "c", label: "Category", weight: 1 }]),
        { key: "p", label: "Price", align: "right" as const, weight: 0.9 },
        { key: "k", label: "Times performed", align: "right" as const, weight: 0.8 },
        { key: "r", label: "Revenue", align: "right" as const, weight: 1 },
        { key: "s", label: "Share", align: "right" as const, weight: 0.6 },
      ];
      const row = (x: (typeof list)[number]): Cell[] => [txt(x.s.name), ...(p.options.group ? [] : [txt(x.s.category)]), money(servicePrice(x.s, c), c), count(x.count), money(x.revenue, c), pct(x.revenue, totalRev)];
      if (p.options.group) {
        const cats = [...new Set(list.map((x) => x.s.category))].sort((a, b) => sum(list.filter((x) => x.s.category === b), (x) => x.revenue) - sum(list.filter((x) => x.s.category === a), (x) => x.revenue));
        for (const cat of cats) {
          const part = list.filter((x) => x.s.category === cat);
          blocks.push({ kind: "table", title: cat, subtitle: `${part.length} services`, columns: cols, rows: part.map(row), total: [txt("Category total", { b: true }), txt(""), count(sum(part, (x) => x.count)), money(sum(part, (x) => x.revenue), c), pct(sum(part, (x) => x.revenue), totalRev)] });
        }
      } else blocks.push({ kind: "table", title: "Revenue by service", columns: cols, rows: list.map(row), total: [txt("Total", { b: true }), txt(""), txt(""), count(totalCount), money(totalRev, c), txt("100%")] });
      if (!list.length) blocks.push({ kind: "note", text: "No tests were performed in this period." });
    }
    return { title: "Diagnostic services report", subtitle: `${SERVICES_SPEC.variants.find((v) => v.id === p.variant)?.label} · ${branchLabel(p)} · ${rangeLabel(p.range)}`, meta: baseMeta(SERVICES_SPEC, p), blocks, footnote: FOOT_DEMO, filename: fileName(SERVICES_SPEC, p) };
  },
};

/* ─────────────── 5. Payments & balances ─────────────── */

const PAYMENTS: ReportSpec = {
  id: "payments",
  title: "Payments & balances report",
  short: "Payments",
  tagline: "Payments, recoveries and debts",
  icon: Wallet,
  description: "Payments received, by method, balances recovered and who still owes.",
  guide: "Print every payment received, a payment-method summary, the balances patients paid back, or the list of bills still owed on the end date.",
  variants: [
    { id: "received", label: "Payments received", description: "Every payment: date, patient, type, method and amount." },
    { id: "methods", label: "Payment methods summary", description: "Totals per method (cash, POS, transfer)." },
    { id: "recovered", label: "Balances recovered", description: "Older balances patients paid back, and whether each bill is now cleared." },
    { id: "outstanding", label: "Outstanding balances", description: "Every bill still owed on the end date, oldest or largest first.", periodNote: "Balances are shown as they stood at the end date." },
  ],
  options: [
    { id: "details", label: "Show details column", help: "Adds the tests paid for or the original visit a repayment was for.", default: false, variants: ["received"] },
    { id: "byAge", label: "Group by age of debt", help: "Splits outstanding bills into 0–30, 31–60, 61–90 and over 90 days.", default: false, variants: ["outstanding"] },
    { id: "patientPhone", label: "Show patient phone numbers", help: "Useful for follow-up calls (blank when not provided at registration).", default: true, variants: ["outstanding"] },
  ],
  selects: [
    {
      id: "order",
      label: "Order bills by",
      help: "Largest balances first, or the oldest debts first.",
      options: () => [
        { value: "largest", label: "Largest balance first" },
        { value: "oldest", label: "Oldest first" },
      ],
      default: "largest",
      variants: ["outstanding"],
    },
  ],
  suggestPaper: (p) => (p.variant === "methods" ? { size: "A4", orientation: "portrait" } : { size: "A4", orientation: "landscape" }),
  build(p) {
    const ids = branchIdsOf(p);
    const multi = ids.length > 1;
    const c0 = curOf(ids[0]);
    const blocks: Block[] = [];
    const bcol = multi ? [{ key: "br", label: "Branch", weight: 0.9 }] : [];
    const bcell = (id: string) => (multi ? [txt(getBranch(id)?.name ?? "")] : []);

    if (p.variant === "received" || p.variant === "recovered" || p.variant === "methods") {
      const entries = ledger(ids, p.range)
        .filter((e) => e.direction === "in" && (p.variant !== "recovered" || e.kind === "recovery"))
        .reverse();
      if (p.variant === "methods") {
        for (const id of ids) {
          const list = entries.filter((e) => e.branchId === id);
          const total = sum(list, (e) => e.amount);
          const c = curOf(id);
          blocks.push({
            kind: "table",
            title: multi ? `${getBranch(id)?.name} branch` : "Payments by method",
            columns: [
              { key: "m", label: "Method", weight: 1.2 },
              { key: "n", label: "Payments", align: "right" },
              { key: "a", label: "Amount", align: "right", weight: 1.2 },
              { key: "s", label: "Share", align: "right", weight: 0.7 },
              { key: "v", label: "Average", align: "right" },
            ],
            rows: PAYMENT_METHODS.map((m) => {
              const part = list.filter((e) => e.method === m);
              const amt = sum(part, (e) => e.amount);
              return [txt(m, { b: true }), count(part.length), money(amt, c), pct(amt, total), part.length ? money(amt / part.length, c) : txt("—")];
            }),
            total: [txt("Total", { b: true }), count(list.length), money(total, c), txt("100%"), list.length ? money(total / list.length, c) : txt("—")],
          });
          const atVisit = list.filter((e) => e.kind === "visit");
          blocks.push({ kind: "summary", items: [{ label: "Paid at visit", value: formatMoney(sum(atVisit, (e) => e.amount), c), note: `${formatCount(atVisit.length)} payments` }, { label: "Balances recovered", value: formatMoney(total - sum(atVisit, (e) => e.amount), c), note: `${formatCount(list.length - atVisit.length)} repayments` }] });
        }
      } else {
        const recovered = p.variant === "recovered";
        const details = !!p.options.details;
        const cols: Column[] = recovered
          ? [{ key: "d", label: "Date & time", weight: 1.2 }, { key: "r", label: "Reference", weight: 1.3 }, ...bcol, { key: "p", label: "Patient", weight: 0.9 }, { key: "v", label: "For visit", weight: 1.3 }, { key: "vd", label: "Visit date", weight: 1 }, { key: "m", label: "Method", weight: 0.8 }, { key: "st", label: "Bill status", weight: 0.9 }, { key: "a", label: "Amount", align: "right" as const, weight: 1 }]
          : [{ key: "d", label: "Date & time", weight: 1.2 }, { key: "r", label: "Reference", weight: 1.3 }, ...bcol, { key: "p", label: "Patient", weight: 0.9 }, { key: "t", label: "Type", weight: 0.9 }, ...(details ? [{ key: "x", label: "Details", weight: 2.6 }] : []), { key: "m", label: "Method", weight: 0.8 }, { key: "by", label: "Recorded by", weight: 1 }, { key: "a", label: "Amount", align: "right" as const, weight: 1 }];
        const rows = entries.map((e: LedgerEntry) => {
          const v = e.visit!;
          const when = txt(`${day(e.at)} · ${formatTime(e.at)}`);
          return recovered
            ? [when, txt(e.id), ...bcell(e.branchId), txt(v.patientRef), txt(v.id), txt(day(v.at)), txt(e.method ?? "—"), txt(e.detail.includes("cleared") ? "Cleared" : "Part paid", { tone: e.detail.includes("cleared") ? "good" : undefined }), money(e.amount, curOf(e.branchId))]
            : [when, txt(e.id), ...bcell(e.branchId), txt(v.patientRef), txt(e.kind === "visit" ? "At visit" : "Recovered"), ...(details ? [txt(e.detail)] : []), txt(e.method ?? "—"), txt(e.recordedBy), money(e.amount, curOf(e.branchId))];
        });
        const total = sum(entries, (e) => e.amount);
        blocks.push({ kind: "summary", items: [{ label: recovered ? "Repayments" : "Payments", value: formatCount(entries.length) }, { label: "Total received", value: formatMoney(total, c0) }, ...(recovered ? [{ label: "Bills cleared", value: formatCount(entries.filter((e) => e.detail.includes("cleared")).length) }] : [])] });
        blocks.push({ kind: "table", title: recovered ? "Balances recovered" : "Payments received", subtitle: "Oldest first", columns: cols, rows, total: [...cols.slice(0, -1).map((_, i) => (i === 0 ? txt("Total", { b: true }) : txt(""))), money(total, c0)], empty: "No payments in this period." });
      }
    }

    if (p.variant === "outstanding") {
      const phone = !!p.options.patientPhone;
      const all = ids.flatMap((id) => openBalances(id, p.range.to).map((b) => ({ ...b, branchId: id })));
      all.sort((a, b) => ((p.selects.order ?? "largest") === "oldest" ? b.ageDays - a.ageDays : b.remaining - a.remaining));
      const cols: Column[] = [{ key: "p", label: "Patient", weight: 0.9 }, ...(phone ? [{ key: "ph", label: "Phone", weight: 1 }] : []), ...bcol, { key: "v", label: "Visit", weight: 1.3 }, { key: "vd", label: "Visit date", weight: 1 }, { key: "age", label: "Age", align: "right" as const, weight: 0.6 }, { key: "b", label: "Billed", align: "right" as const, weight: 1 }, { key: "o", label: "Owed after visit", align: "right" as const, weight: 1 }, { key: "r", label: "Recovered since", align: "right" as const, weight: 1 }, { key: "s", label: "Still owed", align: "right" as const, weight: 1 }];
      const row = (b: (typeof all)[number]): Cell[] => {
        const c = curOf(b.branchId);
        return [txt(b.visit.patientRef, { b: true }), ...(phone ? [txt(b.visit.phone ?? "Not provided", { tone: b.visit.phone ? undefined : "muted" })] : []), ...bcell(b.branchId), txt(b.visit.id), txt(day(b.visit.at)), num(`${b.ageDays} d`, b.ageDays), money(b.visit.billed, c), money(b.owed, c), b.repaid ? money(b.repaid, c) : txt("—"), money(b.remaining, c, { b: true, tone: "bad" })];
      };
      const tot = (list: typeof all): Cell[] => [txt("Total", { b: true }), ...Array.from({ length: cols.length - 5 }, () => txt("")), money(sum(list, (x) => x.visit.billed), c0), money(sum(list, (x) => x.owed), c0), money(sum(list, (x) => x.repaid), c0), money(sum(list, (x) => x.remaining), c0)];
      blocks.push({ kind: "summary", items: [{ label: "Open bills", value: formatCount(all.length) }, { label: "Still owed", value: formatMoney(sum(all, (x) => x.remaining), c0), tone: "bad" }, { label: "Already recovered on these bills", value: formatMoney(sum(all, (x) => x.repaid), c0) }, { label: "Oldest debt", value: all.length ? `${Math.max(...all.map((x) => x.ageDays))} days` : "—" }] });
      if (p.options.byAge) {
        for (const [label, lo, hi] of [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, 99999]] as const) {
          const part = all.filter((x) => x.ageDays >= lo && x.ageDays <= hi);
          if (part.length) blocks.push({ kind: "table", title: `${label} · ${formatCount(part.length)} bills`, columns: cols, rows: part.map(row), total: tot(part) });
        }
        if (!all.length) blocks.push({ kind: "note", text: "No outstanding balances on this date." });
      } else blocks.push({ kind: "table", title: `Bills still owed on ${day(p.range.to)}`, columns: cols, rows: all.map(row), total: tot(all), empty: "No outstanding balances on this date." });
      blocks.push({ kind: "note", text: "Balances are recovered oldest first. A bill disappears from this list once it is fully paid." });
    }

    return { title: "Payments & balances report", subtitle: `${PAYMENTS.variants.find((v) => v.id === p.variant)?.label} · ${branchLabel(p)} · ${p.variant === "outstanding" ? `as of ${day(p.range.to)}` : rangeLabel(p.range)}`, meta: baseMeta(PAYMENTS, p), blocks, footnote: FOOT_DEMO, filename: fileName(PAYMENTS, p) };
  },
};

/* ─────────────── 6. Staff activity (provisional) ─────────────── */

const STAFF: ReportSpec = {
  id: "staff",
  title: "Staff report",
  short: "Staff",
  tagline: "Staff, salaries & activity",
  icon: UsersRound,
  description: "Every staff member on record, their monthly salaries and bank details, and front-desk activity by role.",
  guide: "Staff directory and Salaries & bank details list everyone in Staff Management, including staff who don't use STANLEY (radiographers, lab, security …). Salaries are the monthly pay set on each profile, grouped by bank for paying. Activity reports group front-desk work by role.",
  variants: [
    { id: "salaries", label: "Salaries & bank details", description: "Monthly pay for every staff member: salary, allowances, deductions and net pay, with bank name, account name and number. Totals per bank.", dated: false },
    { id: "directory", label: "Staff directory", description: "Everyone who works at the branch: role, department, whether they use STANLEY, status, start date and contacts.", dated: false },
    { id: "roles", label: "Activity by role", description: "Visits processed and money collected at the front desk, per role." },
    { id: "daily", label: "Daily front-desk activity", description: "One line per day: visits processed by each role and money collected." },
  ],
  options: [
    { id: "left", label: "Include staff who have left", help: "Adds people whose status is Left (kept for history).", default: false, variants: ["salaries", "directory"] },
    { id: "bankSummary", label: "Add a total per bank at the end", help: "How much to send to each bank, handy when paying salaries in bulk.", default: true, variants: ["salaries"] },
  ],
  suggestPaper: (p) => ({ size: "A4", orientation: p.variant === "salaries" || p.variant === "directory" ? "landscape" : "portrait" }),
  build(p, ctx) {
    const ids = branchIdsOf(p);
    const c0 = curOf(ids[0]);
    if (p.variant === "salaries" || p.variant === "directory") return staffRecordsDoc(p, ctx, ids);
    const visits = patientVisits(ids, p.range);
    const blocks: Block[] = [];
    const roles = ["Receptionist", "Branch Manager"] as const;
    if (p.variant === "roles") {
      const total = sum(visits, (v) => v.paid);
      blocks.push({
        kind: "table",
        title: "Front-desk activity by role",
        columns: [
          { key: "r", label: "Role", weight: 1.4 },
          { key: "v", label: "Visits processed", align: "right" },
          { key: "p", label: "Patients", align: "right" },
          { key: "t", label: "Tests billed", align: "right" },
          { key: "c", label: "Collected at visit", align: "right", weight: 1.2 },
          { key: "s", label: "Share", align: "right", weight: 0.6 },
        ],
        rows: roles.map((r) => {
          const list = visits.filter((v) => v.processedBy.role === r);
          const amt = sum(list, (v) => v.paid);
          return [txt(r, { b: true }), count(list.length), count(new Set(list.map((v) => v.patientRef)).size), count(sum(list, (v) => v.services.length)), money(amt, c0), pct(amt, total)];
        }),
        total: [txt("Total", { b: true }), count(visits.length), count(new Set(visits.map((v) => v.patientRef)).size), count(sum(visits, (v) => v.services.length)), money(total, c0), txt("100%")],
      });
    } else {
      const byDay = new Map<string, PatientVisit[]>();
      for (const v of visits) byDay.set(isoDate(v.at), [...(byDay.get(isoDate(v.at)) ?? []), v]);
      const rows = [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, list]) => {
          const d = list[0].at;
          return [txt(`${d.toLocaleDateString("en-GB", { weekday: "short" })} ${day(d)}`), count(list.filter((v) => v.processedBy.role === "Receptionist").length), count(list.filter((v) => v.processedBy.role === "Branch Manager").length), count(list.length), money(sum(list, (v) => v.paid), c0)];
        });
      blocks.push({
        kind: "table",
        title: "Daily front-desk activity",
        columns: [
          { key: "d", label: "Date", weight: 1.4 },
          { key: "r", label: "By receptionists", align: "right" },
          { key: "m", label: "By branch managers", align: "right" },
          { key: "t", label: "Total visits", align: "right" },
          { key: "c", label: "Collected at visit", align: "right", weight: 1.2 },
        ],
        rows,
        total: [txt("Total", { b: true }), count(visits.filter((v) => v.processedBy.role === "Receptionist").length), count(visits.filter((v) => v.processedBy.role === "Branch Manager").length), count(visits.length), money(sum(visits, (v) => v.paid), c0)],
        empty: "No visits in this period.",
      });
    }
    blocks.push({ kind: "note", text: "Staff records were not part of the legacy export. Once staff accounts exist, this report will show each person by name." });
    return { title: "Staff activity report", subtitle: `${STAFF.variants.find((v) => v.id === p.variant)?.label} · ${branchLabel(p)} · ${rangeLabel(p.range)}`, meta: baseMeta(STAFF, p), blocks, footnote: FOOT_DEMO, filename: fileName(STAFF, p) };
  },
};

/** PR agent activity monitor and visit plan (owner, 2026-11-26), from services/agentMonitor. */
function agentMonitorDoc(p: ReportParams, ctx: ReportCtx): ReportDoc {
  const ids = branchIdsOf(p);
  const list = ids.flatMap((id) => agentHealth(id, ctx.agents, checkUpsNow()));
  const blocks: Block[] = [];
  const n = (s: AgentStatus) => list.filter((a) => a.status === s).length;
  blocks.push({ kind: "summary", items: [{ label: "Check up on now", value: formatCount(list.filter((a) => a.due).length), tone: "bad" }, { label: "Slipping", value: formatCount(n("slipping")) }, { label: "Gone quiet", value: formatCount(n("quiet")) }, { label: "Inactive", value: formatCount(n("inactive")) }, { label: "Growing or top", value: formatCount(n("rising") + n("top")) }] });
  const cols: Column[] = [{ key: "a", label: "PR agent", weight: 1.3 }, { key: "h", label: "Hospital", weight: 1 }, { key: "ph", label: "Phone", weight: 0.9 }, { key: "l", label: "Last 4 weeks", align: "right", weight: 0.7 }, { key: "p", label: "4 weeks before", align: "right", weight: 0.7 }, { key: "d", label: "Last referral", weight: 0.8 }, { key: "w", label: "What to do", weight: 2.2 }, { key: "c", label: "Last check-up", weight: 1.1 }];
  const row = (a: AgentHealth): Cell[] => [txt(a.agent.name, { b: true }), txt(a.hospital), txt(hasPhone(a.agent.phone) ? a.agent.phone : "—", { tone: hasPhone(a.agent.phone) ? undefined : "muted" }), count(a.last28), count(a.prev28), txt(a.lastAt ? day(a.lastAt) : "Never", { tone: a.lastAt ? undefined : "muted" }), txt(a.action), txt(a.lastCheck ? `${a.lastCheck.kind}, ${day(new Date(a.lastCheck.at))}: ${a.lastCheck.outcome}` : "None yet", { tone: a.lastCheck ? undefined : "muted" })];
  // The visit plan: agents to see now, grouped by hospital (most agents first).
  const due = list.filter((a) => a.due);
  const byHosp = new Map<string, AgentHealth[]>();
  for (const a of due) byHosp.set(a.hospital, [...(byHosp.get(a.hospital) ?? []), a]);
  for (const [h, agents] of [...byHosp.entries()].sort((x, y) => y[1].length - x[1].length)) blocks.push({ kind: "table", title: `Visit plan · ${h}`, subtitle: `${agents.length} agent${agents.length === 1 ? "" : "s"} to see`, columns: cols, rows: agents.map(row) });
  if (!due.length) blocks.push({ kind: "note", text: "Nobody to check up on now: every slipping or quiet agent has a recent check-up." });
  for (const s of ["inactive", "never", "rising", "top"] as AgentStatus[]) {
    const part = list.filter((a) => a.status === s && !a.due);
    if (part.length) blocks.push({ kind: "table", title: `${AGENT_STATUS_LABEL[s]} · ${formatCount(part.length)}`, subtitle: AGENT_STATUS_HINT[s], columns: cols, rows: part.slice(0, 200).map(row) });
  }
  blocks.push({ kind: "note", text: "Log each visit or call in PR Management (PR agent monitor) so the branch knows; the agent leaves the check-up list until the next date." });
  return { title: "PR agent activity monitor", subtitle: `${branchLabel(p)} · ${day(new Date())}`, meta: baseMeta(AGENTS, p), blocks, footnote: "Last 4 weeks compared with the 4 weeks before. Statuses: services/agentMonitor.", filename: fileName(AGENTS, p) };
}

/** Staff directory and Salaries & bank details (owner, 2026-11-26): everyone on record in Staff Management. */
function staffRecordsDoc(p: ReportParams, ctx: ReportCtx, ids: string[]): ReportDoc {
  const c0 = curOf(ids[0]!);
  const multi = ids.length > 1;
  const people = (ctx.staff ?? [])
    .filter((x) => ids.includes(x.branchId) && (p.options.left || x.status !== "Left"))
    .sort((a, b) => (multi ? a.branchId.localeCompare(b.branchId) : 0) || a.name.localeCompare(b.name));
  const bcol: Column[] = multi ? [{ key: "br", label: "Branch", weight: 0.8 }] : [];
  const bcell = (x: StaffRecord): Cell[] => (multi ? [txt(getBranch(x.branchId)?.name ?? x.branchId)] : []);
  const blocks: Block[] = [];
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (p.variant === "directory") {
    blocks.push({ kind: "summary", items: [{ label: "Staff", value: formatCount(people.length) }, { label: "Use STANLEY", value: formatCount(people.filter(usesApp).length) }, { label: "Records only", value: formatCount(people.filter((x) => !usesApp(x)).length) }, { label: "Active", value: formatCount(people.filter((x) => x.status === "Active").length) }] });
    blocks.push({
      kind: "table",
      title: "Staff directory",
      columns: [{ key: "n", label: "Name", weight: 1.3 }, { key: "id", label: "Staff ID", weight: 0.7 }, ...bcol, { key: "r", label: "Role", weight: 1.2 }, { key: "d", label: "Department", weight: 0.9 }, { key: "a", label: "Uses STANLEY", weight: 0.7 }, { key: "s", label: "Status", weight: 0.6 }, { key: "e", label: "Employment", weight: 0.7 }, { key: "st", label: "Started", weight: 0.8 }, { key: "ph", label: "Phone", weight: 1 }, { key: "em", label: "Email", weight: 1.3 }],
      rows: people.map((x) => [txt(x.name, { b: true }), txt(x.id), ...bcell(x), txt(x.role), txt(x.department ?? "—"), txt(usesApp(x) ? "Yes" : "No"), txt(x.status, { tone: x.status === "Active" ? "good" : undefined }), txt(x.employment), txt(x.startDate ? day(new Date(`${x.startDate}T00:00:00`)) : "—"), txt(x.phone || "—", { tone: x.phone ? undefined : "muted" }), txt(x.email || "—", { tone: x.email ? undefined : "muted" })]),
      empty: "No staff on record.",
    });
    return { title: "Staff directory", subtitle: `${branchLabel(p)} · as of ${day(new Date())}`, meta: baseMeta(STAFF, p), blocks, footnote: "From Staff Management. Includes staff who do not use STANLEY (records only).", filename: fileName(STAFF, p) };
  }
  const paid = people.filter((x) => x.pay);
  const sumOf = (list: readonly StaffRecord[], k: "salary" | "allowances" | "deductions" | "net") => sum([...list], (x) => (k === "net" ? netPay(x.pay) : (x.pay?.[k] ?? 0)));
  blocks.push({ kind: "summary", items: [{ label: "Staff paid", value: formatCount(paid.length) }, { label: "Basic salaries", value: formatMoney(sumOf(paid, "salary"), c0) }, { label: "Allowances", value: formatMoney(sumOf(paid, "allowances"), c0) }, { label: "Deductions", value: formatMoney(sumOf(paid, "deductions"), c0) }, { label: "Net pay to send", value: formatMoney(sumOf(paid, "net"), c0) }] });
  const cols: Column[] = [{ key: "n", label: "Name", weight: 1.3 }, ...bcol, { key: "r", label: "Role", weight: 1.1 }, { key: "b", label: "Bank", weight: 0.9 }, { key: "an", label: "Account name", weight: 1.2 }, { key: "ac", label: "Account number", weight: 1 }, { key: "s", label: "Salary", align: "right", weight: 0.9 }, { key: "al", label: "Allowances", align: "right", weight: 0.9 }, { key: "de", label: "Deductions", align: "right", weight: 0.9 }, { key: "ne", label: "Net pay", align: "right", weight: 0.9 }];
  // Grouped by bank (A–Z), like the PR commission payout, so each bank's transfers are together.
  const byBank = [...paid].sort((a, b) => (a.bank?.bankName ?? "~").localeCompare(b.bank?.bankName ?? "~") || a.name.localeCompare(b.name));
  blocks.push({
    kind: "table",
    title: `Salaries for ${month}`,
    subtitle: "Grouped by bank",
    columns: cols,
    rows: byBank.map((x) => [txt(x.name, { b: true }), ...bcell(x), txt(x.role), txt(x.bank?.bankName ?? "No bank details", { tone: x.bank ? undefined : "bad" }), txt(x.bank?.accountName ?? "—"), txt(x.bank?.accountNumber ?? "—"), money(x.pay!.salary, c0), money(x.pay!.allowances ?? 0, c0), money(x.pay!.deductions ?? 0, c0), money(netPay(x.pay), c0, { b: true })]),
    total: [txt("Total", { b: true }), ...Array.from({ length: cols.length - 5 }, () => txt("")), money(sumOf(paid, "salary"), c0), money(sumOf(paid, "allowances"), c0), money(sumOf(paid, "deductions"), c0), money(sumOf(paid, "net"), c0)],
    empty: "No salaries on record. Add them on each staff profile (Staff Management → Pay & bank).",
  });
  if (p.options.bankSummary && paid.length) {
    const banks = new Map<string, StaffRecord[]>();
    for (const x of paid) banks.set(x.bank?.bankName ?? "No bank details", [...(banks.get(x.bank?.bankName ?? "No bank details") ?? []), x]);
    blocks.push({ kind: "table", title: "Total per bank", columns: [{ key: "b", label: "Bank", weight: 1.4 }, { key: "c", label: "Staff", align: "right" }, { key: "t", label: "Net pay to send", align: "right", weight: 1.2 }], rows: [...banks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([b, list]) => [txt(b, { b: true }), count(list.length), money(sumOf(list, "net"), c0)]), total: [txt("Total", { b: true }), count(paid.length), money(sumOf(paid, "net"), c0)] });
  }
  const missing = people.filter((x) => !x.pay || !x.bank);
  if (missing.length) blocks.push({ kind: "note", text: `Missing pay or bank details: ${missing.map((x) => x.name).join(", ")}. Add them on their profiles in Staff Management.` });
  return { title: "Salaries & bank details", subtitle: `${branchLabel(p)} · ${month}`, meta: baseMeta(STAFF, p), blocks, footnote: "Monthly pay as set on each staff profile. Confidential: for the Company Admin and the Branch Manager.", filename: fileName(STAFF, p) };
}

export const REPORTS: ReportSpec[] = [REVENUE, AGENTS, HOSPITALS, SERVICES_SPEC, PAYMENTS, STAFF];
export const reportById = (id: string | null) => REPORTS.find((r) => r.id === id);
export { COMPANY_NAME };
