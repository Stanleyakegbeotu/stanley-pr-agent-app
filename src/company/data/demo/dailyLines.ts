// GENERATED from the STANLEY desktop app (src/data/demo/dailyLines.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * DEMONSTRATION line items — patient visits and expense lines.
 *
 * Each branch-day in DAILY only stores totals. This module breaks those totals
 * down into individual rows so the dashboard can list "who came in today" and
 * "what was spent today". The breakdown is deterministic and reconciles with
 * the totals:
 *   • visit count            = DayRecord.patients
 *   • new visits             = DayRecord.newPatients
 *   • referred visits        = DayRecord.referrals (same real PR agents, same order)
 *   • services billed        = DayRecord.serviceCounts (real catalogue, real prices)
 *   • expense lines per category sum to DayRecord.expensesByCategory
 *
 * Patients are anonymous references (no patient records were exported).
 * Replace with ledger queries once real visits and expenses are recorded.
 */
import { ACTIVE_BRANCHES, SERVICES, getBranch, servicePrice } from "../company";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type DateRange, type PaymentMethod } from "../types";
import { DAILY, DATA_START, addDays, diffDays, isoDate } from "./generator";
import { STAFF } from "./records";
import { dayCommission, rateSummary } from "@company/services/commission";
import { billingState, type Order } from "@company/services/billing";

export type VisitPayment = "Paid" | "Part-paid" | "Unpaid";

export interface PatientVisit {
  id: string;
  /** Patient ID (PT-… demo patients; ABJ-W…/ABJ-R… for patients billed in STANLEY). */
  patientRef: string;
  /** Patient's full name. */
  patientName: string;
  /** Patient phone number (optional at registration; null when not provided). */
  phone: string | null;
  branchId: string;
  at: Date;
  isNew: boolean;
  services: { id: number; name: string; price: number }[];
  billed: number;
  paid: number;
  payment: VisitPayment;
  /** Real legacy PR agent id when the patient was referred. */
  agentId: number | null;
  /** How the patient paid (null when nothing has been paid yet). */
  method: PaymentMethod | null;
  /** Who processed the patient at the branch front desk. `name` is null until staff records exist. */
  processedBy: { role: "Receptionist" | "Branch Manager"; name: string | null };
}

export interface ExpenseLine {
  id: string;
  branchId: string;
  at: Date;
  category: string;
  description: string;
  amount: number;
  status: "Approved";
}

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

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const branchSeed = (branchId: string) => Math.max(0, ACTIVE_BRANCHES.findIndex((b) => b.id === branchId)) + 1;

/** Arrival/recording times between 07:00 and 18:00. Today never runs past the current time. */
function timesForDay(date: Date, count: number, rand: () => number): Date[] {
  const now = new Date();
  const isToday = isoDate(date) === isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let startMin = 7 * 60;
  let endMin = 18 * 60;
  if (isToday) {
    endMin = Math.max(1, nowMin);
    startMin = Math.min(startMin, Math.max(0, endMin - 180));
  }
  return Array.from({ length: count }, () => startMin + rand() * (endMin - startMin))
    .sort((a, b) => a - b)
    .map((m) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(m / 60), Math.floor(m % 60)));
}

/* ─────────────── Patient identities (who came back) ─────────────── */

/**
 * Anonymous patients registered before records began (1 Jan); returning visits
 * early in the year draw on them. Ids above this are registered in date order.
 */
const PRE_EXISTING_PATIENTS = 1_500;

interface IdentityPlan {
  /** Patient number per [day][visit index]. */
  ids: number[][];
  isNew: boolean[][];
  /** Patient number → every visit, oldest first. */
  visitsOf: Map<number, { day: number; p: number }[]>;
}

const planCache = new Map<string, IdentityPlan>();

/**
 * Walks the branch's days in order: each day's new patients get the next
 * patient number; returning patients are drawn from people already
 * registered (recent registrations more likely), never twice on one day.
 */
