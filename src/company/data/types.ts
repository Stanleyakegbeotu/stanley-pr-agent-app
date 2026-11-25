// GENERATED from the STANLEY desktop app (src/data/types.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
export type Currency = "NGN" | "GHS";

/**
 * A monetary total grouped by its recorded currency.
 * Values in different currencies are never added together.
 */
export type Money = Partial<Record<Currency, number>>;

/** Active = trading · Pending setup = created, not yet activated · Inactive / Suspended = closed (records kept). */
export type BranchStatus = "Active" | "Inactive" | "Suspended" | "Pending setup";

export interface Branch {
  id: string;
  /** Legacy/system branch code, e.g. "BR001". */
  code: string;
  name: string;
  city: string;
  country: string;
  currency: Currency;
  status: BranchStatus;
  manager: string;
  phone: string;
  address: string;
  /** Typical daily patient volume used by the demo generator. */
  basePatients: number;
  openedOn: string;
  /** Three-letter code used in Patient IDs (ABJ → ABJ-R000001). Unique across branches. */
  idCode?: string;
  state?: string;
  email?: string;
  contactPerson?: string;
  /** IANA timezone, e.g. Africa/Lagos. */
  timezone?: string;
  /** Created in STANLEY (ISO) — absent for the legacy branch. */
  createdAt?: string;
}

/** Owner (2026-11-21): no insurance (HMO) scheme is run — patients pay by cash, POS or transfer. */
export type PaymentMethod = "Cash" | "POS" | "Transfer";
export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "POS", "Transfer"];

export type ExpenseCategory =
  | "Reagents & consumables"
  | "Salaries"
  | "Utilities"
  | "Equipment maintenance"
  | "Logistics"
  | "Administrative";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Reagents & consumables",
  "Salaries",
  "Utilities",
  "Equipment maintenance",
  "Logistics",
  "Administrative",
];

export interface AgingBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90p: number;
}

/** One branch-day of demonstration activity. Amounts are in the branch currency. */
export interface DayRecord {
  date: string; // yyyy-mm-dd
  patients: number;
  newPatients: number;
  referrals: number;
  orders: number;
  completedOrders: number;
  transactions: number;
  revenue: number;
  /** paidAtVisit + recovered. */
  payments: number;
  /** Paid by the day's patients at their visit (sum of the visit lines). */
  paidAtVisit: number;
  /** Older patient balances settled today (oldest first). */
  recovered: number;
  expenses: number;
  // PR commission is not stored: it depends on the current rates — see services/commission.ts dayCommission().
  /** Aligned with SERVICES (the real catalogue). */
  serviceCounts: number[];
  /** One entry per referred patient: the legacy PR agent id and that patient's billed value. */
  referralAgentIds: number[];
  referralRevenue: number[];
  /** Service indices (into SERVICES) per patient visit; length = patients. */
  visitBaskets: number[][];
  /** Visit index of each referred patient, aligned with referralAgentIds. */
  referredPatients: number[];
  paymentsByMethod: number[]; // aligned with PAYMENT_METHODS
  expensesByCategory: number[]; // aligned with EXPENSE_CATEGORIES
  /** End-of-day position of unpaid patient balances. */
  outstanding: number;
  outstandingUnpaid: number;
  outstandingPartial: number;
  openBills: number;
  aging: AgingBuckets;
}

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export interface PeriodSelection {
  key: PeriodKey;
  /** Only for custom ranges (yyyy-mm-dd). */
  from?: string;
  to?: string;
}

export interface DateRange {
  from: Date;
  to: Date;
  days: number;
}
