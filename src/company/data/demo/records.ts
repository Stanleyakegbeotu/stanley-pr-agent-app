// GENERATED from the STANLEY desktop app (src/data/demo/records.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Operational records.
 *
 * No invented people or organisations live here. Records are either
 *  • REAL events about the baseline data (import, data-quality notices), or
 *  • DEMONSTRATION records derived from the generated activity, which only
 *    references real catalogue services, real prices and real PR agents.
 *    Patients are shown as anonymous references because no patient records
 *    were exported.
 * Patients, staff, drafts and trash start empty until real records exist.
 */
import { CATALOGUE_INVENTORY } from "../catalogueRules";
import { LEGACY_BRANCH_ID, LEGACY_META, LEGACY_PR_AGENTS, POSSIBLE_DUPLICATE_HOSPITALS } from "../legacy";
import { SERVICES, servicePrice } from "../company";
import { EXPENSE_CATEGORIES } from "../types";
import { DAILY, DATA_START, TODAY, addDays, diffDays } from "./generator";

const IMPORTED_AT = new Date(LEGACY_META.exportedAt);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────── Staff (none exported) ─────────────── */
export type StaffStatus = "Active" | "On leave" | "Inactive";
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  branchId: string;
  status: StaffStatus;
  added: string;
  lastActive: Date;
  email: string;
}

export const STAFF: StaffMember[] = [];
export const HEADCOUNT: Record<string, { total: number; active: number; onLeave: number }> = {
  [LEGACY_BRANCH_ID]: { total: 0, active: 0, onLeave: 0 },
};
export const STAFF_REQUESTS: { id: string; title: string; branchId: string; at: Date }[] = [];

/* ─────────────── Patients (none exported) ─────────────── */
export interface PatientRecord {
  id: string;
  name: string;
  sex: string;
  branchId: string;
  last: Date;
  orders: number;
  phone: string;
}
export const PATIENTS: PatientRecord[] = [];

/* ─────────────── Recent bills — demo, built from real services and agents ─────────────── */
export interface BillRecord {
  id: string;
  /** Anonymous reference — no patient records were exported. */
  patient: string;
  branchId: string;
  services: string[];
  billed: number;
  paid: number;
  method: string;
  /** Legacy PR agent id when the patient was referred. */
  agentId: number | null;
  at: Date;
}

const MIX_TOTAL = SERVICES.reduce((s, x) => s + x.mix, 0);

function buildRecentBills(): BillRecord[] {
  const days = DAILY[LEGACY_BRANCH_ID] ?? [];
  const today = days[days.length - 1];
  const rand = rng(20261121);
  const pickService = () => {
    let t = rand() * MIX_TOTAL;
    for (const s of SERVICES) {
      t -= s.mix;
      if (t <= 0) return s;
    }
    return SERVICES[0];
  };
  const referred = today?.referralAgentIds ?? [];
  const methods = ["Cash", "POS", "Transfer"];
  const count = Math.min(12, Math.max(4, today?.patients ?? 0));
  const out: BillRecord[] = [];
  let minutes = 4;
  for (let i = 0; i < count; i++) {
    const n = 1 + Math.floor(rand() * 3);
    const picked = Array.from({ length: n }, pickService);
    const billed = picked.reduce((s, x) => s + servicePrice(x, "NGN"), 0);
    const partial = rand() < 0.22;
    out.push({
      id: `BILL-${String(9100 - i).padStart(5, "0")}`,
      patient: `Patient PT-${String(4200 + Math.floor(rand() * 5800)).padStart(5, "0")}`,
      branchId: LEGACY_BRANCH_ID,
      services: picked.map((x) => x.name),
      billed,
      paid: partial ? Math.round((billed * (0.4 + 0.4 * rand())) / 500) * 500 : billed,
      method: methods[Math.floor(rand() * methods.length)],
      agentId: i < referred.length && rand() < 0.5 ? referred[i] : null,
      at: minutesAgo(minutes),
    });
    minutes += 9 + Math.floor(rand() * 28);
  }
  return out;
}

export const TRANSACTIONS: BillRecord[] = buildRecentBills();

/* ─────────────── Expense lines — demo, derived from the generated activity ─────────────── */
export interface ExpenseRecord {
  id: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  date: Date;
  status: "Approved" | "Pending" | "Rejected";
  by: string;
}

