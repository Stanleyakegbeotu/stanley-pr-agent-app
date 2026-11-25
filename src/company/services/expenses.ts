// GENERATED from the STANLEY desktop app (src/services/expenses.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Branch expenses recorded in STANLEY (owner spec, 2026-11-22).
 *
 * Every expense says what was spent, how much, how it was paid, who recorded
 * it and — always — who approved it. Expenses are usually approved by the
 * Branch Manager:
 *  • the person recording can state the approval they already have
 *    ("Approved by …" is then required), or
 *  • send it for approval — it waits as Pending until a Branch Manager (or the
 *    Company Admin) approves or rejects it in STANLEY. Rejections need a reason.
 * Only approved expenses count as money spent.
 *
 * Saved on this device first (localStorage, guarded) and queued for cloud sync —
 * offline-first, like bills. Demo activity expenses (dailyLines) are separate
 * and never changed. Recorded expenses are not yet added to the dashboard /
 * Finance totals (those still use demo activity).
 */
import { useSyncExternalStore } from "react";
import { getBranch } from "@company/data/company";
import { EXPENSE_CATEGORIES, type PaymentMethod } from "@company/data/types";
import { EXPENSE_ITEMS } from "@company/data/demo/dailyLines";
import { logAudit } from "./audit";

export interface Person {
  name: string;
  role: string;
}

export type ExpenseStatus = "Approved" | "Pending" | "Rejected";

/**
 * Owner, 2026-11-22: a test the branch doesn't do is sent to a partner branch or
 * facility. The patient pays the branch (e.g. ₦60,000); the branch pays the
 * partner (e.g. ₦40,000 — this is the expense) and keeps the difference
 * (₦20,000). Not part of the demo activity categories, so the dashboard's demo
 * figures are unchanged.
 */
export const OUTSOURCED = "Outsourced services (partner)";
/** Categories an expense can be recorded under. */
export const RECORD_CATEGORIES: readonly string[] = [...EXPENSE_CATEGORIES, OUTSOURCED];
export const CATEGORY_ITEMS: Record<string, string[]> = { ...EXPENSE_ITEMS, [OUTSOURCED]: ["MRI at a partner centre", "CT scan at a partner centre", "Specialised lab test sent out"] };
export const CATEGORY_HINT: Record<string, string> = { [OUTSOURCED]: "Tests done for our patients by a partner branch or facility" };

/** The partner side of an outsourced test: what was done, for whom, and what the patient paid us. */
export interface OutsourcedInfo {
  service: string;
  /** Patient name or Patient ID (optional). */
  patient: string;
  /** What the patient paid the branch for this service (whole naira). */
  charged: number;
}
/** What the branch keeps after paying the partner. */
export const retained = (o: OutsourcedInfo, paidToPartner: number) => o.charged - paidToPartner;

export interface ExpenseEvent {
  at: string;
  by: Person;
  action: string;
  note?: string;
}

export interface ExpenseRecord {
  /** EXP-<branch code>-R000001 — separate sequence per branch. */
  id: string;
  branchId: string;
  /** Day the money was spent (yyyy-mm-dd). */
  date: string;
  category: string;
  description: string;
  /** Whole naira. */
  amount: number;
  method: PaymentMethod;
  paidTo: string;
  reference: string;
  notes: string;
  /** Photo of the receipt / invoice (data URL), optional. */
  receipt?: string;
  /** Only for the Outsourced services (partner) category. */
  outsourced?: OutsourcedInfo;
  recordedBy: Person;
  recordedAt: string;
  status: ExpenseStatus;
  /** Who approved it. Required for every approved expense. */
  approvedBy: Person | null;
  /** "stated" = the recorder entered an approval they already had · "in-app" = approved in STANLEY. */
  approval: "stated" | "in-app" | null;
  approvedAt?: string;
  rejectedBy?: Person;
  rejectReason?: string;
  history: ExpenseEvent[];
  sync: "queued" | "synced";
}