function identityPlan(branchId: string): IdentityPlan {
  const hit = planCache.get(branchId);
  if (hit) return hit;
  const days = DAILY[branchId] ?? [];
  const rand = rng(branchSeed(branchId) * 5_000_011 + 7);
  const registered: number[] = [];
  let next = PRE_EXISTING_PATIENTS + 1;
  const ids: number[][] = [];
  const isNew: boolean[][] = [];
  const visitsOf = new Map<number, { day: number; p: number }[]>();

  days.forEach((rec, day) => {
    const n = rec.patients;
    const newSet = new Set(shuffle([...Array(n).keys()], rand).slice(0, rec.newPatients));
    const today = new Set<number>();
    const dayIds: number[] = [];
    const dayNew: boolean[] = [];
    for (let p = 0; p < n; p++) {
      let id: number;
      if (newSet.has(p)) {
        id = next++;
        registered.push(id);
      } else {
        id = 0;
        for (let tries = 0; tries < 6 && (!id || today.has(id)); tries++) {
          const r = rand();
          if (registered.length && r < 0.5) id = registered[Math.max(0, registered.length - 1 - Math.floor(rand() * Math.min(registered.length, 600)))];
          else if (registered.length && r < 0.65) id = registered[Math.floor(rand() * registered.length)];
          else id = 1 + Math.floor(rand() * PRE_EXISTING_PATIENTS);
        }
        if (today.has(id)) id = 1 + Math.floor(rand() * PRE_EXISTING_PATIENTS);
      }
      today.add(id);
      dayIds.push(id);
      dayNew.push(newSet.has(p));
      const list = visitsOf.get(id) ?? [];
      list.push({ day, p });
      visitsOf.set(id, list);
    }
    ids.push(dayIds);
    isNew.push(dayNew);
  });

  const plan = { ids, isNew, visitsOf };
  planCache.set(branchId, plan);
  return plan;
}

const patientRefOf = (id: number) => `PT-${String(id).padStart(5, "0")}`;

/*
 * Demo patient names (owner request, 2026-11-22). The legacy export had no
 * patient records, so the demo patients get common Nigerian names — the same
 * name for the same patient number every time. Real names come from billing.
 */
const FIRST_NAMES = [
  "Adaeze", "Adebayo", "Aisha", "Amaka", "Amina", "Babajide", "Bola", "Chidi", "Chiamaka", "Chinedu", "Chioma", "Daniel", "Danjuma", "Ebuka",
  "Efe", "Emeka", "Esther", "Fatima", "Femi", "Funke", "Grace", "Halima", "Ibrahim", "Ifeoma", "Ikenna", "Joy", "Kehinde", "Kemi", "Kunle",
  "Ladi", "Maryam", "Musa", "Nkechi", "Ngozi", "Nneka", "Obinna", "Olumide", "Ronke", "Sadiq", "Samuel", "Segun", "Sola", "Tunde", "Uche",
  "Usman", "Yetunde", "Yusuf", "Zainab", "Blessing", "Godwin", "Hauwa", "Peter", "Rukayat", "Tobi", "Victor", "Hadiza", "Ifeanyi", "Abubakar",
];
const LAST_NAMES = [
  "Abubakar", "Adebayo", "Adeleke", "Adeyemi", "Akande", "Aliyu", "Bakare", "Bello", "Chukwu", "Danladi", "Eze", "Ibrahim", "Lawal", "Mohammed",
  "Musa", "Nwachukwu", "Nwosu", "Obi", "Odukoya", "Ogunleye", "Ojo", "Okafor", "Okeke", "Okonkwo", "Olaniyan", "Onyeka", "Oyelaran", "Salami",
  "Sani", "Suleiman", "Uche", "Udeh", "Umar", "Usman", "Yakubu", "Yusuf", "Babangida", "Dikko", "Garba", "Idris", "Kalu", "Mbah", "Ndukwe",
  "Oladipo", "Onuoha", "Shehu", "Tanko", "Uzor", "Waziri", "Ekwueme",
];
/** Same demo name for the same patient number. */
export function patientNameOf(id: number): string {
  let h = (id * 2654435761) >>> 0;
  const first = FIRST_NAMES[h % FIRST_NAMES.length];
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  const last = LAST_NAMES[h % LAST_NAMES.length];
  return `${first} ${last}`;
}

export interface PatientHistory {
  patientRef: string;
  /** Visits oldest first. */
  visits: PatientVisit[];
  /** True when the patient was registered before records began. */
  preExisting: boolean;
}

