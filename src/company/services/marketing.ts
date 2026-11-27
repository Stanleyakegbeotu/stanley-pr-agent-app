// GENERATED from the STANLEY desktop app (src/services/marketing.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Marketers (owner, 2026-11-26): hospital ownership.
 *
 * - Each partner hospital belongs to ONE marketer; a marketer can own several.
 *   Every PR agent at that hospital is automatically that marketer's agent.
 * - A marketer's monthly target is the number of patients their hospitals send,
 *   set from their own baseline (the average of the last three full months,
 *   plus 10 %) unless the Branch Manager or Company Admin sets it.
 * - When a marketer leaves, is deactivated or a new one joins, a fair split
 *   of the hospitals is suggested and the manager confirms it. Every change
 *   keeps who, when and why.
 * - Marketers see hospital-level figures only (patients and the amount each
 *   hospital generated), never what a single PR agent generated, commission
 *   or patient details.
 * - Follow-ups are the PR monitor's check-ups (services/agentMonitor), so the
 *   manager and admin see them where they already look. Recruits, new
 *   hospitals and notes are entries here, each with its author.
 *
 * Shared with the mobile app (scripts/sync-company.mjs).
 */
import { useSyncExternalStore } from "react";
import { hospitalKey } from "@company/data/legacy";
import { MARKETER_ROLE, type AgentRecord, type StaffRecord } from "@company/data/userRecords";
import { DATA_START, TODAY } from "@company/data/demo/generator";
import { agentRanking, referralsByDay, resolveRange } from "@company/services/analytics";
import { logAudit } from "@company/services/audit";
import type { CheckUp } from "@company/services/agentMonitor";
import type { DateRange } from "@company/data/types";

/* ─────────────── types ─────────────── */

export interface HospitalOwner {
  marketerId: string;
  since: string;
  by: string;
}
export interface OwnerChange {
  at: string;
  by: string;
  branchId: string;
  hospital: string;
  from: string | null;
  to: string | null;
  reason: string;
}
export interface MonthTarget {
  /** Monthly target amount (older saved targets had "patients" and are ignored). */
  amount?: number;
  patients?: number;
  by: string;
  at: string;
}
export type EntryKind = "recruit" | "visit" | "note" | "hospital";
export const ENTRY_TEXT: Record<EntryKind, string> = { recruit: "Recruited a PR agent", visit: "Hospital visit", note: "Note", hospital: "Registered a hospital" };
export interface MarketEntry {
  id: string;
  branchId: string;
  marketerId: string;
  /** Who wrote it ("Name"); usually the marketer, sometimes the manager. */
  by: string;
  at: string;
  kind: EntryKind;
  hospital?: string;
  agentId?: number;
  text: string;
}
export type PartnerKind = "Hospital" | "Health centre" | "Clinic" | "Maternity" | "Pharmacy" | "Other";
export const PARTNER_KINDS: PartnerKind[] = ["Hospital", "Health centre", "Clinic", "Maternity", "Pharmacy", "Other"];
export type PartnerStatus = "proposed" | "partnered" | "declined";
export const PARTNER_STATUS_TEXT: Record<PartnerStatus, string> = { proposed: "Waiting for the manager", partnered: "Partner", declined: "Not taken on" };
export interface NewPartner {
  id: string;
  branchId: string;
  name: string;
  /** Short code used on PR agent records (e.g. "UATH"). */
  code: string;
  kind: PartnerKind;
  area: string;
  contactName: string;
  contactPhone: string;
  note: string;
  marketerId: string;
  by: string;
  at: string;
  status: PartnerStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

interface State {
  owners: Record<string, Record<string, HospitalOwner>>;
  ownerHistory: OwnerChange[];
  targets: Record<string, MonthTarget>;
  entries: MarketEntry[];
  partners: NewPartner[];
  /** Set by the Branch Manager or the Company Admin (2026-11-27). */
  policy: Record<string, Partial<Policy>>;
  tasks: Record<string, MonthTasks>;
  taskDone: Record<string, string>;
  bonus: Record<string, BonusSetup>;
  rules: Record<string, { notes: string; version: number; at: string; by: string }>;
  acks: Record<string, { version: number; at: string }>;
  transfers: Transfer[];
  cautions: Caution[];
}

/* ─────────────── store ─────────────── */

const KEY = "stanley.marketing.v1";
const EMPTY: State = { owners: {}, ownerHistory: [], targets: {}, entries: [], partners: [], policy: {}, tasks: {}, taskDone: {}, bonus: {}, rules: {}, acks: {}, transfers: [], cautions: [] };
const listeners = new Set<() => void>();
let state: State | null = null;
function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    /* start empty */
  }
  return EMPTY;
}
const current = () => (state ??= load());
function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = null;
      listeners.forEach((l) => l());
    }
  });
export function useMarketing(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    current,
    current,
  );
}
const nowIso = () => new Date().toISOString();
const nextId = (prefix: string, ids: string[]) => `${prefix}-${String(ids.reduce((m, x) => Math.max(m, Number(x.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`;

/* ─────────────── marketers ─────────────── */

export const isMarketer = (s: Pick<StaffRecord, "role">) => s.role === MARKETER_ROLE;
/** Marketers who can own hospitals (active or on leave). */
export const marketersOf = (staff: readonly StaffRecord[], branchId: string, off: (id: string) => boolean = () => false) =>
  staff.filter((s) => s.branchId === branchId && isMarketer(s) && (s.status === "Active" || s.status === "On leave") && !off(s.id)).sort((a, b) => a.name.localeCompare(b.name));

/* ─────────────── hospitals and owners ─────────────── */

export interface HospitalInfo {
  key: string;
  agentIds: number[];
  owner: HospitalOwner | null;
}
/** The branch's partner hospitals (from PR agents' hospitals and approved new partners), with their owner. */
export function hospitalsOf(st: State, branchId: string, agents: readonly AgentRecord[], activeMarketerIds: Set<string>): HospitalInfo[] {
  const map = new Map<string, number[]>();
  for (const a of agents) {
    const k = hospitalKey(a.hospital);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), a.id]);
  }
  for (const p of st.partners) if (p.branchId === branchId && p.status === "partnered" && !map.has(p.code)) map.set(p.code, []);
  const owners = st.owners[branchId] ?? {};
  return [...map.entries()]
    .map(([key, agentIds]) => {
      const o = owners[key];
      return { key, agentIds, owner: o && activeMarketerIds.has(o.marketerId) ? o : null };
    })
    .sort((a, b) => b.agentIds.length - a.agentIds.length || a.key.localeCompare(b.key));
}

