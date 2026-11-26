// GENERATED from the STANLEY desktop app (src/services/staffQueries.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Staff queries (owner, 2026-11-26): a query issued to a member of staff,
 * recorded on their profile by the Branch Manager or the Company Admin: the
 * date issued, the reason, the reply asked for by a date, the staff member's
 * response, and the outcome, with the full history kept. Shared with the
 * mobile app.
 */
import { useSyncExternalStore } from "react";

export type QueryOutcome = "Cleared" | "Verbal warning" | "Written warning" | "Final warning" | "Suspended" | "Dismissed";
export const QUERY_OUTCOMES: { value: QueryOutcome; hint: string }[] = [
  { value: "Cleared", hint: "The response was accepted; no action" },
  { value: "Verbal warning", hint: "Spoken to; noted on file" },
  { value: "Written warning", hint: "A written warning on file" },
  { value: "Final warning", hint: "Any repeat leads to further action" },
  { value: "Suspended", hint: "Suspended for a period" },
  { value: "Dismissed", hint: "Employment ended" },
];
export const QUERY_REASONS = ["Lateness", "Absence without permission", "Misconduct", "Rudeness to a patient", "Billing or cash error", "Negligence", "Breach of policy", "Other"] as const;

export type QueryStage = "awaiting" | "responded" | "closed";
export const STAGE_TEXT: Record<QueryStage, string> = { awaiting: "Awaiting response", responded: "Responded", closed: "Closed" };

export interface QueryStep {
  at: string;
  by: string;
  action: string;
  note?: string;
}
export interface StaffQuery {
  id: string;
  staffId: string;
  branchId: string;
  /** yyyy-mm-dd */
  issuedOn: string;
  issuedBy: string;
  reason: string;
  details: string;
  /** yyyy-mm-dd: reply asked for by. */
  replyBy?: string;
  response?: { text: string; on: string; recordedBy: string };
  outcome?: { value: QueryOutcome; note: string; on: string; by: string };
  history: QueryStep[];
}
export const stageOf = (q: StaffQuery): QueryStage => (q.outcome ? "closed" : q.response ? "responded" : "awaiting");

const KEY = "stanley.staffQueries.v1";
const listeners = new Set<() => void>();
let state: StaffQuery[] | null = null;
function load(): StaffQuery[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StaffQuery[];
  } catch {
    /* start empty */
  }
  return [];
}
const current = () => (state ??= load());
function commit(next: StaffQuery[]) {
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

export function useStaffQueries(): StaffQuery[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    current,
    current,
  );
}
/** One person's queries, newest first. */
export const queriesOf = (list: StaffQuery[], staffId: string) => list.filter((q) => q.staffId === staffId).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.id.localeCompare(a.id));
export const openQueries = (list: StaffQuery[]) => list.filter((q) => !q.outcome);

const step = (by: string, action: string, note?: string): QueryStep => ({ at: new Date().toISOString(), by, action, note: note?.trim() || undefined });

export function issueQuery(q: Omit<StaffQuery, "id" | "history" | "response" | "outcome">): StaffQuery {
  const list = current();
  const n = list.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0) + 1;
  const made: StaffQuery = { ...q, reason: q.reason.trim(), details: q.details.trim(), id: `QRY-${String(n).padStart(4, "0")}`, history: [step(q.issuedBy, "Query issued", q.reason)] };
  commit([made, ...list]);
  return made;
}
export function recordResponse(id: string, text: string, on: string, by: string) {
  commit(current().map((q) => (q.id === id ? { ...q, response: { text: text.trim(), on, recordedBy: by }, history: [...q.history, step(by, q.response ? "Response updated" : "Response recorded", text)] } : q)));
}
export function closeQuery(id: string, value: QueryOutcome, note: string, by: string) {
  const on = new Date().toISOString().slice(0, 10);
  commit(current().map((q) => (q.id === id ? { ...q, outcome: { value, note: note.trim(), on, by }, history: [...q.history, step(by, `Closed: ${value}`, note)] } : q)));
}
export function reopenQuery(id: string, by: string, why: string) {
  commit(current().map((q) => (q.id === id ? { ...q, outcome: undefined, history: [...q.history, step(by, "Reopened", why)] } : q)));
}
