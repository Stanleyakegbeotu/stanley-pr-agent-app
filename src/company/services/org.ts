// GENERATED from the STANLEY desktop app (src/services/org.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Branch management (Settings → Branch Management / Monitoring). Branches added
 * here join the live BRANCHES list (data/company.ts), so the branch switcher,
 * workspaces, reports and Patient IDs all pick them up.
 *
 *  • New branches start as "Pending setup" and are activated when ready.
 *  • Status changes (activate / deactivate / suspend) need a reason, are kept
 *    in the branch's history and in the audit log — nothing is deleted, every
 *    patient, bill, staff and audit record stays.
 *  • Each branch can use the company's payment methods or its own set.
 *  • The legacy Abuja branch keeps its recorded name and codes; its contact
 *    details and status can be managed like any other branch.
 *
 * New branches have no invented activity: their figures stay at zero until
 * they bill patients. Saved on this device until the database exists.
 */
import { useSyncExternalStore } from "react";
import { BRANCHES, getBranch, syncActiveBranches } from "@company/data/company";
import type { Branch, BranchStatus, PaymentMethod } from "@company/data/types";
import { PAYMENT_METHODS } from "@company/data/types";
import { LEGACY_BRANCH_ID } from "@company/data/legacy";
import { config } from "./config";
import { logAudit } from "./audit";

export interface StatusChange {
  at: string;
  by: string;
  from: BranchStatus;
  to: BranchStatus;
  reason: string;
}

interface OrgState {
  added: Branch[];
  /** Field changes and status for any branch (incl. the legacy one). */
  edits: Record<string, Partial<Branch>>;
  /** Branch payment methods: absent = use the company's. */
  payments: Record<string, Record<PaymentMethod, boolean>>;
  history: Record<string, StatusChange[]>;
}

const KEY = "stanley.org.v1";
const EMPTY: OrgState = { added: [], edits: {}, payments: {}, history: {} };
/** The legacy record's identity never changes. */
const LOCKED_LEGACY: (keyof Branch)[] = ["id", "code", "idCode", "name", "city", "currency", "basePatients"];

function load(): OrgState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const s = JSON.parse(raw) as Partial<OrgState>;
    return { added: s.added ?? [], edits: s.edits ?? {}, payments: s.payments ?? {}, history: s.history ?? {} };
  } catch {
    return EMPTY;
  }
}

const baseLegacy = { ...BRANCHES.find((b) => b.id === LEGACY_BRANCH_ID)! };
let state: OrgState = load();
let version = 0;
const listeners = new Set<() => void>();

/** Rebuild the live branch list from the legacy record + added branches + edits. */
function apply() {
  const legacyEdit = Object.fromEntries(Object.entries(state.edits[LEGACY_BRANCH_ID] ?? {}).filter(([k]) => !LOCKED_LEGACY.includes(k as keyof Branch)));
  const list: Branch[] = [{ ...baseLegacy, ...legacyEdit }, ...state.added.map((b) => ({ ...b, ...(state.edits[b.id] ?? {}) }))];
  BRANCHES.splice(0, BRANCHES.length, ...list);
  syncActiveBranches();
}
apply();

function commit(next: OrgState) {
  state = next;
  version += 1;
  apply();
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — applies for this session */
  }
  listeners.forEach((l) => l());
}

/** Re-render when branches change; returns the live list. */
export function useBranches(): Branch[] {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => version,
    () => version,
  );
  return BRANCHES;
}

export const statusHistory = (branchId: string): StatusChange[] => state.history[branchId] ?? [];
export const isAddedBranch = (branchId: string) => state.added.some((b) => b.id === branchId);

/* ─────────────── Codes ─────────────── */

export const normCode = (s: string) => s.trim().toUpperCase().replace(/[^A-Z]/g, "");
/** A three-letter Patient ID code nobody else uses. */
export function idCodeProblem(code: string, exceptId?: string): string | null {
  const c = normCode(code);
  if (c.length !== 3) return "Use exactly three letters, e.g. LAG.";
  const taken = BRANCHES.find((b) => b.id !== exceptId && (b.idCode ?? "").toUpperCase() === c);
  return taken ? `${c} is already used by the ${taken.name} branch.` : null;
}
function nextSystemCode(): string {
  const max = BRANCHES.reduce((m, b) => Math.max(m, Number(b.code.replace(/\D/g, "")) || 0), 0);
  return `BR${String(max + 1).padStart(3, "0")}`;
}

/* ─────────────── Create / edit / status ─────────────── */

export interface BranchInput {
  name: string;
  idCode: string;
  city: string;
  state: string;
  country: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  openedOn: string;
  timezone: string;
}

