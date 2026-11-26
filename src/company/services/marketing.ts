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
import { TODAY } from "@company/data/demo/generator";
import { agentRanking, resolveRange } from "@company/services/analytics";
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
  patients: number;
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
}

/* ─────────────── store ─────────────── */

const KEY = "stanley.marketing.v1";
const EMPTY: State = { owners: {}, ownerHistory: [], targets: {}, entries: [], partners: [] };
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

const targetKey = (branchId: string, marketerId: string, ym: string) => `${branchId}|${marketerId}|${ym}`;
export function setTarget(branchId: string, marketerId: string, ym: string, patients: number | null, by: string) {
  const st = current();
  const targets = { ...st.targets };
  if (patients === null) delete targets[targetKey(branchId, marketerId, ym)];
  else targets[targetKey(branchId, marketerId, ym)] = { patients: Math.max(1, Math.round(patients)), by, at: nowIso() };
  commit({ ...st, targets });
}

export interface Progress {
  marketerId: string;
  month: string;
  hospitals: string[];
  agents: number;
  patients: number;
  revenue: number;
  referring: number;
  /** Same days of last month, for a fair comparison mid-month. */
  lastMonthSoFar: number;
  lastMonth: number;
  /** Average of the three full months before. */
  baseline: number;
  target: number;
  targetSetBy: string | null;
  /** Share of the target reached (0–1+). */
  pct: number;
  /** Where they should be by today at an even pace (0–1). */
  pace: number;
  followUps: number;
  recruits: number;
  newHospitals: number;
}

/** A marketer's month: their hospitals' patients against the target. */
export function progressFor(st: State, branchId: string, marketerId: string, hospitals: HospitalInfo[], agents: readonly AgentRecord[], checkUps: CheckUp[], ym = monthKey(), byName?: string): Progress {
  const mine = hospitals.filter((h) => h.owner?.marketerId === marketerId);
  const keys = mine.map((h) => h.key);
  const agentIds = new Set(mine.flatMap((h) => h.agentIds));
  const thisRange = monthRange(ym);
  const now = sumFor(hospitalFigures(branchId, thisRange, agents), keys);
  const prevYm = shiftMonth(ym, -1);
  const prevRange = monthRange(prevYm);
  const prev = sumFor(hospitalFigures(branchId, prevRange, agents), keys);
  const dayOfMonth = thisRange.to.getDate();
  const prevSoFarRange = resolveRange({ key: "custom", from: `${prevYm}-01`, to: `${prevYm}-${String(Math.min(dayOfMonth, prevRange.to.getDate())).padStart(2, "0")}` });
  const prevSoFar = sumFor(hospitalFigures(branchId, prevSoFarRange, agents), keys);
  const base = [1, 2, 3].map((n) => sumFor(hospitalFigures(branchId, monthRange(shiftMonth(ym, -n)), agents), keys).patients);
  const baseline = Math.round(base.reduce((s, n) => s + n, 0) / 3);
  const set = st.targets[targetKey(branchId, marketerId, ym)];
  const target = set?.patients ?? Math.max(5, Math.round(baseline * 1.1));
  const daysIn = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate();
  const isCurrent = ym === monthKey();
  const pace = isCurrent ? Math.min(1, dayOfMonth / daysIn) : 1;
  const inMonth = (iso: string) => iso.slice(0, 7) === ym;
  const followUps = checkUps.filter((c) => c.branchId === branchId && agentIds.has(c.agentId) && inMonth(c.at) && (!byName || c.by.name === byName)).length;
  const entries = st.entries.filter((e) => e.branchId === branchId && e.marketerId === marketerId && inMonth(e.at));
  return {
    marketerId,
    month: ym,
    hospitals: keys,
    agents: agentIds.size,
    patients: now.patients,
    revenue: now.revenue,
    referring: now.referring,
    lastMonthSoFar: prevSoFar.patients,
    lastMonth: prev.patients,
    baseline,
    target,
    targetSetBy: set?.by ?? null,
    pct: target ? now.patients / target : 0,
    pace,
    followUps,
    recruits: entries.filter((e) => e.kind === "recruit").length,
    newHospitals: entries.filter((e) => e.kind === "hospital").length,
  };
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