/** Give a hospital to a marketer (or take it away with null). */
export function setHospitalOwner(branchId: string, hospital: string, marketerId: string | null, by: string, reason: string) {
  const st = current();
  const owners = { ...(st.owners[branchId] ?? {}) };
  const from = owners[hospital]?.marketerId ?? null;
  if (from === marketerId) return;
  if (marketerId) owners[hospital] = { marketerId, since: nowIso(), by };
  else delete owners[hospital];
  commit({ ...st, owners: { ...st.owners, [branchId]: owners }, ownerHistory: [{ at: nowIso(), by, branchId, hospital, from, to: marketerId, reason: reason.trim() }, ...st.ownerHistory] });
}

export interface Move {
  hospital: string;
  agents: number;
  from: string | null;
  to: string;
}
/**
 * A fair split: hospitals without an (active) marketer go to the marketer with
 * the fewest PR agents so far. With `rebalance`, it also evens out loads by
 * moving whole hospitals from the busiest marketer to the lightest while that
 * makes the split fairer (used when a new marketer joins).
 */
export function suggestSplit(hospitals: HospitalInfo[], marketerIds: string[], rebalance: boolean): Move[] {
  if (!marketerIds.length) return [];
  const load = new Map(marketerIds.map((id) => [id, 0]));
  const owner = new Map<string, string>();
  for (const h of hospitals) if (h.owner && load.has(h.owner.marketerId)) (owner.set(h.key, h.owner.marketerId), load.set(h.owner.marketerId, load.get(h.owner.marketerId)! + h.agentIds.length));
  const moves = new Map<string, Move>();
  const lightest = () => [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]![0];
  for (const h of hospitals) {
    if (owner.has(h.key)) continue;
    const to = lightest();
    owner.set(h.key, to);
    load.set(to, load.get(to)! + h.agentIds.length);
    moves.set(h.key, { hospital: h.key, agents: h.agentIds.length, from: h.owner?.marketerId ?? null, to });
  }
  if (rebalance) {
    for (let guard = 0; guard < 200; guard++) {
      const sorted = [...load.entries()].sort((a, b) => b[1] - a[1]);
      const [heavy, hl] = sorted[0]!;
      const [light, ll] = sorted[sorted.length - 1]!;
      // The heavy marketer's hospital that best closes the gap without overshooting.
      const gap = hl - ll;
      const pick = hospitals.filter((h) => owner.get(h.key) === heavy && h.agentIds.length > 0 && h.agentIds.length < gap).sort((a, b) => Math.abs(gap / 2 - a.agentIds.length) - Math.abs(gap / 2 - b.agentIds.length))[0];
      if (!pick) break;
      owner.set(pick.key, light);
      load.set(heavy, hl - pick.agentIds.length);
      load.set(light, ll + pick.agentIds.length);
      const before = moves.get(pick.key)?.from ?? hospitals.find((h) => h.key === pick.key)?.owner?.marketerId ?? null;
      if (before === light) moves.delete(pick.key);
      else moves.set(pick.key, { hospital: pick.key, agents: pick.agentIds.length, from: before, to: light });
    }
  }
  return [...moves.values()].sort((a, b) => b.agents - a.agents);
}
/** Until the database is connected: a branch with marketers but no owners at all gets a first fair split once (marked as a sample in the history). */
export function seedOwners(branchId: string, hospitals: HospitalInfo[], marketerIds: string[]) {
  const st = current();
  if (!marketerIds.length || !hospitals.length || Object.keys(st.owners[branchId] ?? {}).length || st.ownerHistory.some((h) => h.branchId === branchId)) return;
  applyMoves(branchId, suggestSplit(hospitals, marketerIds, false), "STANLEY", "Sample split (until the manager sets it)");
}
export function applyMoves(branchId: string, moves: Move[], by: string, reason: string) {
  for (const m of moves) setHospitalOwner(branchId, m.hospital, m.to, by, reason);
}

/* ─────────────── figures (hospital level) ─────────────── */

