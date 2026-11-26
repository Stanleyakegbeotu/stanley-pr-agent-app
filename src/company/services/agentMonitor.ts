// GENERATED from the STANLEY desktop app (src/services/agentMonitor.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * PR agent monitor (owner, 2026-11-26): so marketers don't go out blindly.
 * Every day it sorts the branch's PR agents by how their referrals are
 * going, and says who to check up on and why:
 *
 *   Top        the strongest referrers this month (keep them close),
 *   Growing    sending more than the month before (thank them),
 *   Steady     sending as usual,
 *   Slipping   sending much less than the month before (visit: ask what changed),
 *   Gone quiet no referral for 15 to 45 days (call or visit),
 *   Inactive   no referral for more than 45 days (re-engage),
 *   No referrals yet  nothing in the last four months (introduce the branch).
 *
 * The Company Admin, the Branch Manager and the front desk see it in PR
 * Management, and as a report in Analysis. After a visit or a call, the
 * marketer logs a check-up (how it went, a note and the next date); the
 * agent's flag goes off until that date, or for two weeks. Check-ups are on
 * the agent's record. Saved on this device until the cloud is connected.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "@company/app/AppState";
import { addDays } from "@company/data/demo/generator";
import { LEGACY_BRANCH_ID, hospitalKey } from "@company/data/legacy";
import type { AgentRecord } from "@company/data/userRecords";
import { referralsByDay, resolveRange } from "@company/services/analytics";

export type AgentStatus = "top" | "rising" | "steady" | "slipping" | "quiet" | "inactive" | "never";
export const STATUS_LABEL: Record<AgentStatus, string> = { top: "Top", rising: "Growing", steady: "Steady", slipping: "Slipping", quiet: "Gone quiet", inactive: "Inactive", never: "No referrals yet" };
export const STATUS_HINT: Record<AgentStatus, string> = {
  top: "The strongest referrers this month. Keep them close.",
  rising: "Sending more than the month before. Thank them.",
  steady: "Sending as usual.",
  slipping: "Sending much less than the month before. Visit and ask what changed.",
  quiet: "No referral for 15 to 45 days. Call or visit.",
  inactive: "No referral for more than 45 days. Re-engage them.",
  never: "No referral in the last four months. Introduce the branch.",
};
/** Statuses that need attention, most valuable first. */
export const ATTENTION: AgentStatus[] = ["slipping", "quiet", "inactive", "never"];
/** The daily check-up list: the agents still worth winning back quickly (inactive and never-sent agents have their own lists). */
export const DUE: AgentStatus[] = ["slipping", "quiet"];
export const STATUS_ORDER: AgentStatus[] = ["slipping", "quiet", "inactive", "never", "top", "rising", "steady"];

export type CheckKind = "Visit" | "Call" | "Message";
export const OUTCOMES = ["Will send patients", "Sending to another lab", "No patients at the moment", "Unhappy with our service", "Moved or left the hospital", "Could not reach them", "Other"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export interface CheckUp {
  id: string;
  agentId: number;
  branchId: string;
  at: string;
  by: { name: string; role: string };
  kind: CheckKind;
  outcome: Outcome;
  note?: string;
  /** Next check-up date (yyyy-mm-dd). */
  next?: string;
}

export interface AgentHealth {
  agent: AgentRecord;
  hospital: string;
  status: AgentStatus;
  /** Referrals in the last 7 and 28 days, and the 28 days before. */
  last7: number;
  last28: number;
  prev28: number;
  /** Last 12 weeks, oldest first (for the sparkline). */
  weeks: number[];
  lastAt: Date | null;
  daysSince: number | null;
  /** What to do, in plain words. */
  action: string;
  lastCheck: CheckUp | null;
  /** Needs a check-up now (flag on). */
  due: boolean;
}

/* ─────────────── check-ups ─────────────── */

const KEY = "stanley.agentCheckups.v1";
const listeners = new Set<() => void>();
let checks: CheckUp[] | null = null;
function load(): CheckUp[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as CheckUp[];
  } catch {
    return [];
  }
}
const allChecks = () => (checks ??= load());
export function useCheckUps(): CheckUp[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    allChecks,
  );
}
/** The check-ups saved on this device (for reports). */
export const checkUpsNow = () => allChecks();
export function addCheckUp(c: Omit<CheckUp, "id" | "at">): CheckUp {
  const rec: CheckUp = { ...c, id: `CHK-${Date.now()}`, at: new Date().toISOString() };
  checks = [rec, ...allChecks()];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(checks));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
  return rec;
}

/* ─────────────── the monitor ─────────────── */

