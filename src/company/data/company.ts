// GENERATED from the STANLEY desktop app (src/data/company.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Company, branch and service catalogue — REAL baseline records.
 *
 * Company and branch come from the legacy Silhouette export metadata; the
 * service catalogue is the legacy inventory (priced items only are billable).
 * Fields the export does not contain are marked "Not on record" instead of
 * being invented.
 */
import { LEGACY_BRANCH_ID } from "./legacy";
import { CATALOGUE_INVENTORY } from "./catalogueRules";
import type { Branch, Currency } from "./types";

export const NOT_ON_RECORD = "Not on record";

export const COMPANY = {
  name: "Silhouette Diagnostic Consultants",
  shortName: "Silhouette",
  owner: NOT_ON_RECORD,
};

/** The signed-in account. Every account — admin, manager or staff — has a profile. */
export interface AppUser {
  name: string;
  firstName: string;
  role: string;
  email: string;
  /** admin = whole company · manager = runs one branch · staff = own account only. */
  kind: "admin" | "manager" | "staff";
  /** Profile key in settingsStore: "admin", "placeholder-manager:<branch>" or the staff id. */
  key: string;
  staffId?: string;
  branchId?: string;
  phone?: string;
  address?: string;
  /** Profile photo (data URL). */
  photo?: string;
}

/** Signed-in user. No user records were exported, so this is a generic administrator account. */
export const CURRENT_USER: AppUser = {
  name: "Company Administrator",
  firstName: "Administrator",
  role: "Company Admin",
  email: NOT_ON_RECORD,
  kind: "admin",
  key: "admin",
  // Sample headshot for the demo (public/mock-photos/CREDITS.md); the admin can replace or remove it in Settings.
  photo: `${import.meta.env.BASE_URL}mock-photos/company-admin.jpg`,
};

/**
 * Who is signed in to a branch workspace until staff accounts and sign-in
 * exist. Owner request (2026-11-21): address the branch dashboard to the
 * manager by a realistic name. Placeholder name — replaced automatically by the
 * branch's real manager once one is added in Staff Management.
 */
export const BRANCH_MANAGER_PLACEHOLDER: AppUser = {
  name: "Chioma Okafor",
  firstName: "Chioma",
  role: "Branch Manager",
  email: NOT_ON_RECORD,
  kind: "manager",
  key: "placeholder-manager",
};

/**
 * The live branch list. Starts with the real legacy branch; branches added in
 * Settings → Branch Management (services/org.ts) are added to this same array
 * so every page sees them. Kept as one array (mutated in place by org.ts).
 */
export const BRANCHES: Branch[] = [
  {
    id: LEGACY_BRANCH_ID,
    code: "BR001",
    idCode: "ABJ",
    name: "Abuja",
    city: "Abuja",
    country: "Nigeria",
    currency: "NGN",
    status: "Active",
    manager: NOT_ON_RECORD,
    phone: NOT_ON_RECORD,
    address: NOT_ON_RECORD,
    /** Daily patient volume used only by the demo-activity generator. */
    basePatients: 64,
    openedOn: NOT_ON_RECORD,
  },
];

/** Branches the demo-activity generator covers — the built-in legacy branch only (new branches never get invented activity). */
export const DEMO_BRANCHES: readonly Branch[] = Object.freeze(BRANCHES.filter((b) => b.status === "Active"));

/** Branches that are trading now. Kept in sync by syncActiveBranches() when a branch is added or its status changes. */
export const ACTIVE_BRANCHES: Branch[] = BRANCHES.filter((b) => b.status === "Active");
export function syncActiveBranches() {
  ACTIVE_BRANCHES.splice(0, ACTIVE_BRANCHES.length, ...BRANCHES.filter((b) => b.status === "Active"));
}

export function getBranch(id: string | null | undefined): Branch | undefined {
  return BRANCHES.find((b) => b.id === id);
}

/* ─────────────── Service catalogue (from the legacy inventory) ─────────────── */

export interface ServiceDef {
  /** Legacy inventory id. */
  id: number;
  name: string;
  /** Normalised category key (upper-case); `rawCategory` keeps the original text. */
  category: string;
  rawCategory: string;
  /** Price per currency. The legacy catalogue is priced in whole NGN only. */
  price: Partial<Record<Currency, number>>;
  /** Relative demand weight — used ONLY by the demo-activity generator. */
  mix: number;
}

/** Demo-activity demand by category (how often each kind of test is ordered). Not business data. */
const CATEGORY_DEMAND: Record<string, number> = {
  LAB: 1,
  SCAN: 0.55,
  "X-RAY": 0.4,
  XRAY: 0.4,
  ECG: 0.25,
  ECHO: 0.15,
  "CT SCAN": 0.08,
  MRI: 0.06,
  EEG: 0.05,
  "HOLTER ECG": 0.04,
  CARDIOLOGY: 0.05,
};

function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Billable services = legacy items that have a price on file (2 items without a price are excluded). */
export const SERVICES: ServiceDef[] = CATALOGUE_INVENTORY.filter((i) => i.price !== null).map((i) => {
  const key = i.catalogueCategory;
  const demand = CATEGORY_DEMAND[key] ?? 0.02;
  // Cheaper routine tests are ordered more often than expensive imaging (demo assumption).
  const priceDamping = Math.pow(10_000 / Math.max(2_000, i.price as number), 0.45);
  return {
    id: i.id,
    name: i.name,
    category: key,
    rawCategory: i.category,
    price: { NGN: i.price as number },
    mix: demand * priceDamping * (0.25 + 1.5 * seeded(i.id)),
  };
});

export function servicePrice(s: ServiceDef, currency: Currency): number {
  return s.price[currency] ?? 0;
}