/** Every recorded visit of one anonymous patient at a branch. */
export function patientHistory(branchId: string, patientRef: string): PatientHistory {
  if (!patientRef.startsWith("PT-")) {
    const visits = orderVisits([branchId]).filter((v) => v.patientRef === patientRef).sort((a, b) => a.at.getTime() - b.at.getTime());
    return { patientRef, visits, preExisting: false };
  }
  const id = Number(patientRef.replace(/\D/g, ""));
  const plan = identityPlan(branchId);
  const visits = (plan.visitsOf.get(id) ?? []).map(({ day, p }) => visitsForDay(branchId, day)[p]).filter(Boolean);
  return { patientRef, visits, preExisting: id <= PRE_EXISTING_PATIENTS };
}

/**
 * Distinct patients with at least one recorded visit at the branch since
 * records began, and how many of them registered after that (new patients).
 */
export function patientsOnRecord(branchId: string): { total: number; registered: number } {
  const plan = identityPlan(branchId);
  let registered = 0;
  for (const id of plan.visitsOf.keys()) if (id > PRE_EXISTING_PATIENTS) registered++;
  return { total: plan.visitsOf.size, registered };
}

/* ─────────────── Patient visits ─────────────── */

const visitCache = new Map<string, PatientVisit[]>();

function visitsForDay(branchId: string, dayIndex: number): PatientVisit[] {
  const key = `${branchId}:${dayIndex}`;
  const hit = visitCache.get(key);
  if (hit) return hit;
  const rec = DAILY[branchId]?.[dayIndex];
  const branch = getBranch(branchId);
  if (!rec || !branch || rec.patients === 0) {
    visitCache.set(key, []);
    return [];
  }
  const rand = rng(branchSeed(branchId) * 1_000_003 + dayIndex * 7_919 + 17);
  const date = addDays(DATA_START, dayIndex);
  const n = rec.patients;

  // Tests per patient and who referred them come from the generator, so visit bills
  // reconcile exactly with revenue, referral revenue and PR commission.
  const baskets = rec.visitBaskets;
  const agentFor = new Map(rec.referredPatients.map((p, k) => [p, rec.referralAgentIds[k]]));
  // Stable patient identities across days (returning patients are real repeat visitors).
  const plan = identityPlan(branchId);
  const times = timesForDay(date, n, rand);
  const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  // Separate stream for payment method / front-desk staff so earlier fields stay unchanged.
  const rand2 = rng(branchSeed(branchId) * 3_000_017 + dayIndex * 4_049 + 29);
  const methodTotal = rec.paymentsByMethod.reduce((a, b) => a + b, 0) || 1;
  const pickMethod = (): PaymentMethod => {
    let t = rand2() * methodTotal;
    for (let k = 0; k < PAYMENT_METHODS.length; k++) if ((t -= rec.paymentsByMethod[k]) <= 0) return PAYMENT_METHODS[k];
    return PAYMENT_METHODS[0];
  };
  const staffFor = (role: "Receptionist" | "Branch Manager") => {
    const list = STAFF.filter((s) => s.branchId === branchId && s.status === "Active" && (role === "Branch Manager" ? /manager/i.test(s.role) : /reception|front desk/i.test(s.role)));
    return list.length ? list[Math.floor(rand2() * list.length)].name : null;
  };

  const bills = baskets.map((basket) => basket.map((idx) => ({ id: SERVICES[idx].id, name: SERVICES[idx].name, price: servicePrice(SERVICES[idx], branch.currency) })));
  const billedOf = bills.map((s) => s.reduce((a, x) => a + x.price, 0));
  // Share the day's unpaid amount (revenue − paid at visit) across some visits so the
  // visit lines add up to the day's figures exactly: some unpaid, some part-paid.
  const balance = new Array<number>(n).fill(0);
  {
    const rand3 = rng(branchSeed(branchId) * 4_000_037 + dayIndex * 3_571 + 53);
    let left = Math.max(0, billedOf.reduce((a, b) => a + b, 0) - rec.paidAtVisit);
    const order = shuffle([...Array(n).keys()], rand3);
    for (const p of order) {
      if (left <= 0) break;
      const b = billedOf[p];
      if (b <= 0) continue;
      let owe = rand3() < 0.35 ? b : Math.round((b * (0.2 + 0.5 * rand3())) / 50) * 50;
      owe = Math.min(owe || b, left, b);
      balance[p] = owe;
      left -= owe;
    }
    for (const p of order) {
      if (left <= 0) break;
      const add = Math.min(billedOf[p] - balance[p], left);
      balance[p] += add;
      left -= add;
    }
  }

  const out: PatientVisit[] = bills.map((services, p) => {
    const billed = billedOf[p];
    const paid = billed - balance[p];
    const payment: VisitPayment = balance[p] <= 0 ? "Paid" : paid <= 0 ? "Unpaid" : "Part-paid";
    return {
      id: `V${branch.code}-${mmdd}-${String(p + 1).padStart(3, "0")}`,
      patientRef: patientRefOf(plan.ids[dayIndex]?.[p] ?? 0),
      patientName: patientNameOf(plan.ids[dayIndex]?.[p] ?? 0),
      // No patient records were exported, so no phone numbers exist yet (never invented).
      phone: null,
      branchId,
      at: times[p],
      isNew: plan.isNew[dayIndex]?.[p] ?? false,
      services,
      billed,
      paid,
      payment,
      agentId: agentFor.get(p) ?? null,
      method: paid > 0 ? pickMethod() : null,
      processedBy: (() => {
        const role = rand2() < 0.86 ? "Receptionist" : "Branch Manager";
        return { role, name: staffFor(role) } as const;
      })(),
    };
  });
  visitCache.set(key, out);
  return out;
}

