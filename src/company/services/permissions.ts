// GENERATED from the STANLEY desktop app (src/services/permissions.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Roles & permissions (Settings → Roles & Permissions). Single source for
 * what each role may see and do. The app checks `can(role, permission)`:
 * branch page access (navigation), billing price changes and discounts,
 * expense approval, catalogue editing, reports, staff management, trash.
 *
 * Roles (owner, 2026-11-22): Company Admin, Branch Manager, Front Desk — no
 * others. The Company Admin always has every permission (it can't be locked
 * out). Branch Manager and Front Desk permissions can be changed by the
 * Company Admin, except the company-level ones marked `adminOnly`, which no
 * branch role can ever be given (branches, company settings, security, roles,
 * backups, net profit).
 *
 * Changes are saved on this device and recorded in the audit log.
 */
import { useSyncExternalStore } from "react";
import { logAudit } from "./audit";

export type RoleName = "Company Admin" | "Branch Manager" | "Front Desk";
export const BRANCH_ROLES: Exclude<RoleName, "Company Admin">[] = ["Branch Manager", "Front Desk"];

export interface PermissionDef {
  id: string;
  label: string;
  description: string;
  /** Higher-risk permission — highlighted in the matrix and confirmed before granting. */
  sensitive?: boolean;
  /** Only the Company Admin — can't be granted to branch roles (by design). */
  adminOnly?: boolean;
}

