// GENERATED from the STANLEY desktop app (src/services/receiptProfile.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Receipt details printed on every patient receipt: company motto, email and
 * thank-you message, plus each branch's address and phone.
 *
 * None of these were in the legacy export, so they start empty (never
 * invented) and are filled in from the receipt pop-up. Saved for the session
 * until the database is connected.
 */
import { useSyncExternalStore } from "react";
import { COMPANY } from "@company/data/company";

export interface ReceiptProfile {
  motto: string;
  email: string;
  thankYou: string;
  branches: Record<string, { address: string; phone: string }>;
}

const KEY = "stanley.receipt.v1";
const DEFAULTS: ReceiptProfile = {
  motto: "",
  email: "",
  thankYou: `Thank you for choosing ${COMPANY.name}. We wish you good health — please keep this receipt for your records.`,
  branches: {},
};

// Saved on this device (guarded) so receipt details survive a refresh — offline-first.
function load(): ReceiptProfile {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ReceiptProfile>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the change still applies for this session */
  }
}

let state: ReceiptProfile = load();
const listeners = new Set<() => void>();

export function updateReceiptProfile(patch: Partial<Omit<ReceiptProfile, "branches">>) {
  state = { ...state, ...patch };
  save();
  listeners.forEach((l) => l());
}

export function updateBranchContact(branchId: string, patch: Partial<{ address: string; phone: string }>) {
  const cur = state.branches[branchId] ?? { address: "", phone: "" };
  state = { ...state, branches: { ...state.branches, [branchId]: { ...cur, ...patch } } };
  save();
  listeners.forEach((l) => l());
}

export function useReceiptProfile(): ReceiptProfile {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