export const monthKey = (d = TODAY) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + by, 1);
  return monthKey(d);
}
export function monthRange(ym: string): DateRange {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  return resolveRange({ key: "custom", from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` });
}
export const monthName = (ym: string, long = false) => new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-GB", { month: long ? "long" : "short", year: "numeric" });

export interface HospitalFigures {
  patients: number;
  revenue: number;
  /** PR agents who sent at least one patient. */
  referring: number;
}
const figCache = new Map<string, Map<string, HospitalFigures>>();
/** Patients and money per hospital (by each agent's current hospital), cached per day. */
export function hospitalFigures(branchId: string, r: DateRange, agents: readonly AgentRecord[]): Map<string, HospitalFigures> {
  const key = `${branchId}|${r.from.toDateString()}|${r.to.toDateString()}|${agents.length}|${TODAY.toDateString()}`;
  const hit = figCache.get(key);
  if (hit) return hit;
  const where = new Map(agents.map((a) => [a.id, hospitalKey(a.hospital)]));
  const out = new Map<string, HospitalFigures>();
  for (const a of agentRanking([branchId], r)) {
    const k = where.get(a.id) ?? a.hospitalKey;
    if (!k) continue;
    const f = out.get(k) ?? { patients: 0, revenue: 0, referring: 0 };
    f.patients += a.referrals;
    f.revenue += Object.values(a.revenue).reduce((s, n) => s + (n ?? 0), 0);
    f.referring += 1;
    out.set(k, f);
  }
  if (figCache.size > 60) figCache.clear();
  figCache.set(key, out);
  return out;
}
const sumFor = (figs: Map<string, HospitalFigures>, keys: string[]) =>
  keys.reduce((s, k) => {
    const f = figs.get(k);
    return f ? { patients: s.patients + f.patients, revenue: s.revenue + f.revenue, referring: s.referring + f.referring } : s;
  }, { patients: 0, revenue: 0, referring: 0 } as HospitalFigures);

/* ─────────────── targets and progress ─────────────── */
/*
 * Targets are MONEY (owner, 2026-11-26): the amount a marketer's hospitals
 * generate in the month, not the number of patients. Each month also splits
 * into weekly targets (the month's target spread over its days).
 */

const targetKey = (branchId: string, marketerId: string, ym: string) => `${branchId}|${marketerId}|${ym}`;
/** Set (or clear with null) a marketer's target for a month, in the branch currency. */
export function setTarget(branchId: string, marketerId: string, ym: string, amount: number | null, by: string) {
  const st = current();
  const targets = { ...st.targets };
  if (amount === null) delete targets[targetKey(branchId, marketerId, ym)];
  else targets[targetKey(branchId, marketerId, ym)] = { amount: Math.max(1000, Math.round(amount)), by, at: nowIso() };
  commit({ ...st, targets });
}
/** Round a suggested target to a tidy figure (nearest ₦10,000). */
const tidy = (n: number) => Math.max(50_000, Math.round(n / 10_000) * 10_000);

export interface WeekProgress {
  /** Monday of the week (yyyy-mm-dd) and the last day counted. */
  from: string;
  to: string;
  revenue: number;
  patients: number;
  target: number;
  pct: number;
  /** Where an even pace puts them by today (0–1). */
  pace: number;
}

export interface Progress {
  marketerId: string;
  month: string;
  hospitals: string[];
  agents: number;
  /** Patients who attended from their hospitals this month. */
  patients: number;
  /** Amount their hospitals generated this month (the target is on this). */
  revenue: number;
  referring: number;
  /** Same days of last month, for a fair comparison mid-month. */
  lastMonthSoFar: number;
  lastMonthSoFarRevenue: number;
  lastMonth: number;
  lastMonthRevenue: number;
  /** Average amount of the three full months before. */
  baseline: number;
  baselinePatients: number;
  /** Monthly target (money). */
  target: number;
  targetSetBy: string | null;
  /** Share of the target reached (0–1+). */
  pct: number;
  /** Where they should be by today at an even pace (0–1). */
  pace: number;
  week: WeekProgress;
  followUps: number;
  /** Follow-ups logged this week (Monday to today). */
  weekFollowUps: number;
  recruits: number;
  newHospitals: number;
  /** New partner hospitals taken on this month (registered by them). */
  sourcedHospitals: number;
  /** New PR agents they brought in who sent a first patient this month. */
  firstPatientAgents: number;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Monday of the week containing d. */
export function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * A marketer's month: the amount their hospitals generated against the target,
 * and this week. Referrals are credited to the marketer who owned the hospital
 * on the day the patient came (owner, 2026-11-27): a hospital moved mid-month
 * keeps its earlier patients with the marketer who had it then.
 */
export function progressFor(st: State, branchId: string, marketerId: string, hospitals: HospitalInfo[], agents: readonly AgentRecord[], checkUps: CheckUp[], ym = monthKey(), byName?: string): Progress {
  const mine = hospitals.filter((h) => h.owner?.marketerId === marketerId);
  const keys = mine.map((h) => h.key);
  const agentIds = new Set(mine.flatMap((h) => h.agentIds));
  const thisRange = monthRange(ym);
  const now = creditedFigures(st, branchId, marketerId, thisRange, agents);
  const prevYm = shiftMonth(ym, -1);
  const prevRange = monthRange(prevYm);
  const prev = creditedFigures(st, branchId, marketerId, prevRange, agents);
  const dayOfMonth = thisRange.to.getDate();
  const prevSoFarRange = resolveRange({ key: "custom", from: `${prevYm}-01`, to: `${prevYm}-${String(Math.min(dayOfMonth, prevRange.to.getDate())).padStart(2, "0")}` });
  const prevSoFar = creditedFigures(st, branchId, marketerId, prevSoFarRange, agents);
  // The usual month of the hospitals they have now (whoever had them before).
  const base = [1, 2, 3].map((n) => sumFor(hospitalFigures(branchId, monthRange(shiftMonth(ym, -n)), agents), keys));
  const baseline = Math.round(base.reduce((s2, x) => s2 + x.revenue, 0) / 3);
  const baselinePatients = Math.round(base.reduce((s2, x) => s2 + x.patients, 0) / 3);
  const set = st.targets[targetKey(branchId, marketerId, ym)];
  const t = tasksFor(st, branchId, marketerId, ym);
  const fromTasks = t.amountMode === "fixed" && t.fixedAmount > 0 ? t.fixedAmount : tidy(baseline * (1 + t.autoPct / 100));
  const target = set?.amount ?? fromTasks;
  const daysIn = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate();
  const isCurrent = ym === monthKey();
  const pace = isCurrent ? Math.min(1, dayOfMonth / daysIn) : 1;
  // This week (Monday to today), or the month's last week for a past month.
  const end = isCurrent ? TODAY : thisRange.to;
  const ws = weekStartOf(end);
  const wr = resolveRange({ key: "custom", from: iso(ws), to: iso(end) });
  const w = creditedFigures(st, branchId, marketerId, wr, agents);
  const weekTarget = Math.round((target * 7) / daysIn);
  const weekDays = Math.round((end.getTime() - ws.getTime()) / 86_400_000) + 1;
  const inMonth = (s2: string) => s2.slice(0, 7) === ym;
  const followUps = checkUps.filter((c) => c.branchId === branchId && agentIds.has(c.agentId) && inMonth(c.at) && (!byName || c.by.name === byName)).length;
  const weekFollowUps = checkUps.filter((c) => c.branchId === branchId && agentIds.has(c.agentId) && c.at.slice(0, 10) >= iso(ws) && (!byName || c.by.name === byName)).length;
  const entries = st.entries.filter((e) => e.branchId === branchId && e.marketerId === marketerId && inMonth(e.at));
  // Sourcing: new partner hospitals taken on this month, and new PR agents who sent a first patient.
  const sourcedHospitals = st.partners.filter((p) => p.branchId === branchId && p.marketerId === marketerId && p.status === "partnered" && (p.decidedAt ?? "").slice(0, 7) === ym).length;
  const referred = referrersIn(branchId, thisRange);
  const firstPatientAgents = entries.filter((e) => e.kind === "recruit" && e.agentId != null && referred.has(e.agentId)).length;
  return {
    marketerId,
    month: ym,
    hospitals: keys,
    agents: agentIds.size,
    patients: now.patients,
    revenue: now.revenue,
    referring: now.referring,
    lastMonthSoFar: prevSoFar.patients,
    lastMonthSoFarRevenue: prevSoFar.revenue,
    lastMonth: prev.patients,
    lastMonthRevenue: prev.revenue,
    baseline,
    baselinePatients,
    target,
    targetSetBy: set?.by ?? (st.tasks[`${branchId}|${ym}`]?.setBy ?? null),
    pct: target ? now.revenue / target : 0,
    pace,
    week: { from: iso(ws), to: iso(end), revenue: w.revenue, patients: w.patients, target: weekTarget, pct: weekTarget ? w.revenue / weekTarget : 0, pace: isCurrent ? Math.min(1, weekDays / 7) : 1 },
    followUps,
    weekFollowUps,
    recruits: entries.filter((e) => e.kind === "recruit").length,
    newHospitals: entries.filter((e) => e.kind === "hospital").length,
    sourcedHospitals,
    firstPatientAgents,
  };
}

/** Day-by-day amount and patients for their hospitals (for charts). */
export function dailyFor(branchId: string, keys: string[], r: DateRange, agents: readonly AgentRecord[]): { date: string; revenue: number; patients: number }[] {
  const out: { date: string; revenue: number; patients: number }[] = [];
  for (let d = new Date(r.from); d <= r.to; d.setDate(d.getDate() + 1)) {
    const day = resolveRange({ key: "custom", from: iso(d), to: iso(d) });
    const f = sumFor(hospitalFigures(branchId, day, agents), keys);
    out.push({ date: iso(d), revenue: f.revenue, patients: f.patients });
  }
  return out;
}

/** On track, behind or ahead, in plain words. */
export function paceWord(p: Progress): { tone: "ok" | "warn" | "danger" | "brand"; text: string } {
  if (p.pct >= 1) return { tone: "brand", text: "Target reached" };
  const ratio = p.pace ? p.pct / p.pace : 0;
  if (ratio >= 1) return { tone: "ok", text: "On track" };
  if (ratio >= 0.8) return { tone: "warn", text: "A little behind" };
  return { tone: "danger", text: "Behind" };
}

/* ─────────────── entries (each with its author) ─────────────── */

export function addEntry(e: Omit<MarketEntry, "id" | "at">): MarketEntry {
  const st = current();
  const made: MarketEntry = { ...e, text: e.text.trim(), id: nextId("MKT", st.entries.map((x) => x.id)), at: nowIso() };
  commit({ ...st, entries: [made, ...st.entries] });
  return made;
}

/* ─────────────── new partners (report centre) ─────────────── */

const simplify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|hospital|hosp|general|specialist|medical|centre|center|clinic|health|ltd|limited|and|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function close(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  // Edit distance ≤ 2 for short names, quick DP.
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]! <= 2;
}
/** Hospitals already known (on PR agent records or registered) that look like this one. */
export function possibleDuplicates(st: State, branchId: string, name: string, code: string, knownCodes: string[]): string[] {
  const n = simplify(name);
  const c = code.trim().toUpperCase();
  const out = new Set<string>();
  for (const k of knownCodes) if ((c && k === c) || close(simplify(k), n) || (c.length >= 3 && close(k.toLowerCase(), c.toLowerCase()))) out.add(k);
  for (const p of st.partners) if (p.branchId === branchId && p.status !== "declined" && (close(simplify(p.name), n) || (c && p.code === c))) out.add(`${p.name} (${p.code})`);
  return [...out].slice(0, 5);
}
export function registerPartner(p: Omit<NewPartner, "id" | "at" | "status">): NewPartner {
  const st = current();
  const made: NewPartner = { ...p, name: p.name.trim(), code: p.code.trim().toUpperCase(), id: nextId("HSP", st.partners.map((x) => x.id)), at: nowIso(), status: "proposed" };
  const entry: MarketEntry = { id: nextId("MKT", st.entries.map((x) => x.id)), branchId: p.branchId, marketerId: p.marketerId, by: p.by, at: made.at, kind: "hospital", hospital: made.code, text: `${made.name} (${made.kind}${made.area ? `, ${made.area}` : ""})` };
  commit({ ...st, partners: [made, ...st.partners], entries: [entry, ...st.entries] });
  return made;
}
/** The manager takes the new partner on (it becomes the registering marketer's hospital) or declines it. */
export function decidePartner(id: string, status: Exclude<PartnerStatus, "proposed">, by: string, note: string) {
  const st = current();
  const p = st.partners.find((x) => x.id === id);
  if (!p) return;
  commit({ ...st, partners: st.partners.map((x) => (x.id === id ? { ...x, status, decidedBy: by, decidedAt: nowIso(), decisionNote: note.trim() || undefined } : x)) });
  if (status === "partnered") setHospitalOwner(p.branchId, p.code, p.marketerId, by, `New partner registered by the marketer`);
}

/* ═══════════════ Marketing rules (owner, 2026-11-27) ═══════════════
 * Everything here is set by the Branch Manager or the Company Admin from the
 * Marketing page, not fixed in the app: the policy (handover, dormant, locks),
 * each month's tasks, the bonus, and the written rules of engagement. */

/* ─────────────── policy ─────────────── */

export interface Policy {
  /** Days a moved hospital is "in handover" (getting to know its agents). */
  handoverDays: 7 | 14;
  /** Days without a patient before a hospital is flagged dormant. */
  dormantDays: number;
  /** After the marketer answers a caution, days before it is flagged again if still dormant. */
  snoozeDays: number;
  /** Days the marketer has to answer a caution. */
  replyDays: number;
  /** Each marketer's best hospitals that can't be moved while their account is active. */
  lockTop: number;
  /** A hospital with this many PR agents or fewer needs growth (more agents). */
  growthMaxAgents: number;
}
export const DEFAULT_POLICY: Policy = { handoverDays: 7, dormantDays: 30, snoozeDays: 21, replyDays: 5, lockTop: 3, growthMaxAgents: 3 };
export const policyOf = (st: State, branchId: string): Policy => ({ ...DEFAULT_POLICY, ...(st.policy[branchId] ?? {}) });
export function setPolicy(branchId: string, patch: Partial<Policy>, by: string) {
  const st = current();
  const rules = st.rules[branchId] ?? { notes: "", version: 0, at: nowIso(), by };
  commit({ ...st, policy: { ...st.policy, [branchId]: { ...(st.policy[branchId] ?? {}), ...patch } }, rules: { ...st.rules, [branchId]: { ...rules, version: rules.version + 1, at: nowIso(), by } } });
  logAudit({ category: "PR agents", action: "Marketing rules changed", record: Object.keys(patch).join(", "), details: `By ${by}`, branchId });
}

/* ─────────────── monthly tasks ─────────────── */

export interface TaskSet {
  /** The money target: the hospitals' usual month plus a share, or a fixed amount. */
  amountMode: "auto" | "fixed";
  autoPct: number;
  fixedAmount: number;
  /** New partner hospitals to bring in this month. */
  newHospitals: number;
  /** New PR agents who send a first patient this month. */
  newAgents: number;
  /** Follow-ups to log each week. */
  followUpsPerWeek: number;
}
export const DEFAULT_TASKS: TaskSet = { amountMode: "auto", autoPct: 10, fixedAmount: 0, newHospitals: 1, newAgents: 2, followUpsPerWeek: 10 };
export interface CustomTask {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  due?: string;
  /** Empty: every marketer. */
  marketerIds: string[];
}
export interface MonthTasks {
  ym: string;
  base: TaskSet;
  overrides: Record<string, Partial<TaskSet>>;
  custom: CustomTask[];
  setBy: string;
  at: string;
  /** Carried over from an earlier month automatically (nobody set this month). */
  carried?: boolean;
}
const taskKey = (branchId: string, ym: string) => `${branchId}|${ym}`;
/** This month's tasks as set, or the last month that was set (shown as carried over), or the defaults. */
export function effectiveTasks(st: State, branchId: string, ym = monthKey()): { tasks: MonthTasks; set: boolean } {
  const own = st.tasks[taskKey(branchId, ym)];
  if (own) return { tasks: own, set: true };
  for (let n = 1; n <= 12; n++) {
    const prev = st.tasks[taskKey(branchId, shiftMonth(ym, -n))];
    if (prev) return { tasks: { ...prev, ym, carried: true, custom: [] }, set: false };
  }
  return { tasks: { ym, base: DEFAULT_TASKS, overrides: {}, custom: [], setBy: "", at: "", carried: true }, set: false };
}
export function tasksFor(st: State, branchId: string, marketerId: string, ym = monthKey()): TaskSet & { custom: CustomTask[] } {
  const { tasks } = effectiveTasks(st, branchId, ym);
  return { ...tasks.base, ...(tasks.overrides[marketerId] ?? {}), custom: tasks.custom.filter((c) => !c.marketerIds.length || c.marketerIds.includes(marketerId)) };
}
export function saveMonthTasks(branchId: string, ym: string, t: Pick<MonthTasks, "base" | "overrides" | "custom">, by: string, carried = false) {
  const st = current();
  commit({ ...st, tasks: { ...st.tasks, [taskKey(branchId, ym)]: { ym, ...t, setBy: by, at: nowIso(), carried } } });
  logAudit({ category: "PR agents", action: carried ? "Marketer tasks carried over" : "Marketer tasks set", record: monthName(ym, true), details: `By ${by}`, branchId });
}
/** Keep last month's tasks for this month (one tap). */
export function keepLastMonthTasks(branchId: string, ym: string, by: string) {
  const { tasks } = effectiveTasks(current(), branchId, ym);
  saveMonthTasks(branchId, ym, { base: tasks.base, overrides: tasks.overrides, custom: [] }, by);
}
/** From the 3rd of the month, a month nobody set keeps last month's tasks automatically (marketers never start without tasks). */
export function carryOverIfLate(branchId: string) {
  const st = current();
  const ym = monthKey();
  if (st.tasks[taskKey(branchId, ym)] || TODAY.getDate() < 3) return;
  const { tasks } = effectiveTasks(st, branchId, ym);
  if (!tasks.setBy) return;
  saveMonthTasks(branchId, ym, { base: tasks.base, overrides: tasks.overrides, custom: [] }, "STANLEY (carried over)", true);
}
const doneKey = (branchId: string, ym: string, marketerId: string, id: string) => `${branchId}|${ym}|${marketerId}|${id}`;
export const taskDoneAt = (st: State, branchId: string, ym: string, marketerId: string, id: string) => st.taskDone[doneKey(branchId, ym, marketerId, id)];
export function setTaskDone(branchId: string, ym: string, marketerId: string, id: string, done: boolean) {
  const st = current();
  const next = { ...st.taskDone };
  if (done) next[doneKey(branchId, ym, marketerId, id)] = nowIso();
  else delete next[doneKey(branchId, ym, marketerId, id)];
  commit({ ...st, taskDone: next });
}

/* ─────────────── bonus ─────────────── */

export type BonusKind = "none" | "fixed" | "percentOver" | "percentAll";
export const BONUS_TEXT: Record<BonusKind, string> = { none: "No money bonus", fixed: "A fixed amount", percentOver: "A share of the amount over target", percentAll: "A share of everything generated" };
export interface BonusPlan {
  kind: BonusKind;
  /** Fixed amount (kind "fixed"). */
  amount: number;
  /** Percent (kinds "percentOver" / "percentAll"). */
  pct: number;
  /** Share of the money target that must be reached to qualify (100 = the full target). */
  minPct: number;
  /** Extra for each new partner hospital and each new PR agent with a first patient. */
  perHospital: number;
  perAgent: number;
  /** Anything else (a gift, a day off, recognition). */
  note: string;
}
export interface BonusSetup {
  base: BonusPlan;
  overrides: Record<string, Partial<BonusPlan>>;
  setBy: string;
  at: string;
}
export const EMPTY_BONUS: BonusPlan = { kind: "none", amount: 0, pct: 0, minPct: 100, perHospital: 0, perAgent: 0, note: "" };
export function bonusFor(st: State, branchId: string, marketerId: string): BonusPlan | null {
  const b = st.bonus[branchId];
  return b ? { ...b.base, ...(b.overrides[marketerId] ?? {}) } : null;
}
export function setBonus(branchId: string, setup: Pick<BonusSetup, "base" | "overrides">, by: string) {
  const st = current();
  commit({ ...st, bonus: { ...st.bonus, [branchId]: { ...setup, setBy: by, at: nowIso() } } });
  logAudit({ category: "PR agents", action: "Marketer bonus set", record: BONUS_TEXT[setup.base.kind], details: `By ${by}`, branchId });
}
/** What the bonus comes to now, and if they reach the target. */
export function bonusEstimate(plan: BonusPlan, p: Progress): { qualifies: boolean; now: number; atTarget: number; extras: number } {
  const extras = plan.perHospital * p.sourcedHospitals + plan.perAgent * p.firstPatientAgents;
  const money = (rev: number) => (plan.kind === "fixed" ? plan.amount : plan.kind === "percentOver" ? Math.max(0, rev - p.target) * (plan.pct / 100) : plan.kind === "percentAll" ? rev * (plan.pct / 100) : 0);
  const qualifies = p.pct * 100 >= plan.minPct;
  const atTarget = money(Math.max(p.revenue, p.target * (plan.minPct / 100)));
  return { qualifies, now: (qualifies ? money(p.revenue) : 0) + extras, atTarget: atTarget + extras, extras };
}

/* ─────────────── rules of engagement ─────────────── */

export const rulesVersion = (st: State, branchId: string) => st.rules[branchId]?.version ?? 0;
export function setRulesNotes(branchId: string, notes: string, by: string) {
  const st = current();
  const r = st.rules[branchId] ?? { notes: "", version: 0, at: "", by };
  commit({ ...st, rules: { ...st.rules, [branchId]: { notes: notes.trim(), version: r.version + 1, at: nowIso(), by } } });
  logAudit({ category: "PR agents", action: "Rules of engagement updated", record: `Version ${r.version + 1}`, details: `By ${by}`, branchId });
}
export function ackRules(marketerId: string, version: number) {
  const st = current();
  commit({ ...st, acks: { ...st.acks, [marketerId]: { version, at: nowIso() } } });
}
export const hasAgreed = (st: State, branchId: string, marketerId: string) => (st.acks[marketerId]?.version ?? -1) >= rulesVersion(st, branchId);
/** The written rules, with the branch's own numbers filled in. */
export function rulesText(st: State, branchId: string): { title: string; points: string[] }[] {
  const pol = policyOf(st, branchId);
  const t = effectiveTasks(st, branchId).tasks.base;
  const b = st.bonus[branchId]?.base;
  return [
    { title: "Your hospitals", points: ["Each partner hospital belongs to one marketer. Every PR agent at that hospital is yours to look after.", "Your Branch Manager gives you your hospitals. A hospital you bring in becomes yours once the manager takes it on."] },
    { title: "Your best hospitals are protected", points: [`Your top ${pol.lockTop} hospitals (by the amount they generated over the last three full months) are locked: nobody can move them while your account is active.`, "A locked hospital can only move if your account is deactivated, or if it becomes dormant and is not revived."] },
    { title: "Moving a hospital", points: ["Your manager can ask you to release one of your other hospitals to a colleague. You agree or decline, with a reason.", "You can offer one of your hospitals to a colleague. They must accept, and your manager must approve it.", "When a hospital moves, its PR agents move with it, and the new marketer sees everything from the day it is approved."] },
    { title: "Who gets the credit", points: ["A patient counts for the marketer who had the hospital on the day the patient came. Patients before a move stay with the marketer who had it then.", "Your target includes the hospitals you have; when one moves, the new marketer carries it from then on."] },
    { title: "The handover", points: [`After a move there is a ${pol.handoverDays}-day handover: the previous marketer introduces the new one to the doctors, and the new marketer contacts every PR agent there.`] },
    { title: "Dormant hospitals", points: [`A hospital that sends no patient for ${pol.dormantDays} days is flagged dormant (a hospital new to you gets ${pol.dormantDays} days first).`, `Your manager may send you a caution. Answer within ${pol.replyDays} days: why, and your plan to revive it.`, `If it is still dormant ${pol.snoozeDays} days after your answer, it is flagged again. A dormant hospital may be moved to a colleague to revive it.`] },
    { title: "Growing small hospitals", points: [`A hospital with ${pol.growthMaxAgents} PR agents or fewer needs growth: meet more doctors and nurses there and bring in new PR agents.`] },
    { title: "Your monthly tasks", points: [t.amountMode === "fixed" && t.fixedAmount ? `A money target set by your manager.` : `A money target: your hospitals' usual month plus ${t.autoPct}% (unless your manager sets an amount).`, `Bring in ${t.newHospitals} new partner hospital${t.newHospitals === 1 ? "" : "s"} and ${t.newAgents} new PR agent${t.newAgents === 1 ? "" : "s"} who send a first patient.`, `Log at least ${t.followUpsPerWeek} follow-ups a week.`, "Your manager sets the tasks at the start of each month; if not, last month's tasks carry on."] },
    { title: "Bonus", points: [b && b.kind !== "none" ? `Your bonus is set by your manager: ${BONUS_TEXT[b.kind].toLowerCase()}${b.kind === "fixed" ? ` (${b.amount.toLocaleString("en-NG")})` : b.pct ? ` (${b.pct}%)` : ""}, when you reach ${b.minPct}% of your money target.` : "Your manager sets the bonus. It shows on your dashboard once it is set."] },
    { title: "Never", points: ["Never offer money, gifts or discounts to a PR agent or doctor in exchange for patients.", "Never share patient details outside the app."] },
  ];
}

/* ─────────────── who had a hospital when (credit) ─────────────── */

interface Segment {
  owner: string | null;
  from: string;
  to: string | null;
}
/** A hospital's owners over time. The first owner covers everything before them (nobody else had a claim). */
function segmentsOf(st: State, branchId: string, hospital: string): Segment[] {
  const hist = st.ownerHistory.filter((h) => h.branchId === branchId && h.hospital === hospital).sort((a, b) => a.at.localeCompare(b.at));
  if (!hist.length) {
    const o = st.owners[branchId]?.[hospital];
    return o ? [{ owner: o.marketerId, from: "2000-01-01", to: null }] : [];
  }
  return hist.map((h, i) => ({ owner: h.to, from: i === 0 ? "2000-01-01" : h.at.slice(0, 10), to: hist[i + 1]?.at.slice(0, 10) ?? null }));
}
const dayBefore = (d: string) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() - 1);
  return iso(x);
};
/** Patients and amount credited to a marketer over a range, by who had each hospital on each day. */
export function creditedFigures(st: State, branchId: string, marketerId: string, r: DateRange, agents: readonly AgentRecord[]): HospitalFigures {
  const out: HospitalFigures = { patients: 0, revenue: 0, referring: 0 };
  const rf = iso(r.from);
  const rt = iso(r.to);
  const keys = new Set([...Object.entries(st.owners[branchId] ?? {}).filter(([, o]) => o.marketerId === marketerId).map(([k]) => k), ...st.ownerHistory.filter((h) => h.branchId === branchId && (h.to === marketerId || h.from === marketerId)).map((h) => h.hospital)]);
  for (const k of keys) {
    for (const seg of segmentsOf(st, branchId, k)) {
      if (seg.owner !== marketerId) continue;
      const from = seg.from > rf ? seg.from : rf;
      const to = seg.to ? (dayBefore(seg.to) < rt ? dayBefore(seg.to) : rt) : rt;
      if (from > to) continue;
      const f = (from === rf && to === rt ? hospitalFigures(branchId, r, agents) : hospitalFigures(branchId, resolveRange({ key: "custom", from, to }), agents)).get(k);
      if (!f) continue;
      out.patients += f.patients;
      out.revenue += f.revenue;
      out.referring += f.referring;
    }
  }
  return out;
}

