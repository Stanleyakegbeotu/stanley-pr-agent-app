// GENERATED from the STANLEY desktop app (src/data/demo/generator.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * DEMONSTRATION ACTIVITY — built from the REAL baseline records.
 *
 * No real orders, payments or referrals were exported, so daily *volumes* are
 * generated deterministically. Everything they refer to is real: the services
 * and their NGN prices come from the legacy catalogue, and every referral is
 * attributed to a real legacy PR agent (and, through the agent's assignment,
 * a real hospital). Replace this module with ledger queries once real
 * transactions are recorded.
 */
import { DEMO_BRANCHES, SERVICES, servicePrice } from "../company";
import { LEGACY_PR_AGENTS, hospitalKey } from "../legacy";
import type { AgingBuckets, Branch, Currency, DayRecord } from "../types";

/**
 * Demo referral propensity per agent: a few very active referrers, a long
 * tail of occasional ones; agents with an assigned hospital refer a bit more.
 * Deterministic so figures are stable between launches.
 */
const AGENT_WEIGHTS: { id: number; cumulative: number }[] = (() => {
  let acc = 0;
  return LEGACY_PR_AGENTS.map((a) => {
    const r = Math.abs(Math.sin(a.id * 12.9898 + 78.233) * 43758.5453) % 1;
    const w = Math.min(40, Math.pow(1 - r * 0.97, -1.6)) * (hospitalKey(a.hospital) ? 1.7 : 1);
    acc += w;
    return { id: a.id, cumulative: acc };
  });
})();

function pickAgent(rand: () => number): number {
  const total = AGENT_WEIGHTS[AGENT_WEIGHTS.length - 1].cumulative;
  const target = rand() * total;
  let lo = 0;
  let hi = AGENT_WEIGHTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (AGENT_WEIGHTS[mid].cumulative < target) lo = mid + 1;
    else hi = mid;
  }
  return AGENT_WEIGHTS[lo].id;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const NOW = new Date();
export const TODAY = startOfDay(NOW);
/** Demo records begin on 1 January of the current year. */
export const DATA_START = new Date(TODAY.getFullYear(), 0, 1);

