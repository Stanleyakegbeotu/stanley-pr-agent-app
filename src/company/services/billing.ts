// GENERATED from the STANLEY desktop app (src/services/billing.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Branch billing — the single source of business logic for the five-step
 * billing workflow (Patient → Services → Payment → Preview → Receipt).
 * Visual components never calculate money or generate IDs themselves; they
 * call the functions here.
 *
 *  • Patients: permanent internal UUID + human-readable Patient ID
 *    BRANCH-TYPE-NUMBER (ABJ-R000001 referred, ABJ-W000001 walk-in). One
 *    independent sequence per branch and type; numbers are never reused.
 *  • An ID is RESERVED for a billing session (shown as "Reserved for this
 *    billing") and only becomes a patient record when the bill is saved.
 *    Cancelling releases it — no orphaned patients. Existing patients keep
 *    their ID on every visit.
 *  • Calculations: subtotal (applied prices) → discount (capped) → total →
 *    amount paid (full / part / unpaid / split) → balance → status.
 *  • Orders keep a snapshot of every service price, discount, payment and
 *    referral, so receipts and reports never depend on today's catalogue.
 *  • Drafts: unfinished sessions are saved and can be resumed.
 *
 * Offline-first: kept for this session until the database is connected (the
 * sequences then move to database-safe sequences — same rules).
 */
import { useSyncExternalStore } from "react";
import { can } from "./permissions";
import { config } from "./config";
import { enabledMethods } from "./org";
import { getBranch } from "@company/data/company";
import { PAYMENT_METHODS, type PaymentMethod } from "@company/data/types";
import { hospitalKey } from "@company/data/legacy";
import type { AgentRecord } from "@company/data/userRecords";
import { logAudit } from "./audit";

/* ─────────────── Types ─────────────── */

export type PatientType = "REFERRED" | "WALK_IN";

export interface PatientRecord {
  uuid: string;
  /** Human-readable, permanent: ABJ-R000001 / ABJ-W000001. */
  patientId: string;
  name: string;
  phone: string;
  type: PatientType;
  branchId: string;
  registeredAt: string;
}

export interface SelectedService {
  /** Stable inventory id. */
  id: number;
  name: string;
  category: string;
  /** Catalogue price when added. */
  price: number;
  /** Price applied for this bill only (VIP / custom); null = catalogue price. */
  overridePrice: number | null;
}

export type PayChoice = PaymentMethod | "Split";
export type PayStatusChoice = "full" | "part" | "unpaid";

export interface PaymentDraft {
  method: PayChoice;
  status: PayStatusChoice;
  /** Amount received now (part payment). */
  partAmount: number;
  split: Record<PaymentMethod, number>;
  /** Why a balance is left (part payment or unpaid) — required, shown to admins reviewing outstanding bills. */
  balanceReason: string;
  /** Who approved leaving a balance ("Name|Role") — required for part payment / unpaid. */
  approvedBy: string;
  /** Date the patient promised to pay the rest (yyyy-mm-dd) — optional. */
  promiseDate: string;
}

export interface BillingSession {
  id: string;
  branchId: string;
  step: 1 | 2 | 3 | 4 | 5;
  entry: "new" | "referral";
  patient: { uuid: string | null; existingId: string | null; existingType: PatientType | null; name: string; phone: string };
  walkIn: boolean;
  agentId: number | null;
  /** Explicitly selected referring hospital (overrides the agent's). */
  hospital: string | null;
  referralId: string | null;
  reservedId: string | null;
  reservedType: PatientType | null;
  services: SelectedService[];
  discount: { amount: number; reason: string };
  payment: PaymentDraft;
  /** User confirmed a possible duplicate is a different person. */
  differentPatientConfirmed: boolean;
  startedAt: string;
  lastSaved: string | null;
  /** Who started the bill (shown on the Drafts page). Older drafts may not have it. */
  startedBy?: { name: string; role: string };
}

export interface Order {
  uuid: string;
  invoiceNo: string;
  branchId: string;
  branchName: string;
  currency: string;
  patient: { uuid: string; patientId: string; name: string; phone: string; type: PatientType; isNew: boolean };
  referral: { agentId: number | null; agentName: string | null; referralId: string | null; hospital: string };
  services: (SelectedService & { appliedPrice: number })[];
  subtotal: number;
  discount: number;
  discountReason: string;
  total: number;
  amountPaid: number;
  balance: number;
  method: PayChoice | null;
  split: { method: PaymentMethod; amount: number }[];
  paymentStatus: "PAID" | "PENDING";
  /** Why a balance was left, who approved it and when the patient promised to pay. */
  balanceInfo: { reason: string; approvedBy: { name: string; role: string } | null; promiseDate: string | null };
  createdBy: { name: string; role: string };
  createdAt: string;
  /**
   * Offline-first sync: every bill is saved on this device first and queued
   * (in order) until it reaches the cloud database.
   */
  sync: { status: "queued" | "synced"; queuedAt: string; syncedAt: string | null };
}

/* ─────────────── Store ─────────────── */

interface State {
  patients: PatientRecord[];
  /** Last number issued per prefix (ABJ-R, ABJ-W, INV-2026 …). */
  sequences: Record<string, number>;
  /** patientId → session id holding it. */
  reservations: Record<string, string>;
  orders: Order[];
  drafts: BillingSession[];
}

/*
 * Saved on this device (browser storage) so a refresh never loses patients,
 * bills, drafts or ID sequences — the offline-first local copy until the
 * database is connected. Everything here is plain JSON (dates are ISO strings).
 */
const STORAGE_KEY = "stanley.billing.v1";
const EMPTY: State = { patients: [], sequences: {}, reservations: {}, orders: [], drafts: [] };
function load(): State {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw) as Partial<State>;
    return {
      patients: Array.isArray(saved.patients) ? saved.patients : [],
      sequences: saved.sequences && typeof saved.sequences === "object" ? saved.sequences : {},
      reservations: saved.reservations && typeof saved.reservations === "object" ? saved.reservations : {},
      orders: Array.isArray(saved.orders) ? saved.orders : [],
      drafts: Array.isArray(saved.drafts) ? saved.drafts : [],
    };
  } catch {
    return EMPTY; // storage blocked or unreadable — keep working in memory
  }
}
function persist(s: State) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — the session copy still works */
  }
}