const refCache = new Map<string, Set<number>>();
/** PR agents who sent at least one patient in the range. */
export function referrersIn(branchId: string, r: DateRange): Set<number> {
  const k = `${branchId}|${iso(r.from)}|${iso(r.to)}`;
  const hit = refCache.get(k);
  if (hit) return hit;
  const set = new Set<number>();
  for (const d of referralsByDay(branchId, r)) for (const id of d.agentIds) set.add(id);
  if (refCache.size > 40) refCache.clear();
  refCache.set(k, set);
  return set;
}

/* ─────────────── locks, dormant, growth, handover ─────────────── */

/** A marketer's best hospitals (amount over the last three full months): locked while their account is active. */
export function lockedFor(st: State, branchId: string, marketerId: string, hospitals: HospitalInfo[], agents: readonly AgentRecord[]): Set<string> {
  const pol = policyOf(st, branchId);
  const mine = hospitals.filter((h) => h.owner?.marketerId === marketerId);
  const r = resolveRange({ key: "custom", from: `${shiftMonth(monthKey(), -3)}-01`, to: iso(monthRange(shiftMonth(monthKey(), -1)).to) });
  const figs = hospitalFigures(branchId, r, agents);
  return new Set([...mine].sort((a, b) => (figs.get(b.key)?.revenue ?? 0) - (figs.get(a.key)?.revenue ?? 0)).slice(0, pol.lockTop).map((h) => h.key));
}