/* ─────────────── Expense lines ─────────────── */

/** What each expense category covers (also used to explain chart figures). */
export const EXPENSE_ITEMS: Record<string, string[]> = {
  "Reagents & consumables": ["Reagent restock", "Laboratory consumables", "Sample bottles & tubes", "Contrast media", "Gloves & PPE"],
  Salaries: ["Monthly payroll"],
  Utilities: ["Electricity", "Diesel for generator", "Water supply", "Internet service"],
  "Equipment maintenance": ["Equipment servicing", "Scanner maintenance", "Analyser calibration"],
  Logistics: ["Sample dispatch", "Fuel & transport", "Courier"],
  Administrative: ["Stationery & printing", "Bank charges", "Office supplies", "Cleaning supplies"],
};

const expenseCache = new Map<string, ExpenseLine[]>();

function expensesForDay(branchId: string, dayIndex: number): ExpenseLine[] {
  const key = `${branchId}:${dayIndex}`;
  const hit = expenseCache.get(key);
  if (hit) return hit;
  const rec = DAILY[branchId]?.[dayIndex];
  const branch = getBranch(branchId);
  if (!rec || !branch) {
    expenseCache.set(key, []);
    return [];
  }
  const rand = rng(branchSeed(branchId) * 2_000_029 + dayIndex * 6_007 + 41);
  const date = addDays(DATA_START, dayIndex);
  const yymmdd = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const drafts: Omit<ExpenseLine, "id" | "at">[] = [];
  rec.expensesByCategory.forEach((total, c) => {
    if (total <= 0) return;
    const category = EXPENSE_CATEGORIES[c];
    const pool = shuffle([...(EXPENSE_ITEMS[category] ?? [category])], rand);
    const parts = Math.min(pool.length, total > 1 ? 1 + Math.floor(rand() * 3) : 1);
    const weights = Array.from({ length: parts }, () => 0.5 + rand());
    const wSum = weights.reduce((a, b) => a + b, 0);
    let left = total;
    weights.forEach((w, i) => {
      const amount = i === parts - 1 ? left : Math.round((total * w) / wSum);
      left -= amount;
      drafts.push({ branchId, category, description: pool[i], amount, status: "Approved" });
    });
  });

  const times = timesForDay(date, drafts.length, rand);
  const out = shuffle(drafts, rand).map((d, i) => ({ ...d, id: `EXP-${branch.code}-${yymmdd}-${String(i + 1).padStart(2, "0")}`, at: times[i] }));
  expenseCache.set(key, out);
  return out;
}

/* ─────────────── Balance recoveries (FIFO over owed visits) ─────────────── */

/** An older patient balance paid today. */
export interface RecoveryLine {
  id: string;
  branchId: string;
  at: Date;
  amount: number;
  /** The earlier visit whose balance this pays. */
  visit: PatientVisit;
  method: PaymentMethod;
  /** True when this payment cleared the visit's balance. */
  settled: boolean;
}

