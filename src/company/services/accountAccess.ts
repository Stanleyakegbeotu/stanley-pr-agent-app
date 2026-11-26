// GENERATED from the STANLEY desktop app (src/services/accountAccess.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Account access (owner, 2026-11-26): the Branch Manager and the Company Admin
 * can deactivate a front desk account (Staff Management) or a PR agent's
 * account (PR Management), and turn it back on. A deactivated account can't
 * sign in; the person's record, history and figures stay as they are.
 * Every change keeps who, when and why. Shared with the mobile app.
 *
 * Keys: "staff:<staff id>" and "agent:<agent id>".
 */
import { useSyncExternalStore } from "react";

export interface AccessStep {
  at: string;
  by: string;
  action: "Deactivated" | "Reactivated";
  reason: string;
}
export interface AccountAccess {
  off: boolean;
  history: AccessStep[];
}
type State = Record<string, AccountAccess>;

const KEY = "stanley.accountAccess.v1";
const listeners = new Set<() => void>();
let state: State | null = null;

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* start empty */
  }
  return {};
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

export const staffKey = (id: string) => `staff:${id}`;
export const agentKey = (id: number) => `agent:${id}`;

export function useAccountAccess(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    current,
    current,
  );
}
export const accessOf = (key: string): AccountAccess | undefined => current()[key];
export const isAccountOff = (key: string) => !!current()[key]?.off;

/** Turn an account off (with a reason) or back on. */
export function setAccountOff(key: string, off: boolean, by: string, reason: string) {
  const cur = current()[key] ?? { off: false, history: [] };
  if (cur.off === off) return;
  const step: AccessStep = { at: new Date().toISOString(), by, action: off ? "Deactivated" : "Reactivated", reason: reason.trim() };
  commit({ ...current(), [key]: { off, history: [step, ...cur.history] } });
}