const lastCache = new Map<string, Map<string, string>>();
/** The last day each hospital sent a patient (last 180 days), by each agent's current hospital. */
export function lastPatientByHospital(branchId: string, agents: readonly AgentRecord[]): Map<string, string> {
  const k = `${branchId}|${agents.length}|${iso(TODAY)}`;
  const hit = lastCache.get(k);
  if (hit) return hit;
  const where = new Map(agents.map((a) => [a.id, hospitalKey(a.hospital)]));
  const from = new Date(TODAY);
  from.setDate(from.getDate() - 179);
  const out = new Map<string, string>();
  for (const d of referralsByDay(branchId, resolveRange({ key: "custom", from: iso(from < DATA_START ? DATA_START : from), to: iso(TODAY) }))) {
    for (const id of d.agentIds) {
      const h = where.get(id);
      if (h && (out.get(h) ?? "") < d.date) out.set(h, d.date);
    }
  }
  lastCache.clear();
  lastCache.set(k, out);
  return out;
}

export type DormantState = "active" | "grace" | "flagged" | "cautioned" | "overdue" | "snoozed" | "revived";
export interface HospitalStatus {
  key: string;
  owner: string | null;
  lastPatient: string | null;
  daysSince: number | null;
  dormant: DormantState;
  /** Open caution (waiting for an answer), or the latest answered one. */
  caution?: Caution;
  cautions: number;
  snoozedUntil?: string;
  growth: boolean;
  handoverUntil?: string;
  handoverFrom?: string | null;
  locked: boolean;
}
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return iso(x);
};
/** Dormant, growth, handover and lock state for each hospital. */
export function hospitalStatuses(st: State, branchId: string, hospitals: HospitalInfo[], agents: readonly AgentRecord[]): Map<string, HospitalStatus> {
  const pol = policyOf(st, branchId);
  const today = iso(TODAY);
  const last = lastPatientByHospital(branchId, agents);
  const locks = new Map<string, Set<string>>();
  const out = new Map<string, HospitalStatus>();
  for (const h of hospitals) {
    const owner = h.owner?.marketerId ?? null;
    if (owner && !locks.has(owner)) locks.set(owner, lockedFor(st, branchId, owner, hospitals, agents));
    const lp = last.get(h.key) ?? null;
    const daysSince = lp ? daysBetween(lp, today) : null;
    const since = st.ownerHistory.filter((x) => x.branchId === branchId && x.hospital === h.key).sort((a, b) => b.at.localeCompare(a.at))[0];
    const ownedFrom = since?.at.slice(0, 10) ?? null;
    const isFirst = since ? !st.ownerHistory.some((x) => x.branchId === branchId && x.hospital === h.key && x.at < since.at) : true;
    const cs = st.cautions.filter((c) => c.branchId === branchId && c.hospital === h.key).sort((a, b) => b.at.localeCompare(a.at));
    const latest = cs[0];
    const quiet = daysSince === null || daysSince >= pol.dormantDays;
    let dormant: DormantState = "active";
    // A hospital new to its marketer gets the full dormant period first (the sample first split doesn't count).
    const inGrace = !!owner && !!ownedFrom && !isFirst && daysBetween(ownedFrom, today) < pol.dormantDays;
    if (latest && lp && lp > latest.at.slice(0, 10) && daysBetween(lp, today) <= 14) dormant = "revived";
    else if (quiet && owner) {
      if (inGrace) dormant = "grace";
      else if (latest && !latest.reply && daysBetween(latest.at.slice(0, 10), today) <= pol.replyDays) dormant = "cautioned";
      else if (latest && !latest.reply && daysBetween(latest.at.slice(0, 10), today) < pol.snoozeDays) dormant = "overdue";
      else if (latest?.reply && daysBetween(latest.reply.at.slice(0, 10), today) < pol.snoozeDays) dormant = "snoozed";
      else dormant = "flagged";
    }
    const lastMove = since && since.from ? since : undefined;
    const handoverUntil = lastMove ? addDays(lastMove.at.slice(0, 10), pol.handoverDays) : undefined;
    out.set(h.key, {
      key: h.key,
      owner,
      lastPatient: lp,
      daysSince,
      dormant,
      caution: latest,
      cautions: cs.length,
      snoozedUntil: latest?.reply ? addDays(latest.reply.at.slice(0, 10), pol.snoozeDays) : undefined,
      growth: h.agentIds.length <= pol.growthMaxAgents,
      handoverUntil: handoverUntil && handoverUntil >= today ? handoverUntil : undefined,
      handoverFrom: handoverUntil && handoverUntil >= today ? (lastMove?.from ?? null) : undefined,
      locked: !!owner && !!locks.get(owner)?.has(h.key),
    });
  }
  return out;
}
export const DORMANT_TEXT: Record<DormantState, string> = { active: "Sending patients", grace: "New to its marketer", flagged: "Dormant", cautioned: "Caution sent", overdue: "No answer yet", snoozed: "Answered: watching", revived: "Revived" };
/** Dormant hospitals that need the manager's attention now. */
export const needsAction = (s: HospitalStatus) => s.dormant === "flagged" || s.dormant === "overdue";