function buildExpenseLines(): ExpenseRecord[] {
  const days = DAILY[LEGACY_BRANCH_ID] ?? [];
  const out: ExpenseRecord[] = [];
  for (let i = days.length - 1; i >= 0 && out.length < 18; i--) {
    const d = days[i];
    const date = addDays(DATA_START, i);
    d.expensesByCategory.forEach((amount, c) => {
      if (amount > 0 && out.length < 18)
        out.push({
          id: `EXP-${date.getMonth() + 1}${String(date.getDate()).padStart(2, "0")}-${c + 1}`,
          branchId: LEGACY_BRANCH_ID,
          category: EXPENSE_CATEGORIES[c],
          description: `${EXPENSE_CATEGORIES[c]} — ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          amount: Math.round(amount),
          date,
          status: "Approved",
          by: "—",
        });
    });
  }
  return out;
}

export const EXPENSE_RECORDS: ExpenseRecord[] = buildExpenseLines();

/* ─────────────── Activity (real import event + demo bills) ─────────────── */
export type ActivityKind = "patient" | "order" | "payment" | "expense" | "staff" | "branch" | "referral" | "admin" | "approval";
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  actor: string;
  branchId: string | null;
  at: Date;
  status: "Completed" | "Recorded" | "Pending approval" | "Flagged" | "Approved";
  route: string;
}

const agentName = (id: number | null) => (id === null ? null : (LEGACY_PR_AGENTS.find((a) => a.id === id)?.name ?? null));

export const ACTIVITY: ActivityEvent[] = [
  ...TRANSACTIONS.slice(0, 6).map<ActivityEvent>((t, i) => {
    const ref = agentName(t.agentId);
    return {
      id: `EV-${t.id}`,
      kind: i % 3 === 1 && ref ? "referral" : "payment",
      title: ref && i % 3 === 1 ? "Referred patient billed" : "Payment received",
      detail: `${t.services.join(", ")} · ${t.patient}${ref ? ` · referred by ${ref}` : ""}`,
      actor: "Front desk",
      branchId: t.branchId,
      at: t.at,
      status: t.paid >= t.billed ? "Completed" : "Recorded",
      route: "/finance?tab=payments",
    };
  }),
  {
    id: "EV-IMPORT",
    kind: "admin",
    title: "Legacy baseline data imported",
    detail: `${LEGACY_META.counts.inventoryItems} services, ${LEGACY_META.counts.prAgents} PR agents and ${LEGACY_META.counts.distinctHospitals} hospitals from ${LEGACY_META.sourceDatabase}`,
    actor: "System",
    branchId: LEGACY_BRANCH_ID,
    at: IMPORTED_AT,
    status: "Completed",
    route: "/audit",
  },
];

export const PENDING_APPROVALS: { id: string; title: string; branchId: string; amount: number; currency: "NGN"; at: Date }[] = [];

/* ─────────────── Notifications (real data-quality notices) ─────────────── */
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  at: Date;
  read: boolean;
  kind: "price" | "approval" | "staff" | "inventory" | "system";
  route: string;
}

const unpriced = CATALOGUE_INVENTORY.filter((i) => i.price === null);

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "N-import",
    title: "Legacy data loaded",
    body: `${LEGACY_META.counts.inventoryItems} services, ${LEGACY_META.counts.prAgents} PR agents and ${LEGACY_META.counts.distinctHospitals} hospitals are now available.`,
    at: IMPORTED_AT,
    read: false,
    kind: "system",
    route: "/inventory",
  },
  {
    id: "N-unpriced",
    title: `${unpriced.length} services have no price`,
    body: `${unpriced.map((i) => i.name).join(" and ")} cannot be billed until a price is confirmed.`,
    at: IMPORTED_AT,
    read: false,
    kind: "price",
    route: "/inventory?filter=noprice",
  },
  {
    id: "N-hospitals",
    title: "Hospital codes need review",
    body: `${POSSIBLE_DUPLICATE_HOSPITALS.length} groups of hospital codes look like spelling variants. Confirm before merging.`,
    at: IMPORTED_AT,
    read: false,
    kind: "system",
    route: "/pr?tab=hospitals",
  },
];

/* ─────────────── Drafts, audit and trash ─────────────── */
export const DRAFTS: { id: string; patient: string; branchId: string; services: string; amount: number; saved: Date; by: string }[] = [];

export const AUDIT = [
  {
    user: "System",
    role: "Data import",
    branchId: LEGACY_BRANCH_ID,
    action: "Baseline imported",
    record: LEGACY_META.sourceDatabase,
    change: `${LEGACY_META.counts.inventoryItems} inventory items · ${LEGACY_META.counts.prAgents} PR agents · ${LEGACY_META.counts.distinctHospitals} hospitals (read-only baseline)`,
    at: IMPORTED_AT,
  },
];

export const TRASH: { id: string; type: string; name: string; branchId: string; deletedBy: string; deletedAt: Date; purgeInDays: number }[] = [];

/** Days of demo activity available (for labelling). */
export const DEMO_ACTIVITY_DAYS = diffDays(DATA_START, TODAY) + 1;