/** Demo expense scale per currency (operating costs are not part of the legacy export). */
const SCALE: Record<Currency, { salary: number; util: number; maint: number; logi: number; admin: number; bill: number }> = {
  NGN: { salary: 90_000, util: 6_000, maint: 9_000, logi: 900, admin: 500, bill: 30_000 },
  GHS: { salary: 1_000, util: 70, maint: 100, logi: 10, admin: 6, bill: 300 },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Average number of catalogue services ordered per patient visit (demo assumption). */
const ORDERS_PER_PATIENT = 1.6;
const MIX_TOTAL = SERVICES.reduce((s, x) => s + x.mix, 0);

function generateBranch(branch: Branch, seedIndex: number): DayRecord[] {
  const rand = mulberry32(1000 + seedIndex * 7919);
  const days = diffDays(DATA_START, TODAY) + 1;
  const scale = SCALE[branch.currency];
  const queue: { day: number; amount: number; partial: boolean }[] = [];
  const out: DayRecord[] = [];
  const hourNow = NOW.getHours() + NOW.getMinutes() / 60;

  for (let i = 0; i < days; i++) {
    const date = addDays(DATA_START, i);
    const wd = date.getDay();
    const isToday = i === days - 1;
    const dayFrac = isToday ? clamp((hourNow - 7) / 11, 0.06, 1) : 1;
    const wf = [0.38, 1.06, 1.0, 1.0, 1.03, 1.09, 0.78][wd];
    const growth = 1 + 0.14 * (i / 365);
    const season = 1 + 0.06 * Math.sin(i / 58 + seedIndex);

    const patients = Math.max(
      0,
      Math.round(branch.basePatients * wf * growth * season * (0.86 + 0.28 * rand()) * dayFrac),
    );
    const newPatients = Math.round(patients * (0.15 + 0.07 * rand()));
    const referrals = Math.round(patients * (0.3 + 0.12 * rand()));
    // Expected orders per real catalogue service, with randomised rounding so rare tests still occur.
    const serviceCounts = SERVICES.map((s) => {
      const expected = (patients * ORDERS_PER_PATIENT * s.mix) / MIX_TOTAL;
      const base = Math.floor(expected);
      return base + (rand() < expected - base ? 1 : 0);
    });
    // Every visit includes at least one test: top up (by demand mix) when rounding left fewer orders than patients.
    for (let missing = patients - serviceCounts.reduce((a, b) => a + b, 0); missing > 0; missing--) {
      let pick = rand() * MIX_TOTAL;
      let idx = 0;
      while (idx < SERVICES.length - 1 && (pick -= SERVICES[idx].mix) > 0) idx++;
      serviceCounts[idx] += 1;
    }
    const orders = serviceCounts.reduce((a, b) => a + b, 0);
    const completedOrders = isToday ? Math.round(orders * (0.82 + 0.1 * rand())) : orders;
    const revenue = serviceCounts.reduce((sum, c, idx) => sum + c * servicePrice(SERVICES[idx], branch.currency), 0);

    // Deal the day's orders to patients (one test each first, the rest at random). The visit
    // list (dailyLines) reads these baskets, so every figure below matches the patient records.
    const flat: number[] = [];
    serviceCounts.forEach((c, idx) => {
      for (let k = 0; k < c; k++) flat.push(idx);
    });
    shuffleInPlace(flat, rand);
    const visitBaskets: number[][] = Array.from({ length: patients }, () => []);
    flat.forEach((svc, k) => visitBaskets[k < patients ? k : Math.floor(rand() * patients)].push(svc));

    // Referred patients: a random subset, each attributed to a real legacy PR agent.
    // Referral revenue is exactly that patient's bill (real catalogue prices).
    const referredPatients = shuffleInPlace([...Array(patients).keys()], rand).slice(0, referrals);
    const referralAgentIds = referredPatients.map(() => pickAgent(rand));
    const referralRevenue = referredPatients.map((p) => visitBaskets[p].reduce((s, idx) => s + servicePrice(SERVICES[idx], branch.currency), 0));

    // Same-day payments; the remainder becomes an outstanding patient balance.
    // Whole ₦50 steps so the finance log (dailyLines) reconciles to the naira.
    const paidSameDay = Math.min(revenue, Math.round((revenue * (0.76 + 0.14 * rand())) / 50) * 50);
    const unpaid = revenue - paidSameDay;
    if (unpaid > 0) {
      const partialPart = Math.round(unpaid * 0.62);
      queue.push({ day: i, amount: partialPart, partial: true });
      queue.push({ day: i, amount: unpaid - partialPart, partial: false });
    }

    // Later collections settle the oldest balances first (FIFO). dailyLines replays
    // the same FIFO over individual visits, so recoveries trace to real bills.
    const outstandingBefore = queue.reduce((s, e) => s + e.amount, 0);
    let collect = Math.min(outstandingBefore, Math.round((outstandingBefore * (0.03 + 0.025 * rand()) * dayFrac) / 50) * 50);
    const collected = collect;
    while (collect > 0 && queue.length) {
      const head = queue[0];
      const take = Math.min(head.amount, collect);
      head.amount -= take;
      collect -= take;
      if (head.amount <= 0) queue.shift();
    }
    while (queue.length && queue[0].amount <= 0) queue.shift();
    const payments = paidSameDay + collected;
    const avgBill = patients > 0 ? revenue / patients : scale.bill;
    const transactions = Math.round(patients * (1 + 0.1 * rand()) + collected / Math.max(avgBill, 1));

    const methodW = [0.2 + 0.05 * rand(), 0.38 + 0.06 * rand(), 0.32 + 0.06 * rand()];
    rand(); // former HMO weight — still drawn so the rest of the demo data stays identical
    const wSum = methodW.reduce((a, b) => a + b, 0);
    const paymentsByMethod = methodW.map((w) => (payments * w) / wSum);

    const b = branch.basePatients;
    const expensesByCategory = [
      revenue * (0.1 + 0.04 * rand()),
      date.getDate() === 25 ? b * scale.salary * (0.97 + 0.06 * rand()) : 0,
      wd === 1 ? b * scale.util * (0.9 + 0.2 * rand()) : 0,
      rand() < 0.06 ? b * scale.maint * (0.5 + rand()) : 0,
      b * scale.logi * (0.6 + 0.8 * rand()) * (wd === 0 ? 0.3 : 1) * dayFrac,
      b * scale.admin * (0.5 + rand()) * dayFrac,
    ].map(Math.round);
    const expenses = expensesByCategory.reduce((a, c) => a + c, 0);

    const aging: AgingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    let outstanding = 0;
    let outstandingUnpaid = 0;
    let outstandingPartial = 0;
    for (const e of queue) {
      const age = i - e.day;
      outstanding += e.amount;
      if (e.partial) outstandingPartial += e.amount;
      else outstandingUnpaid += e.amount;
      if (age <= 30) aging.d0_30 += e.amount;
      else if (age <= 60) aging.d31_60 += e.amount;
      else if (age <= 90) aging.d61_90 += e.amount;
      else aging.d90p += e.amount;
    }

    out.push({
      date: isoDate(date),
      patients,
      newPatients,
      referrals,
      orders,
      completedOrders,
      transactions,
      revenue,
      payments,
      paidAtVisit: paidSameDay,
      recovered: collected,
      expenses,
      serviceCounts,
      referralAgentIds,
      referralRevenue,
      visitBaskets,
      referredPatients,
      paymentsByMethod,
      expensesByCategory,
      outstanding,
      outstandingUnpaid,
      outstandingPartial,
      openBills: Math.round(outstanding / scale.bill),
      aging,
    });
  }
  return out;
}

/** branchId → day records, index 0 = DATA_START. Inactive branches have none. */
export const DAILY: Record<string, DayRecord[]> = Object.fromEntries(
  DEMO_BRANCHES.map((b, idx) => [b.id, generateBranch(b, idx)]),
);