interface OwedBill {
  visit: PatientVisit;
  owed: number;
  /** Repayments in day order. */
  repaid: { day: number; amount: number }[];
}

const recoveryCache = new Map<string, { byDay: RecoveryLine[][]; owed: OwedBill[] }>();

/**
 * Replays the generator's FIFO collection over individual visits: each day's
 * `recovered` amount settles the oldest owed visits first. Day totals match the
 * daily figures exactly, so every recovered naira traces to a real earlier bill.
 */
function recoveries(branchId: string) {
  const hit = recoveryCache.get(branchId);
  if (hit) return hit;
  const days = DAILY[branchId] ?? [];
  const branch = getBranch(branchId);
  const owed: OwedBill[] = [];
  const left: number[] = [];
  let head = 0;
  const byDay: RecoveryLine[][] = [];
  days.forEach((rec, i) => {
    for (const v of visitsForDay(branchId, i)) {
      if (v.billed - v.paid > 0) {
        owed.push({ visit: v, owed: v.billed - v.paid, repaid: [] });
        left.push(v.billed - v.paid);
      }
    }
    let collect = rec.recovered;
    const parts: { bill: number; amount: number }[] = [];
    while (collect > 0 && head < owed.length) {
      const take = Math.min(left[head], collect);
      left[head] -= take;
      collect -= take;
      owed[head].repaid.push({ day: i, amount: take });
      parts.push({ bill: head, amount: take });
      if (left[head] <= 0) head++;
    }
    const rand = rng(branchSeed(branchId) * 6_000_011 + i * 2_311 + 61);
    const date = addDays(DATA_START, i);
    const times = timesForDay(date, parts.length, rand);
    const total = rec.paymentsByMethod.reduce((a, b) => a + b, 0) || 1;
    const pick = (): PaymentMethod => {
      let t = rand() * total;
      for (let k = 0; k < PAYMENT_METHODS.length; k++) if ((t -= rec.paymentsByMethod[k]) <= 0) return PAYMENT_METHODS[k];
      return PAYMENT_METHODS[0];
    };
    const yymmdd = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    byDay.push(
      parts.map((x, k) => ({
        id: `RCV-${branch?.code ?? "BR"}-${yymmdd}-${String(k + 1).padStart(2, "0")}`,
        branchId,
        at: times[k],
        amount: x.amount,
        visit: owed[x.bill].visit,
        method: pick(),
        settled: left[x.bill] <= 0,
      })),
    );
  });
  const out = { byDay, owed };
  recoveryCache.set(branchId, out);
  return out;
}

/** A patient bill still (partly) unpaid at the end of a given day. */
export interface OpenBalance {
  visit: PatientVisit;
  owed: number;
  repaid: number;
  remaining: number;
  /** Days since the visit. */
  ageDays: number;
}

/** Bills with a balance at the end of `asOf`, oldest first. Sums to the day's outstanding figure. */
export function openBalances(branchId: string, asOf: Date): OpenBalance[] {
  const day = Math.min(diffDays(DATA_START, asOf), (DAILY[branchId]?.length ?? 1) - 1);
  if (day < 0) return [];
  const out: OpenBalance[] = [];
  for (const b of recoveries(branchId).owed) {
    const vDay = diffDays(DATA_START, b.visit.at);
    if (vDay > day) break;
    const repaid = b.repaid.reduce((s, r) => s + (r.day <= day ? r.amount : 0), 0);
    if (b.owed - repaid > 0) out.push({ visit: b.visit, owed: b.owed, repaid, remaining: b.owed - repaid, ageDays: day - vDay });
  }
  return out;
}

/* ─────────────── Finance log (every income and expense, with its source) ─────────────── */

export type LedgerKind = "visit" | "recovery" | "expense" | "commission";

export interface LedgerEntry {
  id: string;
  branchId: string;
  at: Date;
  kind: LedgerKind;
  direction: "in" | "out";
  amount: number;
  /** Income stream or expense category. */
  category: string;
  /** What the money was for. */
  source: string;
  /** Extra context (tests, referrer, original visit…). */
  detail: string;
  method: PaymentMethod | null;
  recordedBy: string;
  visit?: PatientVisit;
  expense?: ExpenseLine;
}