const DAY = 86_400_000;
const n0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function actionFor(s: AgentStatus, h: { last28: number; prev28: number; daysSince: number | null }): string {
  switch (s) {
    case "slipping":
      return `Visit: referrals fell from ${h.prev28} to ${h.last28} in four weeks. Ask what changed.`;
    case "quiet":
      return `Call or visit: no referral for ${h.daysSince} days (${h.prev28 + h.last28} in the two months before).`;
    case "inactive":
      return `Re-engage: last referral ${h.daysSince} days ago.`;
    case "never":
      return "Introduce the branch: no referral in the last four months.";
    case "rising":
      return `Thank them: ${h.last28} referrals this month, up from ${h.prev28}.`;
    case "top":
      return `Keep close: ${h.last28} referrals in four weeks.`;
    default:
      return `Steady: ${h.last28} referrals in four weeks.`;
  }
}

/** Every agent of the branch with their referral health, most urgent first. */
export function agentHealth(branchId: string, agents: readonly AgentRecord[], checkUps: CheckUp[], now = new Date()): AgentHealth[] {
  // The PR network on record belongs to the Abuja branch (legacy export).
  if (branchId !== LEGACY_BRANCH_ID || !agents.length) return [];
  const range = resolveRange({ key: "custom", from: addDays(now, -119).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) });
  // One pass over the visits (correction 2026-11-26: the old per-agent filtering froze the page while it opened).
  const today = n0(now);
  type Acc = { last7: number; last28: number; prev28: number; weeks: number[]; lastT: number };
  const acc = new Map<number, Acc>();
  for (const d of referralsByDay(branchId, range)) {
    const at = new Date(`${d.date}T12:00:00`);
    const t = at.getTime();
    const ago = Math.floor((today - n0(at)) / DAY);
    for (const id of d.agentIds) {
      let a = acc.get(id);
      if (!a) acc.set(id, (a = { last7: 0, last28: 0, prev28: 0, weeks: new Array(12).fill(0), lastT: 0 }));
      if (ago < 7) a.last7 += 1;
      if (ago < 28) a.last28 += 1;
      else if (ago < 56) a.prev28 += 1;
      const w = Math.floor(ago / 7);
      if (w >= 0 && w < 12) a.weeks[11 - w] += 1;
      if (t > a.lastT) a.lastT = t;
    }
  }
  const base = agents.map((agent) => {
    const a = acc.get(agent.id);
    if (!a) return { agent, last7: 0, last28: 0, prev28: 0, weeks: new Array(12).fill(0), lastAt: null, daysSince: null };
    return { agent, last7: a.last7, last28: a.last28, prev28: a.prev28, weeks: a.weeks, lastAt: new Date(a.lastT), daysSince: Math.floor((today - n0(new Date(a.lastT))) / DAY) };
  });
  // Top: the busiest tenth this month (at least 6 referrals).
  const sorted = base.map((b) => b.last28).sort((a, b) => b - a);
  const topCut = Math.max(6, sorted[Math.floor(sorted.length / 10)] ?? 6);
  return base
    .map((b): AgentHealth => {
      const status: AgentStatus =
        b.daysSince === null ? "never" : b.daysSince > 45 ? "inactive" : b.daysSince >= 15 ? "quiet" : b.prev28 >= 3 && b.last28 <= b.prev28 * 0.6 ? "slipping" : b.last28 >= topCut ? "top" : b.last28 >= 3 && b.last28 >= b.prev28 * 1.4 + 1 ? "rising" : "steady";
      const mine = checkUps.filter((c) => c.agentId === b.agent.id && c.branchId === branchId);
      const lastCheck = mine[0] ?? null;
      const snoozed = lastCheck ? (lastCheck.next ? new Date(`${lastCheck.next}T23:59:59`) >= now : now.getTime() - new Date(lastCheck.at).getTime() < 14 * DAY) : false;
      return { ...b, hospital: hospitalKey(b.agent.hospital) || "No hospital", status, action: actionFor(status, b), lastCheck, due: DUE.includes(status) && !snoozed };
    })
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.prev28 + b.last28 - (a.prev28 + a.last28) || a.agent.name.localeCompare(b.agent.name));
}

export function useAgentHealth(branchId: string): AgentHealth[] {
  const { agents } = useApp();
  const checkUps = useCheckUps();
  const day = new Date().toDateString();
  // Worked out after the page has appeared, so opening PR Management is never held up.
  const [list, setList] = useState<AgentHealth[]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => setList(agentHealth(branchId, agents, checkUps)), 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, agents, checkUps, day]);
  return list;
}
