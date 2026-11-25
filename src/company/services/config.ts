// GENERATED from the STANLEY desktop app (src/services/config.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Company-wide business configuration (Settings → Billing & Payments, Patient
 * & Registration, Notifications, Data Management). Every value here is read by
 * the part of the app it controls — nothing is display-only:
 *
 *  • payments.enabled / split   → the payment choices in Billing step 3
 *  • discounts                   → whether discounts can be given and the cap
 *  • patient.phoneRequired       → Billing step 1 validation
 *  • patient.duplicateBy         → which fields raise a "possible duplicate"
 *  • notifications.kinds         → which notifications are generated
 *  • backup.lastAt / everyDays   → backup reminders and the Data page
 *
 * Branch overrides (e.g. a branch's own payment methods) live in org.ts.
 * Saved on this device (localStorage, guarded) until the database exists.
 */
import { useSyncExternalStore } from "react";
import type { PaymentMethod } from "@company/data/types";
import type { NoteKind } from "./notifications";
import { logAudit } from "./audit";

export interface AppConfig {
  payments: { enabled: Record<PaymentMethod, boolean>; split: boolean };
  discounts: { enabled: boolean; maxPercent: number };
  patient: { phoneRequired: boolean; duplicateBy: { name: boolean; phone: boolean } };
  notifications: { kinds: Record<NoteKind, boolean> };
  backup: { lastAt: string | null; everyDays: number; history: { at: string; by: string; bytes: number; kind: "backup" | "restore" }[] };
}

export const DEFAULT_CONFIG: AppConfig = {
  payments: { enabled: { Cash: true, POS: true, Transfer: true }, split: true },
  discounts: { enabled: true, maxPercent: 100 },
  patient: { phoneRequired: false, duplicateBy: { name: true, phone: true } },
  notifications: { kinds: { summary: true, bill: true, unpaid: true, overdue: true, payout: true, data: true } },
  backup: { lastAt: null, everyDays: 7, history: [] },
};

const KEY = "stanley.config.v1";

function merge<T>(base: T, saved: unknown): T {
  if (!saved || typeof saved !== "object" || Array.isArray(base)) return (saved as T) ?? base;
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(base as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    const s = (saved as Record<string, unknown>)[k];
    out[k] = s === undefined ? b : b && typeof b === "object" && !Array.isArray(b) ? merge(b, s) : s;
  }
  return out as T;
}

function load(): AppConfig {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? merge(DEFAULT_CONFIG, JSON.parse(raw)) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

let state: AppConfig = load();
const listeners = new Set<() => void>();
function commit(next: AppConfig) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — applies for this session */
  }
  listeners.forEach((l) => l());
}

export const config = () => state;
export function useConfig(): AppConfig {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => state,
  );
}

/**
 * Change one area of the configuration. `summary` is written to the audit log
 * (e.g. "POS disabled"), with the area as the record.
 */
export function updateConfig<K extends keyof AppConfig>(area: K, patch: Partial<AppConfig[K]>, summary: string) {
  commit({ ...state, [area]: { ...state[area], ...patch } });
  if (summary) logAudit({ category: "Settings", action: `${AREA_LABEL[area]} changed`, record: AREA_LABEL[area], details: summary, branchId: null });
}

const AREA_LABEL: Record<keyof AppConfig, string> = {
  payments: "Payment methods",
  discounts: "Discount rules",
  patient: "Patient registration rules",
  notifications: "Notification settings",
  backup: "Backup settings",
};

/** Record a backup or restore (Data Management). */
export function recordBackup(kind: "backup" | "restore", by: string, bytes: number) {
  const at = new Date().toISOString();
  commit({ ...state, backup: { ...state.backup, lastAt: kind === "backup" ? at : state.backup.lastAt, history: [{ at, by, bytes, kind }, ...state.backup.history].slice(0, 30) } });
}

export const backupOverdue = (c: AppConfig = state) => !c.backup.lastAt || Date.now() - new Date(c.backup.lastAt).getTime() > c.backup.everyDays * 86_400_000;