const commissionTime = (date: Date, visits: PatientVisit[]) => {
  const close = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0);
  const last = visits.length ? visits[visits.length - 1].at : close;
  return isoDate(date) === isoDate(new Date()) ? last : close;
};

function ledgerForDay(branchId: string, dayIndex: number): LedgerEntry[] {
  const rec = DAILY[branchId]?.[dayIndex];
  if (!rec) return [];
  const date = addDays(DATA_START, dayIndex);
  const visits = visitsForDay(branchId, dayIndex);
  const out: LedgerEntry[] = [];
  for (const v of visits) {
    if (v.paid <= 0) continue;
    out.push({
      id: v.id,
      branchId,
      at: v.at,
      kind: "visit",
      direction: "in",
      amount: v.paid,
      category: "Patient bills",
      source: `Patient bill · ${v.patientRef}`,
      detail: `${v.services.length} test${v.services.length === 1 ? "" : "s"}: ${v.services.map((s) => s.name).join(", ")}${v.payment === "Part-paid" ? ` · part payment of ${v.billed.toLocaleString("en-NG")}` : ""}`,
      method: v.method,
      recordedBy: v.processedBy.name ?? v.processedBy.role,
      visit: v,
    });
  }
  for (const r of recoveries(branchId).byDay[dayIndex] ?? []) {
    out.push({
      id: r.id,
      branchId,
      at: r.at,
      kind: "recovery",
      direction: "in",
      amount: r.amount,
      category: "Balances recovered",
      source: `Balance recovered · ${r.visit.patientRef}`,
      detail: `For visit ${r.visit.id} on ${r.visit.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${r.settled ? " · balance cleared" : " · part of the balance"}`,
      method: r.method,
      recordedBy: "Receptionist",
      visit: r.visit,
    });
  }
  for (const e of expensesForDay(branchId, dayIndex)) {
    out.push({ id: e.id, branchId, at: e.at, kind: "expense", direction: "out", amount: e.amount, category: e.category, source: e.description, detail: `${e.category} · ${e.status}`, method: null, recordedBy: "Branch Manager", expense: e });
  }
  const commission = dayCommission(rec);
  if (commission > 0) {
    out.push({
      id: `COM-${getBranch(branchId)?.code ?? "BR"}-${isoDate(date).replace(/-/g, "").slice(2)}`,
      branchId,
      at: commissionTime(date, visits),
      kind: "commission",
      direction: "out",
      amount: commission,
      category: "PR commission",
      source: `PR commission · ${rec.referrals} referred patient${rec.referrals === 1 ? "" : "s"}`,
      detail: `Accrued on referred patients' bills · ${rateSummary()}`,
      method: null,
      recordedBy: "System (accrued)",
    });
  }
  return out;
}

/** Every income and expense line in the range for the given branches, newest first. */
export function ledger(branchIds: string[], range: DateRange): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const id of branchIds) for (const i of dayIndexes(range)) out.push(...ledgerForDay(id, i));
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/* ─────────────── Range queries ─────────────── */