/* ─────────────── cautions ─────────────── */

export const CAUTION_REASONS = ["The doctor or PR agent left", "Patients go to another lab", "A problem with our service", "The hospital is closed or slow", "Other"] as const;
export interface Caution {
  id: string;
  branchId: string;
  hospital: string;
  marketerId: string;
  by: string;
  at: string;
  message: string;
  reply?: { reason: string; plan: string; date: string; at: string };
}
export function sendCaution(c: Omit<Caution, "id" | "at">): Caution {
  const st = current();
  const made: Caution = { ...c, message: c.message.trim(), id: nextId("CAU", st.cautions.map((x) => x.id)), at: nowIso() };
  commit({ ...st, cautions: [made, ...st.cautions] });
  logAudit({ category: "PR agents", action: "Dormant hospital caution sent", record: c.hospital, details: `${c.message.trim()} · by ${c.by}`, branchId: c.branchId });
  return made;
}
export function replyCaution(id: string, reply: { reason: string; plan: string; date: string }, by: string) {
  const st = current();
  const c = st.cautions.find((x) => x.id === id);
  commit({ ...st, cautions: st.cautions.map((x) => (x.id === id ? { ...x, reply: { ...reply, plan: reply.plan.trim(), at: nowIso() } } : x)) });
  if (c) logAudit({ category: "PR agents", action: "Caution answered", record: c.hospital, details: `${reply.reason} · ${reply.plan.trim()} · by ${by}`, branchId: c.branchId });
}