export type ExpenseInput = Pick<ExpenseRecord, "branchId" | "date" | "category" | "description" | "amount" | "method" | "paidTo" | "reference" | "notes" | "receipt" | "outsourced"> & {
  /** null = send for approval. */
  approvedBy: Person | null;
};

interface State {
  expenses: ExpenseRecord[];
  seq: Record<string, number>;
}

const KEY = "stanley.expenses.v1";

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<State>;
      return { expenses: s.expenses ?? [], seq: s.seq ?? {} };
    }
  } catch {
    /* unreadable — start empty */
  }
  return { expenses: [], seq: {} };
}

let state: State = load();
const listeners = new Set<() => void>();
/** False when the last save could not be written to the device (storage full / blocked). */
let lastSaveOk = true;

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    lastSaveOk = true;
  } catch {
    lastSaveOk = false;
  }
  listeners.forEach((l) => l());
}

export const savedOnDevice = () => lastSaveOk;

export function useExpenses(): ExpenseRecord[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state.expenses,
    () => state.expenses,
  );
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const now = () => new Date().toISOString();
const who = (p: Person) => `${p.name} (${p.role})`;

/** Expenses above this need a second look (shown as a note on the form). */
export const LARGE_EXPENSE = 500_000;

export function recordExpense(input: ExpenseInput, by: Person): ExpenseRecord {
  const code = getBranch(input.branchId)?.code ?? "BR";
  const n = (state.seq[input.branchId] ?? 0) + 1;
  const at = now();
  const approved = !!input.approvedBy;
  const rec: ExpenseRecord = {
    ...input,
    description: input.description.trim(),
    paidTo: input.paidTo.trim(),
    reference: input.reference.trim(),
    notes: input.notes.trim(),
    id: `EXP-${code}-R${String(n).padStart(6, "0")}`,
    recordedBy: by,
    recordedAt: at,
    status: approved ? "Approved" : "Pending",
    approvedBy: input.approvedBy,
    approval: approved ? "stated" : null,
    approvedAt: approved ? at : undefined,
    history: [{ at, by, action: approved ? `Recorded · approval stated: ${who(input.approvedBy!)}` : "Recorded · sent for approval" }],
    sync: "queued",
  };
  commit({ expenses: [rec, ...state.expenses], seq: { ...state.seq, [input.branchId]: n } });
  logAudit({
    category: "Expenses",
    action: approved ? "Expense recorded (approved)" : "Expense sent for approval",
    record: `${rec.description} (${rec.id})`,
    details: `${naira(rec.amount)} · ${rec.category} · ${rec.method}${rec.paidTo ? ` · paid to ${rec.paidTo}` : ""}${rec.outsourced ? ` · patient paid ${naira(rec.outsourced.charged)}, branch keeps ${naira(retained(rec.outsourced, rec.amount))}` : ""}${approved ? ` · approved by ${who(rec.approvedBy!)}` : ""}`,
    branchId: rec.branchId,
  });
  return rec;
}

function patch(id: string, fn: (r: ExpenseRecord) => ExpenseRecord) {
  commit({ ...state, expenses: state.expenses.map((r) => (r.id === id ? { ...fn(r), sync: "queued" } : r)) });
}

export function approveExpense(id: string, by: Person, note?: string) {
  const r = state.expenses.find((x) => x.id === id);
  if (!r || r.status === "Approved") return;
  const at = now();
  patch(id, (x) => ({ ...x, status: "Approved", approvedBy: by, approval: "in-app", approvedAt: at, rejectedBy: undefined, rejectReason: undefined, history: [...x.history, { at, by, action: "Approved", note: note?.trim() || undefined }] }));
  logAudit({ category: "Expenses", action: "Expense approved", record: `${r.description} (${id})`, details: `${naira(r.amount)} · recorded by ${who(r.recordedBy)}${note?.trim() ? ` · ${note.trim()}` : ""}`, branchId: r.branchId });
}