export interface PermissionGroup {
  id: string;
  label: string;
  perms: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard & analysis",
    perms: [
      { id: "dash.branch", label: "View branch dashboard", description: "Open the branch dashboard." },
      { id: "dash.company", label: "View company dashboard", description: "Company-wide dashboard across all branches.", adminOnly: true },
      { id: "analytics.view", label: "View analysis", description: "Open the Analysis page (figures for the branch)." },
      { id: "analytics.year", label: "Yearly analysis & reports", description: "Look at the whole year. Without it, figures and reports stop at one month." },
      { id: "finance.profit", label: "View net profit", description: "Net profit and margin.", adminOnly: true },
    ],
  },
  {
    id: "patients",
    label: "Patients",
    perms: [
      { id: "patients.view", label: "View patient records", description: "Open Records and patients' visit history." },
      { id: "patients.register", label: "Register patients", description: "Register new patients while billing (the Patient ID is issued automatically)." },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    perms: [
      { id: "billing.create", label: "Create bills & drafts", description: "Bill patients, take payments, save and continue drafts." },
      { id: "billing.reprint", label: "Reprint receipts", description: "Print a receipt again from the visit record." },
      { id: "billing.discount", label: "Give discounts", description: "Reduce a bill's total (within the company's discount limit).", sensitive: true },
      { id: "billing.override", label: "Change a service price on a bill", description: "VIP / custom price for one bill — never changes the catalogue.", sensitive: true },
      { id: "billing.trashBill", label: "Move saved bills to trash", description: "Remove a saved bill (kept in Trash for 30 days).", sensitive: true },
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    perms: [
      { id: "expenses.record", label: "Record expenses", description: "Record what the branch spent (always names who approved it)." },
      { id: "expenses.approve", label: "Approve or reject expenses", description: "Decide on expenses waiting for approval.", sensitive: true },
    ],
  },
  {
    id: "services",
    label: "Services & inventory",
    perms: [
      { id: "services.view", label: "View services & prices", description: "Open Inventory (the price list)." },
      { id: "services.edit", label: "Edit the catalogue", description: "Add services, change catalogue prices, rename categories — applies company-wide.", sensitive: true },
    ],
  },
  {
    id: "referral",
    label: "Referral management",
    perms: [
      { id: "referral.view", label: "View PR Management", description: "Open PR agents, hospitals and referral activity." },
      { id: "referral.manage", label: "Add & edit PR agents", description: "Add agents, edit details, transfer between hospitals." },
      { id: "referral.commission", label: "Commission & payouts", description: "Agents' commission rates, bank details and the payout report.", sensitive: true },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    perms: [
      { id: "reports.view", label: "Create reports", description: "Payments & balances, services, PR agent and hospital reports." },
      { id: "reports.revenue", label: "Revenue report", description: "Income & expenses statement (net profit stays admin-only)." },
      { id: "reports.staff", label: "Staff activity report", description: "Activity of the branch's staff." },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    perms: [
      { id: "staff.view", label: "View staff", description: "Open Staff Management for the branch." },
      { id: "staff.manage", label: "Add & manage front-desk staff", description: "Add staff, change status, edit profiles, move to trash.", sensitive: true },
    ],
  },
  {
    id: "branch",
    label: "Branch management",
    perms: [
      { id: "branch.settings", label: "Edit branch details", description: "Branch phone, address, email and opening hours (printed on receipts)." },
      { id: "branch.create", label: "Add, activate or suspend branches", description: "Create branches and change their status.", adminOnly: true },
      { id: "branch.managers", label: "Appoint branch managers", description: "Assign, replace or remove a branch's manager.", adminOnly: true },
    ],
  },
  {
    id: "settings",
    label: "Settings & security",
    perms: [
      { id: "settings.company", label: "Company settings & branding", description: "Company profile, logo, receipts.", adminOnly: true },
      { id: "settings.business", label: "Billing, payment & registration rules", description: "Payment methods, discounts, patient rules.", adminOnly: true },
      { id: "settings.roles", label: "Roles & permissions", description: "Change what each role can do.", adminOnly: true },
      { id: "settings.security", label: "Security settings", description: "Access and sensitive-action controls.", adminOnly: true },
    ],
  },
  {
    id: "data",
    label: "Audit & data",
    perms: [
      { id: "audit.view", label: "View audit log", description: "See every change made in the branch." },
      { id: "trash.view", label: "View trash", description: "See deleted records." },
      { id: "trash.restore", label: "Restore & delete permanently", description: "Restore records from Trash or delete them for good.", sensitive: true },
      { id: "data.backup", label: "Backups & restore", description: "Export or restore all data on this device.", adminOnly: true },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms);
const PERM_BY_ID = new Map(ALL_PERMISSIONS.map((p) => [p.id, p]));

const MANAGER_DEFAULT = ALL_PERMISSIONS.filter((p) => !p.adminOnly).map((p) => p.id);
const FRONT_DESK_DEFAULT = ["dash.branch", "analytics.view", "patients.view", "patients.register", "billing.create", "billing.reprint", "expenses.record", "services.view", "reports.view"];

export const DEFAULT_GRANTS: Record<Exclude<RoleName, "Company Admin">, string[]> = {
  "Branch Manager": MANAGER_DEFAULT,
  "Front Desk": FRONT_DESK_DEFAULT,
};

type Grants = Record<Exclude<RoleName, "Company Admin">, string[]>;
const KEY = "stanley.permissions.v1";

function load(): Grants {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GRANTS };
    const saved = JSON.parse(raw) as Partial<Grants>;
    const clean = (list: unknown, fallback: string[]) => (Array.isArray(list) ? list.filter((id) => PERM_BY_ID.has(id) && !PERM_BY_ID.get(id)!.adminOnly) : fallback);
    return { "Branch Manager": clean(saved["Branch Manager"], MANAGER_DEFAULT), "Front Desk": clean(saved["Front Desk"], FRONT_DESK_DEFAULT) };
  } catch {
    return { ...DEFAULT_GRANTS };
  }
}

let grants: Grants = load();
let version = 0;
const listeners = new Set<() => void>();
function commit(next: Grants) {
  grants = next;
  version += 1;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(grants));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** True when the role has the permission. The Company Admin always does. Unknown roles get the Front Desk set. */
export function can(role: string, permission: string): boolean {
  if (role === "Company Admin") return true;
  const def = PERM_BY_ID.get(permission);
  if (!def || def.adminOnly) return false;
  const list = role === "Branch Manager" ? grants["Branch Manager"] : grants["Front Desk"];
  return list.includes(permission);
}

export const grantsFor = (role: Exclude<RoleName, "Company Admin">) => grants[role];
export const isDefault = (role: Exclude<RoleName, "Company Admin">, id: string) => DEFAULT_GRANTS[role].includes(id);

/** Re-render when permissions change (pages read `can` during render). */
export function usePermissions(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => version,
    () => version,
  );
}

export function setPermission(role: Exclude<RoleName, "Company Admin">, permission: string, on: boolean, by: string) {
  const def = PERM_BY_ID.get(permission);
  if (!def || def.adminOnly) return;
  const cur = grants[role];
  if (on === cur.includes(permission)) return;
  commit({ ...grants, [role]: on ? [...cur, permission] : cur.filter((p) => p !== permission) });
  logAudit({ category: "Settings", action: on ? "Permission granted" : "Permission removed", record: `${role} · ${def.label}`, details: `${def.description}${def.sensitive ? " · sensitive" : ""} · changed by ${by}`, branchId: null });
}

export function resetRole(role: Exclude<RoleName, "Company Admin">, by: string) {
  commit({ ...grants, [role]: [...DEFAULT_GRANTS[role]] });
  logAudit({ category: "Settings", action: "Role reset to defaults", record: role, details: `All ${role} permissions restored to the standard set · by ${by}`, branchId: null });
}

/** Branch pages and the permission each needs (Settings is always available — everyone has their own account). */
export const PAGE_PERMISSION: Record<string, string | null> = {
  dashboard: "dash.branch",
  billing: "billing.create",
  drafts: "billing.create",
  records: "patients.view",
  inventory: "services.view",
  pr: "referral.view",
  analysis: "analytics.view",
  expenses: "expenses.record",
  staff: "staff.view",
  settings: null,
  audit: "audit.view",
  trash: "trash.view",
};