function dayIndexes(range: DateRange): number[] {
  const start = Math.max(0, diffDays(DATA_START, range.from));
  const end = diffDays(DATA_START, range.to);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/** Visits in the range for the given branches, newest first. */
export function patientVisits(branchIds: string[], range: DateRange): PatientVisit[] {
  const out: PatientVisit[] = [];
  for (const id of branchIds) for (const i of dayIndexes(range)) out.push(...visitsForDay(id, i));
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Approved expense lines in the range for the given branches, newest first. */
export function expenseLines(branchIds: string[], range: DateRange): ExpenseLine[] {
  const out: ExpenseLine[] = [];
  for (const id of branchIds) for (const i of dayIndexes(range)) out.push(...expensesForDay(id, i));
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Finds one visit by its id (e.g. `VBR001-1121-035`) — used by notification links. */
export function findVisit(branchId: string, visitId: string): PatientVisit | null {
  const m = /^V.+-(\d{2})(\d{2})-\d{3}$/.exec(visitId);
  if (!m) return null;
  const day = new Date(DATA_START.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  const i = diffDays(DATA_START, day);
  if (i < 0 || i >= (DAILY[branchId]?.length ?? 0)) return null;
  return visitsForDay(branchId, i).find((v) => v.id === visitId) ?? null;
}

/* ─────────────── Patient search (header) ─────────────── */

export interface PatientIndexEntry {
  ref: string;
  name: string;
  /** Recorded visits at the branch. */
  visits: number;
  /** Day index of the latest visit. */
  lastDay: number;
}

const indexCache = new Map<string, PatientIndexEntry[]>();

/** Every patient with a recorded visit at the branch, most recent visit first. */
export function patientIndex(branchId: string): PatientIndexEntry[] {
  const hit = indexCache.get(branchId);
  if (hit) return hit;
  const plan = identityPlan(branchId);
  const out: PatientIndexEntry[] = [];
  for (const [id, list] of plan.visitsOf) if (list.length) out.push({ ref: patientRefOf(id), name: patientNameOf(id), visits: list.length, lastDay: Math.max(...list.map((x) => x.day)) });
  out.sort((a, b) => b.lastDay - a.lastDay || a.ref.localeCompare(b.ref));
  indexCache.set(branchId, out);
  return withBilled(branchId, out);
}

/** Patients registered in STANLEY (billing) come first — they are the newest. */
function withBilled(branchId: string, demo: PatientIndexEntry[]): PatientIndexEntry[] {
  const st = billingState();
  const billed = st.patients
    .filter((p) => p.branchId === branchId)
    .map((p) => {
      const orders = st.orders.filter((o) => o.patient.uuid === p.uuid);
      const last = orders.reduce((m, o) => (o.createdAt > m ? o.createdAt : m), p.registeredAt);
      return { ref: p.patientId, name: p.name, visits: orders.length, lastDay: diffDays(DATA_START, new Date(last)) };
    });
  return billed.length ? [...billed.sort((a, b) => b.lastDay - a.lastDay), ...demo] : demo;
}

/* ─────────────── Bills saved in STANLEY as patient visits ─────────────── */

const ROLE_OF = (role: string): PatientVisit["processedBy"]["role"] => (role === "Branch Manager" ? "Branch Manager" : "Receptionist");

/** A saved bill as a patient visit, so it appears in patient records like any other visit. */
export function orderToVisit(o: Order): PatientVisit {
  const method: PaymentMethod | null = o.method === null ? null : o.method === "Split" ? (o.split.slice().sort((a, b) => b.amount - a.amount)[0]?.method ?? null) : o.method;
  return {
    id: o.invoiceNo,
    patientRef: o.patient.patientId,
    patientName: o.patient.name,
    phone: o.patient.phone || null,
    branchId: o.branchId,
    at: new Date(o.createdAt),
    isNew: o.patient.isNew,
    services: o.services.map((x) => ({ id: x.id, name: x.name, price: x.appliedPrice })),
    billed: o.total,
    paid: o.amountPaid,
    payment: o.balance <= 0 ? "Paid" : o.amountPaid > 0 ? "Part-paid" : "Unpaid",
    agentId: o.referral.agentId,
    method,
    processedBy: { role: ROLE_OF(o.createdBy.role), name: o.createdBy.name },
  };
}

/** Bills saved in STANLEY for the branches (optionally within a date range), newest first. */
export function orderVisits(branchIds: string[], range?: DateRange): PatientVisit[] {
  const from = range ? new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime() : -Infinity;
  const to = range ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1).getTime() : Infinity;
  return billingState()
    .orders.filter((o) => branchIds.includes(o.branchId))
    .map(orderToVisit)
    .filter((v) => v.at.getTime() >= from && v.at.getTime() < to)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Patient records: the demo activity plus every bill saved in STANLEY, newest
 * first. Used by the patient lists and search (money widgets still use the
 * demo totals until billing feeds the financial figures).
 */
export function recordVisits(branchIds: string[], range: DateRange): PatientVisit[] {
  const billed = orderVisits(branchIds, range);
  const demo = patientVisits(branchIds, range);
  return billed.length ? [...billed, ...demo].sort((a, b) => b.at.getTime() - a.at.getTime()) : demo;
}

/** The patient's most recent visit at the branch. */
export function latestVisit(branchId: string, patientRef: string): PatientVisit | null {
  const v = patientHistory(branchId, patientRef).visits;
  return v.length ? v.reduce((a, b) => (b.at > a.at ? b : a)) : null;
}