let state: State = load();
const listeners = new Set<() => void>();
const commit = (next: State) => {
  state = next;
  persist(state);
  listeners.forEach((l) => l());
};
export function useBilling(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
export const billingState = () => state;
const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/* ─────────────── Patient IDs ─────────────── */

const BRANCH_PREFIX: Record<string, string> = { Abuja: "ABJ", Lagos: "LAG" };

/** Branch code for IDs — Abuja ABJ, Lagos LAG; others: first three letters of the city. */
export function branchPrefix(branchId: string): string {
  const b = getBranch(branchId);
  if (b?.idCode) return b.idCode;
  const city = b?.city ?? branchId;
  return BRANCH_PREFIX[city] ?? city.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
}
export const typeCode = (t: PatientType) => (t === "REFERRED" ? "R" : "W");
export const patientPrefix = (branchId: string, t: PatientType) => `${branchPrefix(branchId)}-${typeCode(t)}`;
const pad6 = (n: number) => String(n).padStart(6, "0");

/** Next free number for a prefix — checks issued numbers and every existing record, so IDs can never collide. */
function nextNumber(prefix: string): number {
  let n = (state.sequences[prefix] ?? 0) + 1;
  const taken = new Set([...state.patients.map((p) => p.patientId), ...Object.keys(state.reservations)]);
  while (taken.has(`${prefix}${pad6(n)}`)) n += 1;
  return n;
}

/**
 * Reserve a Patient ID for a billing session (BRANCH-TYPE-NUMBER). Numbers are
 * issued once and never reused, even if the bill is cancelled.
 */
export function reservePatientId(branchId: string, type: PatientType, sessionId: string): string {
  const prefix = patientPrefix(branchId, type);
  const n = nextNumber(prefix);
  const id = `${prefix}${pad6(n)}`;
  commit({ ...state, sequences: { ...state.sequences, [prefix]: n }, reservations: { ...state.reservations, [id]: sessionId } });
  return id;
}

/** Release a reservation (bill cancelled, or patient type changed before completion). */
export function releasePatientId(id: string | null) {
  if (!id || !state.reservations[id]) return;
  const { [id]: _, ...rest } = state.reservations;
  commit({ ...state, reservations: rest });
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ─────────────── Patients: lookup and duplicates ─────────────── */

export const normName = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
export const phoneDigitsOnly = (s: string) => s.replace(/\D/g, "").replace(/^234/, "0");
export const isValidPhone = (s: string) => {
  const d = s.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(d);
};

/** Search registered patients by Patient ID, name or phone. */
export function findPatients(branchId: string, q: string, limit = 8): PatientRecord[] {
  const t = normName(q);
  const digits = phoneDigitsOnly(q);
  if (!t && !digits) return [];
  return state.patients
    .filter((p) => p.branchId === branchId)
    .filter((p) => p.patientId.toLowerCase().includes(q.trim().toLowerCase()) || (t.length >= 2 && normName(p.name).includes(t)) || (digits.length >= 4 && phoneDigitsOnly(p.phone).includes(digits)))
    .slice(0, limit);
}

export function patientById(branchId: string, patientId: string) {
  return state.patients.find((p) => p.branchId === branchId && p.patientId.toUpperCase() === patientId.toUpperCase()) ?? null;
}

/** Same-name / same-phone patients registered at the branch (for the existing-patient prompt). */
export function similarPatients(branchId: string, name: string, phone: string): PatientRecord[] {
  // Settings → Patient & Registration: which fields count as a possible duplicate (never merged automatically).
  const by = config().patient.duplicateBy;
  const n = by.name ? normName(name) : "";
  const d = by.phone ? phoneDigitsOnly(phone) : "";
  return state.patients.filter((p) => p.branchId === branchId && ((n.length >= 3 && normName(p.name) === n) || (d.length >= 7 && phoneDigitsOnly(p.phone) === d)));
}

/** Possible duplicates before saving: same-day bills for a similar name or the same phone (for a different patient record). */
export function duplicateWarnings(s: BillingSession): Order[] {
  const today = new Date().toDateString();
  const by = config().patient.duplicateBy;
  const n = by.name ? normName(s.patient.name) : "";
  const d = by.phone ? phoneDigitsOnly(s.patient.phone) : "";
  return state.orders.filter(
    (o) =>
      o.branchId === s.branchId &&
      new Date(o.createdAt).toDateString() === today &&
      o.patient.uuid !== s.patient.uuid &&
      ((n.length >= 3 && normName(o.patient.name) === n) || (d.length >= 7 && phoneDigitsOnly(o.patient.phone) === d)),
  );
}

/* ─────────────── Referral ─────────────── */

/** Explicit hospital → the PR agent's hospital → "Not specified". */
export function resolveHospital(explicit: string | null, agent: AgentRecord | undefined | null): string {
  return (explicit && explicit.trim()) || (agent ? hospitalKey(agent.hospital) : "") || "Not specified";
}

export interface ReferralMatch {
  patient: PatientRecord;
  agentId: number | null;
  hospital: string | null;
  /** Requested tests (from a referral submission); empty when only the patient is known. */
  services: SelectedService[];
}

/**
 * Find a referral by its ID (branch prefix + R + number). Referral submissions
 * from PR agents' mobile app are not connected yet, so this finds referred
 * patients already registered in STANLEY, with their last referral details.
 */
export function lookupReferral(branchId: string, referralId: string): ReferralMatch | null {
  const p = patientById(branchId, referralId);
  if (!p || p.type !== "REFERRED") return null;
  const last = state.orders.find((o) => o.patient.uuid === p.uuid);
  return { patient: p, agentId: last?.referral.agentId ?? null, hospital: last && last.referral.hospital !== "Not specified" ? last.referral.hospital : null, services: [] };
}

/* ─────────────── Calculations (the only place money is computed) ─────────────── */

export const appliedPrice = (s: SelectedService) => s.overridePrice ?? s.price ?? 0;
export const subtotalOf = (services: SelectedService[]) => services.reduce((sum, s) => sum + appliedPrice(s), 0);
/** Discount never below 0 and never above the subtotal. */
export const calculateDiscount = (subtotal: number, amount: number) => Math.min(Math.max(0, Number.isFinite(amount) ? amount : 0), subtotal);
export const splitTotal = (split: Record<PaymentMethod, number>) => PAYMENT_METHODS.reduce((s, m) => s + Math.max(0, split[m] || 0), 0);

export interface BillTotals {
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: "PAID" | "PENDING";
  /** Effective status choice (split payments decide it from the amount). */
  effective: PayStatusChoice;
  split: { method: PaymentMethod; amount: number }[];
}

export function computeBill(s: Pick<BillingSession, "services" | "discount" | "payment">): BillTotals {
  const subtotal = subtotalOf(s.services);
  const discount = calculateDiscount(subtotal, s.discount.amount);
  const total = subtotal - discount;
  const p = s.payment;
  let amountPaid: number;
  let effective: PayStatusChoice = p.status;
  let split: BillTotals["split"] = [];
  if (p.method === "Split") {
    split = PAYMENT_METHODS.map((m) => ({ method: m, amount: Math.max(0, p.split[m] || 0) })).filter((x) => x.amount > 0);
    amountPaid = splitTotal(p.split);
    effective = amountPaid >= total ? "full" : amountPaid > 0 ? "part" : "unpaid";
  } else if (p.status === "full") amountPaid = total;
  else if (p.status === "part") amountPaid = Math.max(0, p.partAmount || 0);
  else amountPaid = 0;
  const balance = Math.max(0, total - amountPaid);
  return { subtotal, discount, total, amountPaid, balance, status: balance === 0 ? "PAID" : "PENDING", effective, split };
}

/* ─────────────── Validation ─────────────── */

export interface StepCheck {
  ok: boolean;
  errors: string[];
  /** The same messages keyed by the field they belong to (shown on that field). */
  fields: Record<string, string>;
}

export function patientSourceType(s: BillingSession): PatientType {
  return s.walkIn ? "WALK_IN" : "REFERRED";
}

/**
 * Field keys: name, phone, agent (step 1) · services, price-<id> (step 2) ·
 * method, split, partAmount, balanceReason, approvedBy, promiseDate, discount, discountReason (step 3).
 */
export function validateStep(s: BillingSession, step: 1 | 2 | 3, agents: AgentRecord[]): StepCheck {
  const fields: Record<string, string> = {};
  const add = (key: string, msg: string) => {
    if (!fields[key]) fields[key] = msg;
  };
  if (step === 1) {
    if (normName(s.patient.name).length < 2) add("name", "Enter the patient's full name to continue.");
    // Settings → Patient & Registration: phone number required.
    if (config().patient.phoneRequired && !s.patient.phone.trim()) add("phone", "Enter the patient's phone number — it is required for every patient.");
    if (s.patient.phone.trim() && !isValidPhone(s.patient.phone)) add("phone", "Check the phone number — digits only, e.g. 0803 123 4567 or +234 803 123 4567.");
    if (!s.walkIn && s.agentId === null && !s.hospital) add("agent", "Select the PR agent who referred the patient — or turn on Walk-in patient.");
    if (s.agentId !== null && !agents.some((a) => a.id === s.agentId)) add("agent", "This PR agent is no longer on record — choose another.");
  }
  if (step === 2) {
    if (!s.services.length) add("services", "Add at least one diagnostic service to continue.");
    for (const x of s.services) if (!Number.isFinite(appliedPrice(x)) || appliedPrice(x) < 0) add(`price-${x.id}`, "Enter a valid price.");
  }
  if (step === 3) {
    const t = computeBill(s);
    if (s.discount.amount < 0 || s.discount.amount > t.subtotal) add("discount", "The discount cannot be more than the bill.");
    if (s.discount.amount > 0 && !s.discount.reason.trim()) add("discountReason", "Give a reason for the discount.");
    // Settings → Billing & Payments: discounts on/off and the maximum percentage.
    if (s.discount.amount > 0 && !config().discounts.enabled) add("discount", "Discounts are turned off for the company.");
    else if (s.discount.amount > maxDiscount(t.subtotal)) add("discount", `Discounts are limited to ${config().discounts.maxPercent}% of the bill (${maxDiscount(t.subtotal).toLocaleString("en-NG")}).`);
    const p = s.payment;
    const offered = enabledMethods(s.branchId);
    if (p.method !== "Split" && !PAYMENT_METHODS.includes(p.method)) add("method", "Choose how the patient paid.");
    else if (p.method !== "Split" && !offered.includes(p.method)) add("method", `${p.method} is turned off for this branch — choose another method.`);
    else if (p.method === "Split" && (!config().payments.split || offered.length < 2)) add("method", "Split payments are turned off — choose one method.");
    if (p.method === "Split") {
      if (PAYMENT_METHODS.some((m) => (p.split[m] || 0) < 0)) add("split", "Split amounts cannot be negative.");
      if (t.amountPaid <= 0) add("split", "Enter the amount received for at least one payment method.");
      if (t.amountPaid > t.total) add("split", `The amounts add up to more than the bill (${t.total.toLocaleString("en-NG")}).`);
    } else if (p.status === "part") {
      if (!(p.partAmount > 0)) add("partAmount", "Enter the amount received now — it must be more than ₦0.");
      else if (p.partAmount >= t.total) add("partAmount", "A part payment must be less than the total. Choose Fully paid if the patient paid everything.");
    }
    // Any balance left (part payment, unpaid, or a split that falls short) needs a reason and an approver.
    if (t.total > 0 && t.amountPaid < t.total && (p.method === "Split" ? t.amountPaid > 0 : p.status !== "full")) {
      const what = t.amountPaid > 0 ? "the part payment" : "leaving the bill unpaid";
      if (!p.balanceReason.trim()) add("balanceReason", t.amountPaid > 0 ? "Give a reason for the part payment." : "Give a reason why nothing was paid.");
      if (!p.approvedBy) add("approvedBy", `Select who approved ${what}.`);
      if (p.promiseDate && p.promiseDate < todayIso()) add("promiseDate", "The promised date cannot be in the past.");
    }
  }
  const errors = Object.values(fields);
  return { ok: errors.length === 0, errors, fields };
}

/* ─────────────── Sessions & drafts ─────────────── */

export function newSession(branchId: string, entry: "new" | "referral", startedBy?: { name: string; role: string }): BillingSession {
  return {
    startedBy,
    id: uuid(),
    branchId,
    step: 1,
    entry,
    patient: { uuid: null, existingId: null, existingType: null, name: "", phone: "" },
    walkIn: true,
    agentId: null,
    hospital: null,
    referralId: null,
    reservedId: null,
    reservedType: null,
    services: [],
    discount: { amount: 0, reason: "" },
    payment: { method: "Cash", status: "full", partAmount: 0, split: { Cash: 0, POS: 0, Transfer: 0 }, balanceReason: "", approvedBy: "", promiseDate: "" },
    differentPatientConfirmed: false,
    startedAt: new Date().toISOString(),
    lastSaved: null,
  };
}

/** A session worth keeping as a draft (something has been entered). */
export const hasContent = (s: BillingSession) => !!(s.patient.name.trim() || s.services.length || s.patient.existingId);

export function saveDraft(s: BillingSession): BillingSession {
  const saved = { ...s, lastSaved: new Date().toISOString() };
  const drafts = [saved, ...state.drafts.filter((d) => d.id !== s.id)];
  commit({ ...state, drafts });
  return saved;
}

/**
 * Take a draft out of the store for the Trash (owner rule: nothing is deleted
 * outright). Its reserved Patient ID is released; restoring reserves a new one.
 */
export function takeDraft(id: string): BillingSession | null {
  const d = state.drafts.find((x) => x.id === id);
  if (!d) return null;
  if (d.reservedId) releasePatientId(d.reservedId);
  commit({ ...state, drafts: state.drafts.filter((x) => x.id !== id) });
  return { ...d, reservedId: null, reservedType: null };
}

/** Put a draft back (from the Trash). A new patient past step 1 gets a fresh Patient ID reservation. */
export function restoreDraft(d: BillingSession) {
  let s = d;
  if (!s.patient.uuid && s.step > 1) {
    const type = patientSourceType(s);
    s = { ...s, reservedId: reservePatientId(s.branchId, type, s.id), reservedType: type };
  }
  commit({ ...state, drafts: [s, ...state.drafts.filter((x) => x.id !== s.id)] });
}

/**
 * Saved drafts that look like the same patient — same existing Patient ID,
 * same phone number, or the same name. Used to warn "there is already a
 * draft for this patient" before a second bill is started.
 */
export function draftsForPatient(branchId: string, p: { name: string; phone: string; existingId: string | null }, excludeId?: string): BillingSession[] {
  const by = config().patient.duplicateBy;
  const name = by.name ? normName(p.name) : "";
  const phone = by.phone ? phoneDigitsOnly(p.phone) : "";
  if (!p.existingId && name.length < 3 && phone.length < 7) return [];
  return state.drafts.filter((d) => {
    if (d.branchId !== branchId || d.id === excludeId) return false;
    if (p.existingId && d.patient.existingId === p.existingId) return true;
    if (phone.length >= 7 && phoneDigitsOnly(d.patient.phone) === phone) return true;
    return name.length >= 3 && normName(d.patient.name) === name;
  });
}

/** Take a saved bill out (for the Trash). The patient record stays. */
export function takeOrder(invoiceNo: string): Order | null {
  const o = state.orders.find((x) => x.invoiceNo === invoiceNo) ?? null;
  if (o) commit({ ...state, orders: state.orders.filter((x) => x.invoiceNo !== invoiceNo) });
  return o;
}

/** Put a bill back exactly as it was (from the Trash). */
export function restoreOrder(o: Order) {
  if (state.orders.some((x) => x.invoiceNo === o.invoiceNo)) return;
  commit({ ...state, orders: [o, ...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}

export const orderByInvoice = (invoiceNo: string) => state.orders.find((o) => o.invoiceNo === invoiceNo) ?? null;

export function deleteDraft(id: string, opts: { release?: boolean } = {}) {
  const d = state.drafts.find((x) => x.id === id);
  if (opts.release && d?.reservedId) releasePatientId(d.reservedId);
  commit({ ...state, drafts: state.drafts.filter((x) => x.id !== id) });
}

/* ─────────────── Completing a bill ─────────────── */

function nextInvoiceNo(branchId: string): string {
  const key = `INV-${branchPrefix(branchId)}-${new Date().getFullYear()}`;
  const n = (state.sequences[key] ?? 0) + 1;
  state = { ...state, sequences: { ...state.sequences, [key]: n } };
  return `INV-${new Date().getFullYear()}-${pad6(n)}`;
}

export type SubmitResult = { ok: true; order: Order } | { ok: false; error: string };

/**
 * Validate everything, create/reuse the patient, save the order (with price,
 * discount, payment and referral snapshots), remove the draft and audit it.
 * Nothing is marked complete unless the save succeeds.
 */
export function submitBilling(s: BillingSession, agents: AgentRecord[], user: { name: string; role: string }): SubmitResult {
  try {
    for (const step of [1, 2, 3] as const) {
      const c = validateStep(s, step, agents);
      if (!c.ok) return { ok: false, error: c.errors[0] };
    }
    if (!user.name) return { ok: false, error: "The person processing this bill is not known — sign in again." };
    // Rights come from Settings → Roles & Permissions (checked again here, not only in the form).
    if (s.services.some((x) => x.overridePrice !== null) && !canOverridePrices(user.role)) return { ok: false, error: "You are not allowed to change prices on a bill. Ask the branch manager." };
    if (s.discount.amount > 0 && !canGiveDiscount(user.role)) return { ok: false, error: "You are not allowed to give discounts. Ask the branch manager." };
    const branch = getBranch(s.branchId);
    if (!branch) return { ok: false, error: "This branch is not available." };
    const t = computeBill(s);
    const agent = s.agentId !== null ? agents.find((a) => a.id === s.agentId) : undefined;

    // Patient: reuse the existing record, or confirm the reserved ID as a new one.
    let patient = s.patient.uuid ? state.patients.find((p) => p.uuid === s.patient.uuid) : undefined;
    let isNew = false;
    let patients = state.patients;
    let reservations = state.reservations;
    if (!patient) {
      const type = patientSourceType(s);
      let id = s.reservedId && s.reservedType === type && state.reservations[s.reservedId] === s.id ? s.reservedId : null;
      if (!id) id = reservePatientId(s.branchId, type, s.id);
      patient = { uuid: uuid(), patientId: id, name: s.patient.name.trim(), phone: s.patient.phone.trim(), type, branchId: s.branchId, registeredAt: new Date().toISOString() };
      patients = [...state.patients, patient];
      const { [id]: _, ...rest } = state.reservations;
      reservations = rest;
      isNew = true;
    }

    const order: Order = {
      uuid: uuid(),
      invoiceNo: nextInvoiceNo(s.branchId),
      branchId: s.branchId,
      branchName: branch.name,
      currency: branch.currency,
      patient: { uuid: patient.uuid, patientId: patient.patientId, name: patient.name, phone: s.patient.phone.trim() || patient.phone, type: patient.type, isNew },
      referral: s.walkIn ? { agentId: null, agentName: null, referralId: null, hospital: "Not specified" } : { agentId: s.agentId, agentName: agent?.name ?? null, referralId: s.referralId, hospital: resolveHospital(s.hospital, agent) },
      services: s.services.map((x) => ({ ...x, appliedPrice: appliedPrice(x) })),
      subtotal: t.subtotal,
      discount: t.discount,
      discountReason: t.discount > 0 ? s.discount.reason.trim() : "",
      total: t.total,
      amountPaid: t.amountPaid,
      balance: t.balance,
      method: t.amountPaid > 0 ? s.payment.method : null,
      split: t.split,
      paymentStatus: t.status,
      balanceInfo:
        t.balance > 0
          ? {
              reason: s.payment.balanceReason.trim(),
              approvedBy: s.payment.approvedBy ? { name: s.payment.approvedBy.split("|")[0], role: s.payment.approvedBy.split("|")[1] ?? "" } : null,
              promiseDate: s.payment.promiseDate || null,
            }
          : { reason: "", approvedBy: null, promiseDate: null },
      createdBy: { name: user.name, role: user.role },
      createdAt: new Date().toISOString(),
      // Saved on this device and queued for the cloud — works the same online or offline.
      sync: { status: "queued", queuedAt: new Date().toISOString(), syncedAt: null },
    };
    commit({ ...state, patients, reservations, orders: [order, ...state.orders], drafts: state.drafts.filter((d) => d.id !== s.id) });
    logAudit({
      category: "Billing",
      action: isNew ? "Patient registered and billed" : "Patient billed",
      record: `${order.invoiceNo} · ${order.patient.patientId}`,
      details: `${order.services.length} test${order.services.length === 1 ? "" : "s"} · total ${order.total.toLocaleString("en-NG")} · paid ${order.amountPaid.toLocaleString("en-NG")}${order.balance ? ` · balance ${order.balance.toLocaleString("en-NG")} (${order.balanceInfo.reason}; approved by ${order.balanceInfo.approvedBy?.name ?? "—"}${order.balanceInfo.promiseDate ? `; promised ${order.balanceInfo.promiseDate}` : ""})` : ""}${order.discount ? ` · discount ${order.discount.toLocaleString("en-NG")} (${order.discountReason})` : ""}${order.services.some((x) => x.overridePrice !== null) ? " · price changed for this bill" : ""}${order.referral.agentName ? ` · referred by ${order.referral.agentName}` : " · walk-in"}`,
      branchId: s.branchId,
    });
    return { ok: true, order };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The bill could not be saved. Try again." };
  }
}

/** Branch figures for the billing page (bills created in STANLEY). */
export function branchBillingStats(branchId: string) {
  const today = new Date().toDateString();
  const mine = state.orders.filter((o) => o.branchId === branchId);
  const todays = mine.filter((o) => new Date(o.createdAt).toDateString() === today);
  const open = mine.filter((o) => o.balance > 0);
  return {
    bills: todays.length,
    billed: todays.reduce((s, o) => s + o.total, 0),
    collected: todays.reduce((s, o) => s + o.amountPaid, 0),
    outstanding: open.reduce((s, o) => s + o.balance, 0),
    open: open.length,
    unpaid: open.filter((o) => o.amountPaid === 0).reduce((s, o) => s + o.balance, 0),
  };
}

/**
 * Bills saved on this device that have not reached the cloud yet, oldest
 * first (the order they will sync in). The cloud database is not connected in
 * this version, so bills stay queued — nothing is marked synced until it is.
 */
export function syncQueue(s: State = state): Order[] {
  return s.orders.filter((o) => o.sync.status === "queued").sort((a, b) => a.sync.queuedAt.localeCompare(b.sync.queuedAt));
}

/** Who may change a price or give a discount (central permission rule). */
/** Change a service's price on one bill (Settings → Roles & Permissions: "Change a service price on a bill"). */
export const canOverridePrices = (role: string) => can(role, "billing.override");
/** Give a discount: the company allows discounts (Billing & Payments) and the role has "Give discounts". */
export const canGiveDiscount = (role: string) => config().discounts.enabled && can(role, "billing.discount");
/** Kept for older callers: price changes on a bill. */
export const canAdjustPrices = canOverridePrices;
/** Largest discount allowed on a bill (company maximum %, never more than the bill). */
export const maxDiscount = (subtotal: number) => Math.floor((subtotal * Math.min(100, Math.max(0, config().discounts.maxPercent))) / 100);

/**
 * Who can approve leaving a balance (part payment / unpaid): the person
 * processing the bill, plus the branch's active manager(s) from Staff
 * Management. Value format "Name|Role".
 */
export function balanceApprovers(staff: readonly { name: string; role: string; branchId: string; status: string }[], branchId: string, user: { name: string; role: string }) {
  const out = new Map<string, { value: string; label: string; description: string }>();
  out.set(`${user.name}|${user.role}`, { value: `${user.name}|${user.role}`, label: user.name, description: `${user.role} · processing this bill` });
  for (const s of staff)
    if (s.branchId === branchId && s.status !== "Left" && s.role === "Branch Manager") {
      const v = `${s.name}|${s.role}`;
      if (!out.has(v)) out.set(v, { value: v, label: s.name, description: s.role });
    }
  return [...out.values()];
}

/**
 * "Most done services" for quick add (owner, 2026-11-22): tests billed most at
 * this branch. Bills entered in STANLEY count first; the branch's recent test
 * activity fills in until there are enough of those. Returns inventory ids with
 * how often each was done, most frequent first.
 */
export function frequentServices(branchId: string, recentCounts: Map<number, number>, limit = 10): { id: number; count: number }[] {
  const score = new Map<number, { billed: number; recent: number }>();
  for (const o of state.orders)
    if (o.branchId === branchId)
      for (const sv of o.services) {
        const cur = score.get(sv.id) ?? { billed: 0, recent: 0 };
        cur.billed += 1;
        score.set(sv.id, cur);
      }
  for (const [id, n] of recentCounts) {
    const cur = score.get(id) ?? { billed: 0, recent: 0 };
    cur.recent += n;
    score.set(id, cur);
  }
  return [...score.entries()]
    .map(([id, v]) => ({ id, count: v.billed + v.recent, billed: v.billed }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.billed - a.billed || b.count - a.count)
    .slice(0, limit)
    .map(({ id, count }) => ({ id, count }));
}