export function addBranch(input: BranchInput, by: string): Branch {
  const idCode = normCode(input.idCode);
  const id = `${idCode.toLowerCase()}-${input.city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.replace(/-+$/, "");
  const branch: Branch = {
    id: BRANCHES.some((b) => b.id === id) ? `${id}-${Date.now().toString(36)}` : id,
    code: nextSystemCode(),
    idCode,
    name: input.name.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    country: input.country.trim() || "Nigeria",
    currency: "NGN",
    status: "Pending setup",
    manager: "",
    phone: input.phone.trim(),
    address: input.address.trim(),
    email: input.email.trim(),
    contactPerson: input.contactPerson.trim(),
    timezone: input.timezone || "Africa/Lagos",
    basePatients: 0,
    openedOn: input.openedOn,
    createdAt: new Date().toISOString(),
  };
  commit({ ...state, added: [...state.added, branch], history: { ...state.history, [branch.id]: [{ at: branch.createdAt!, by, from: "Pending setup", to: "Pending setup", reason: "Branch created" }] } });
  logAudit({ category: "Settings", action: "Branch created", record: `${branch.name} branch (${branch.code} · ${idCode})`, details: `${branch.city}${branch.state ? `, ${branch.state}` : ""}, ${branch.country} · Patient IDs ${idCode}-R / ${idCode}-W · status Pending setup`, branchId: branch.id });
  return branch;
}

const FIELD_LABEL: Partial<Record<keyof Branch, string>> = { name: "Name", idCode: "Patient ID code", city: "City", state: "State", country: "Country", address: "Address", phone: "Phone", email: "Email", contactPerson: "Contact person", openedOn: "Opening date", timezone: "Timezone" };

export function updateBranch(branchId: string, patch: Partial<BranchInput>, by: string) {
  const b = getBranch(branchId);
  if (!b) return;
  const legacy = branchId === LEGACY_BRANCH_ID;
  const clean: Partial<Branch> = {};
  for (const [k, v] of Object.entries(patch) as [keyof BranchInput, string][]) {
    if (legacy && LOCKED_LEGACY.includes(k as keyof Branch)) continue;
    clean[k as keyof Branch] = (k === "idCode" ? normCode(v) : v.trim()) as never;
  }
  const changed = (Object.keys(clean) as (keyof Branch)[]).filter((k) => (clean[k] ?? "") !== (b[k] ?? ""));
  if (!changed.length) return;
  commit({ ...state, edits: { ...state.edits, [branchId]: { ...(state.edits[branchId] ?? {}), ...clean } } });
  logAudit({ category: "Settings", action: "Branch details updated", record: `${b.name} branch (${b.code})`, details: changed.map((k) => `${FIELD_LABEL[k] ?? k}: ${b[k] || "—"} → ${clean[k] || "—"}`).join(" · ") + ` · by ${by}`, branchId });
}

export function setBranchStatus(branchId: string, to: BranchStatus, reason: string, by: string) {
  const b = getBranch(branchId);
  if (!b || b.status === to) return;
  const change: StatusChange = { at: new Date().toISOString(), by, from: b.status, to, reason: reason.trim() };
  commit({ ...state, edits: { ...state.edits, [branchId]: { ...(state.edits[branchId] ?? {}), status: to } }, history: { ...state.history, [branchId]: [change, ...(state.history[branchId] ?? [])] } });
  const verb = to === "Active" ? (b.status === "Pending setup" ? "Branch activated" : "Branch reactivated") : to === "Suspended" ? "Branch suspended" : to === "Inactive" ? "Branch deactivated" : "Branch set to pending setup";
  logAudit({ category: "Settings", action: verb, record: `${b.name} branch (${b.code})`, details: `${b.status} → ${to} · Reason: ${change.reason} · all records kept`, branchId });
}

/* ─────────────── Payment methods (company default or branch-specific) ─────────────── */

export const branchPaymentMode = (branchId: string): "inherit" | "custom" => (state.payments[branchId] ? "custom" : "inherit");

/** The payment methods Billing offers at this branch. */
export function enabledMethods(branchId: string): PaymentMethod[] {
  const own = state.payments[branchId];
  const company = config().payments.enabled;
  return PAYMENT_METHODS.filter((m) => (own ? own[m] : company[m]));
}

export function setBranchPayments(branchId: string, methods: Record<PaymentMethod, boolean> | null, by: string) {
  const b = getBranch(branchId);
  const payments = { ...state.payments };
  if (methods) payments[branchId] = methods;
  else delete payments[branchId];
  commit({ ...state, payments });
  logAudit({ category: "Settings", action: methods ? "Branch payment methods customised" : "Branch uses company payment methods", record: `${b?.name ?? branchId} branch`, details: methods ? `Enabled: ${PAYMENT_METHODS.filter((m) => methods[m]).join(", ") || "none"} · by ${by}` : `Back to the company default · by ${by}`, branchId });
}

/** Missing details that stop a branch being fully set up (shown in Overview / Monitoring). */
export function branchGaps(b: Branch, hasManager: boolean, contact: { address: string; phone: string }): string[] {
  const gaps: string[] = [];
  if (!hasManager) gaps.push("No branch manager");
  if (!(contact.phone || (b.phone && b.phone !== "Not on record"))) gaps.push("No phone number");
  if (!(contact.address || (b.address && b.address !== "Not on record"))) gaps.push("No address");
  if (!b.idCode) gaps.push("No Patient ID code");
  if (enabledMethods(b.id).length === 0) gaps.push("No payment method enabled");
  return gaps;
}