export function rejectExpense(id: string, by: Person, reason: string) {
  const r = state.expenses.find((x) => x.id === id);
  if (!r) return;
  const at = now();
  patch(id, (x) => ({ ...x, status: "Rejected", approvedBy: null, approval: null, approvedAt: undefined, rejectedBy: by, rejectReason: reason.trim(), history: [...x.history, { at, by, action: "Rejected", note: reason.trim() }] }));
  logAudit({ category: "Expenses", action: "Expense rejected", record: `${r.description} (${id})`, details: `${naira(r.amount)} · Reason: ${reason.trim()}`, branchId: r.branchId });
}

const FIELD_LABEL: Partial<Record<keyof ExpenseRecord, string>> = { date: "Date", category: "Category", description: "Description", amount: "Amount", method: "Paid by", paidTo: "Paid to", reference: "Receipt no.", notes: "Notes", receipt: "Receipt photo", outsourced: "Partner service details" };

/**
 * Edit a pending or rejected expense. Editing a rejected one resubmits it; a
 * newly stated approval approves it.
 */
export function updateExpense(id: string, input: ExpenseInput, by: Person) {
  const r = state.expenses.find((x) => x.id === id);
  if (!r || r.status === "Approved") return;
  const at = now();
  const changed = (Object.keys(FIELD_LABEL) as (keyof ExpenseRecord)[]).filter((k) => JSON.stringify((input as Record<string, unknown>)[k] ?? null) !== JSON.stringify(r[k] ?? null));
  const approved = !!input.approvedBy;
  const changes = changed.map((k) => (k === "amount" ? `Amount: ${naira(r.amount)} → ${naira(input.amount)}` : FIELD_LABEL[k])).join(" · ");
  const action = approved ? `Edited · approval stated: ${who(input.approvedBy!)}` : r.status === "Rejected" ? "Edited and resubmitted for approval" : "Edited";
  patch(id, (x) => ({
    ...x,
    ...input,
    description: input.description.trim(),
    paidTo: input.paidTo.trim(),
    reference: input.reference.trim(),
    notes: input.notes.trim(),
    status: approved ? "Approved" : "Pending",
    approvedBy: input.approvedBy,
    approval: approved ? "stated" : null,
    approvedAt: approved ? at : undefined,
    rejectedBy: approved || r.status !== "Rejected" ? x.rejectedBy : undefined,
    history: [...x.history, { at, by, action, note: changes || undefined }],
  }));
  logAudit({ category: "Expenses", action: approved ? "Expense edited (approved)" : "Expense edited", record: `${input.description.trim()} (${id})`, details: changes || "No field changes", branchId: r.branchId });
}

/** Remove (for the trash). Returns the record so it can be restored. */
export function takeExpense(id: string): ExpenseRecord | null {
  const r = state.expenses.find((x) => x.id === id) ?? null;
  if (r) commit({ ...state, expenses: state.expenses.filter((x) => x.id !== id) });
  return r;
}

export function putBackExpense(r: ExpenseRecord) {
  if (state.expenses.some((x) => x.id === r.id)) return;
  commit({ ...state, expenses: [r, ...state.expenses].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)) });
}

/** Expenses saved on this device, waiting (in order) for the cloud. */
export const expenseSyncQueue = (list: ExpenseRecord[]) => list.filter((r) => r.sync === "queued");

/**
 * Who can approve a branch expense: the branch's manager(s) first (usually
 * the approver), then the Company Admin. The placeholder manager stands in
 * until a real manager is added in Staff Management.
 */
export function expenseApprovers(staff: readonly { name: string; role: string; branchId: string; status: string }[], branchId: string, placeholderManager: Person, admin: Person): { value: string; label: string; description: string; person: Person }[] {
  const out: { value: string; label: string; description: string; person: Person }[] = [];
  const managers = staff.filter((s) => s.branchId === branchId && s.role === "Branch Manager" && s.status !== "Left" && s.status !== "Suspended");
  const list = managers.length ? managers.map((m) => ({ name: m.name, role: m.role })) : [placeholderManager];
  for (const p of list) out.push({ value: `${p.name}|${p.role}`, label: p.name, description: `${p.role} · usually approves expenses`, person: p });
  out.push({ value: `${admin.name}|${admin.role}`, label: admin.name, description: admin.role, person: admin });
  return out;
}
