// GENERATED from the STANLEY desktop app (src/services/audit.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Audit log — a read-only record of every change made in STANLEY: who, what,
 * which record, when and the details. Entries can never be edited or removed.
 *
 * Starts with the real legacy import event; everything after that is recorded
 * as people work (PR agents, commission, staff, catalogue, trash, reports and
 * receipts). Kept for the session until the database is connected.
 */
import { useSyncExternalStore } from "react";
import { CURRENT_USER } from "@company/data/company";

/** The person entries are recorded against — set by the app when the workspace (admin / branch) changes. */
let actor = { name: CURRENT_USER.name, role: CURRENT_USER.role };
export function setAuditActor(name: string, role: string) {
  actor = { name, role };
}
import { LEGACY_BRANCH_ID, LEGACY_META } from "@company/data/legacy";

export type AuditCategory = "System" | "Billing" | "PR agents" | "Commission" | "Staff" | "Catalogue" | "Trash" | "Reports" | "Receipts" | "Expenses" | "Settings";
export const AUDIT_CATEGORIES: readonly AuditCategory[] = ["Billing", "PR agents", "Commission", "Staff", "Catalogue", "Trash", "Reports", "Receipts", "Expenses", "Settings", "System"];

export interface AuditEntry {
  id: string;
  at: Date;
  user: string;
  role: string;
  category: AuditCategory;
  action: string;
  /** The record that changed, e.g. "Dr Bello Nisa (#80)". */
  record: string;
  /** What changed, in plain words. */
  details: string;
  branchId: string | null;
}

/*
 * Saved on this device (owner rule: audit entries can never be deleted — so a
 * refresh must not lose them either). Plain JSON, guarded; dates stored as ISO.
 */
const KEY = "stanley.audit.v1";
function loadSaved(): AuditEntry[] | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as (Omit<AuditEntry, "at"> & { at: string })[];
    return Array.isArray(list) && list.length ? list.map((e) => ({ ...e, at: new Date(e.at) })) : null;
  } catch {
    return null;
  }
}
function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage full or blocked — entries still kept for this session */
  }
}

const saved = loadSaved();
let seq = saved ? Math.max(1, ...saved.map((e) => Number(e.id.replace(/\D/g, "")) || 0)) : 1;
let entries: AuditEntry[] = saved ?? [
  {
    id: "AUD-000001",
    at: new Date(LEGACY_META.exportedAt),
    user: "System",
    role: "Data import",
    category: "System",
    action: "Baseline imported",
    record: LEGACY_META.sourceDatabase,
    details: `${LEGACY_META.counts.inventoryItems} inventory items · ${LEGACY_META.counts.prAgents} PR agents · ${LEGACY_META.counts.distinctHospitals} hospitals imported as the read-only baseline`,
    branchId: LEGACY_BRANCH_ID,
  },
];
const listeners = new Set<() => void>();

/** Record a change made by the signed-in user. */
export function logAudit(e: { category: AuditCategory; action: string; record: string; details: string; branchId?: string | null }) {
  seq += 1;
  entries = [{ id: `AUD-${String(seq).padStart(6, "0")}`, at: new Date(), user: actor.name, role: actor.role, branchId: e.branchId ?? null, ...e }, ...entries];
  save();
  listeners.forEach((l) => l());
}

/** Newest first. */
export function useAuditLog(): AuditEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => entries,
  );
}