/* ─────────────── transfers ─────────────── */

/** request: the manager asks the owner to release it. offer: a marketer offers it to a colleague (the colleague accepts, then the manager approves). direct: the manager moves it (no marketer, deactivated owner, or dormant). */
export type TransferKind = "request" | "offer" | "direct";
export type TransferStage = "owner" | "receiver" | "manager" | "done" | "declined" | "cancelled";
export const STAGE_LABEL: Record<TransferStage, string> = { owner: "Waiting for the current marketer", receiver: "Waiting for the colleague", manager: "Waiting for the manager", done: "Moved", declined: "Declined", cancelled: "Cancelled" };
export interface Transfer {
  id: string;
  branchId: string;
  hospital: string;
  from: string | null;
  to: string;
  kind: TransferKind;
  reason: string;
  by: string;
  at: string;
  stage: TransferStage;
  steps: { at: string; by: string; action: string; note?: string }[];
}
const step = (by: string, action: string, note?: string) => ({ at: nowIso(), by, action, note: note?.trim() || undefined });
function addTransfer(t: Omit<Transfer, "id" | "at" | "steps">, first: string): Transfer {
  const st = current();
  const made: Transfer = { ...t, reason: t.reason.trim(), id: nextId("TRF", st.transfers.map((x) => x.id)), at: nowIso(), steps: [step(t.by, first, t.reason)] };
  commit({ ...st, transfers: [made, ...st.transfers] });
  return made;
}
function finish(t: Transfer, by: string) {
  setHospitalOwner(t.branchId, t.hospital, t.to, by, t.reason || "Transfer approved");
  logAudit({ category: "PR agents", action: "Hospital moved to another marketer", record: t.hospital, details: `${t.kind === "offer" ? "Offered by the marketer, approved" : t.kind === "request" ? "Released by the marketer" : "Moved by the manager"} · ${t.reason} · ${by}`, branchId: t.branchId });
}
function update(id: string, patch: Partial<Transfer>, s2: ReturnType<typeof step>) {
  const st = current();
  commit({ ...st, transfers: st.transfers.map((x) => (x.id === id ? { ...x, ...patch, steps: [...x.steps, s2] } : x)) });
}
/** Is a move open? Direct for no owner, a deactivated owner or a dormant hospital; locked for the owner's top hospitals; otherwise a request. */
export function moveMode(s: HospitalStatus | undefined, ownerActive: boolean): { mode: "direct" | "request" | "locked"; why: string } {
  if (!s?.owner) return { mode: "direct", why: "No marketer has this hospital." };
  if (!ownerActive) return { mode: "direct", why: "The marketer's account is deactivated." };
  if (s.dormant === "flagged" || s.dormant === "overdue") return { mode: "direct", why: "It is dormant and not revived: you can move it to revive it." };
  if (s.locked) return { mode: "locked", why: "One of the marketer's top hospitals: locked while their account is active." };
  return { mode: "request", why: "The marketer must agree to release it." };
}
export function requestRelease(branchId: string, hospital: string, from: string, to: string, reason: string, by: string) {
  const t = addTransfer({ branchId, hospital, from, to, kind: "request", reason, by, stage: "owner" }, "Asked the marketer to release it");
  logAudit({ category: "PR agents", action: "Asked a marketer to release a hospital", record: hospital, details: `${reason} · ${by}`, branchId });
  return t;
}
export function offerTransfer(branchId: string, hospital: string, from: string, to: string, reason: string, by: string) {
  const t = addTransfer({ branchId, hospital, from, to, kind: "offer", reason, by, stage: "receiver" }, "Offered to a colleague");
  logAudit({ category: "PR agents", action: "Marketer offered a hospital to a colleague", record: hospital, details: `${reason} · ${by}`, branchId });
  return t;
}
export function directMove(branchId: string, hospital: string, from: string | null, to: string, reason: string, by: string) {
  const t = addTransfer({ branchId, hospital, from, to, kind: "direct", reason, by, stage: "done" }, "Moved by the manager");
  finish(t, by);
  return t;
}
/** The current marketer (request) or the colleague (offer) answers. */
export function answerTransfer(id: string, accept: boolean, by: string, note: string) {
  const t = current().transfers.find((x) => x.id === id);
  if (!t) return;
  if (!accept) return update(id, { stage: "declined" }, step(by, t.stage === "owner" ? "Declined to release it" : "Declined the hospital", note));
  if (t.stage === "owner") {
    update(id, { stage: "done" }, step(by, "Agreed to release it", note));
    finish(t, by);
  } else if (t.stage === "receiver") update(id, { stage: "manager" }, step(by, "Accepted the hospital", note));
}
export function decideTransfer(id: string, approve: boolean, by: string, note: string) {
  const t = current().transfers.find((x) => x.id === id);
  if (!t || t.stage !== "manager") return;
  update(id, { stage: approve ? "done" : "declined" }, step(by, approve ? "Approved by the manager" : "Not approved by the manager", note));
  if (approve) finish(t, by);
}
export function cancelTransfer(id: string, by: string) {
  update(id, { stage: "cancelled" }, step(by, "Cancelled"));
}

/* ─────────────── setup indicator ─────────────── */

export interface SetupItem {
  key: "tasks" | "bonus" | "rules" | "owners";
  label: string;
  done: boolean;
  hint: string;
}
/** What the manager still has to set up (shown on the Marketing page and as a count in the menu). */
export function setupStatus(st: State, branchId: string, unowned: number): SetupItem[] {
  const ym = monthKey();
  const t = st.tasks[taskKey(branchId, ym)];
  return [
    { key: "tasks", label: `${monthName(ym, true)} tasks for marketers`, done: !!t && !t.carried, hint: t?.carried ? "Carried over from last month automatically. Confirm or change them." : "Set this month's targets and tasks, or keep last month's." },
    { key: "bonus", label: "Marketer bonus", done: !!st.bonus[branchId], hint: "Set what marketers earn when they reach their target." },
    { key: "rules", label: "Rules of engagement", done: !!st.rules[branchId], hint: "Review the rules (handover, dormant, locks) and publish them to marketers." },
    { key: "owners", label: "Every hospital has a marketer", done: unowned === 0, hint: `${unowned} hospital${unowned === 1 ? "" : "s"} without a marketer.` },
  ];
}
