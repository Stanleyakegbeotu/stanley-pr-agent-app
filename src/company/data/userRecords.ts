// GENERATED from the STANLEY desktop app (src/data/userRecords.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * User-created records — kept strictly separate from the legacy baseline.
 *
 * The baseline (src/data/legacy) is immutable and loaded once as part of the
 * bundle; it is never re-appended or overwritten. Records created in the app
 * live here with their own id range, and views merge the two at read time.
 *
 * Persistence: STANLEY has no database layer yet, so user-created records last
 * for the current session. When Supabase/SQLite is connected, persist this
 * collection (and only this collection) — the baseline needs no seeding.
 */
import { LEGACY_BRANCH_ID, LEGACY_PR_AGENTS, type LegacyPrAgent } from "./legacy";

/** User records start well above every legacy id so the two can never collide. */
export const USER_ID_START = 1_000_000;

/** Where an agent's commission is paid. Not in the legacy export — added in the app (never invented). */
export interface BankDetails {
  bankName: string;
  accountNumber: string;
  /** Name on the bank account — may differ from the name the agent is listed under. */
  accountName: string;
  at: string;
}

export interface AgentRecord extends LegacyPrAgent {
  source: "legacy" | "user";
  createdAt?: string;
  bank?: BankDetails;
}

export const BASELINE_AGENTS: readonly AgentRecord[] = Object.freeze(LEGACY_PR_AGENTS.map((a) => ({ ...a, source: "legacy" as const })));

export function nextUserId(existing: readonly AgentRecord[]): number {
  return existing.reduce((max, a) => Math.max(max, a.id), USER_ID_START - 1) + 1;
}

export function mergeAgents(user: readonly AgentRecord[]): AgentRecord[] {
  return [...BASELINE_AGENTS, ...user];
}

/* ─────────────── PR agent changes (overrides; the legacy export is never modified) ─────────────── */

/** A profile change to a legacy agent (e.g. a transfer to another hospital). Absent fields keep the recorded value. */
export interface AgentEdit {
  name?: string;
  phone?: string;
  /** Hospital code; "" = no hospital assigned. */
  hospital?: string;
  at: string;
}

const BASELINE_BY_ID = new Map(BASELINE_AGENTS.map((a) => [a.id, a]));

/** The agent exactly as recorded in the legacy export (undefined for agents created in the app). */
export const recordedAgent = (id: number): AgentRecord | undefined => BASELINE_BY_ID.get(id);

export function applyAgentEdits(agents: AgentRecord[], edits: Record<number, AgentEdit>): AgentRecord[] {
  if (!Object.keys(edits).length) return agents;
  return agents.map((a) => {
    const e = edits[a.id];
    return e ? { ...a, name: e.name ?? a.name, phone: e.phone ?? a.phone, hospital: e.hospital ?? a.hospital } : a;
  });
}

/* ─────────────── Inventory changes (overrides; the legacy catalogue is never modified) ─────────────── */

/** A change to a catalogue service. Absent fields keep the recorded value. */
export interface ServiceEdit {
  name?: string;
  price?: number | null;
  at: string;
}

export interface AddedService {
  id: number;
  name: string;
  /** Normalised category key (upper-case). */
  category: string;
  price: number;
  turnaround?: string;
  sample?: string;
  notes?: string;
  createdAt: string;
}

export interface InventoryChanges {
  /** Display names for category keys, e.g. { LAB: "Laboratory" }. */
  categoryNames: Record<string, string>;
  edits: Record<number, ServiceEdit>;
  added: AddedService[];
}

export const EMPTY_INVENTORY_CHANGES: InventoryChanges = { categoryNames: {}, edits: {}, added: [] };

export function nextServiceId(added: readonly AddedService[]): number {
  return added.reduce((max, s) => Math.max(max, s.id), USER_ID_START - 1) + 1;
}

/* ─────────────── Nigerian banks (for the agent payment account) ─────────────── */

export const NIGERIAN_BANKS: readonly string[] = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Microfinance Bank",
  "Lotus Bank",
  "Moniepoint Microfinance Bank",
  "Opay",
  "Optimus Bank",
  "PalmPay",
  "Parallex Bank",
  "Polaris Bank",
  "PremiumTrust Bank",
  "Providus Bank",
  "Signature Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "TAJBank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];

/** Nigerian (NUBAN) account numbers are 10 digits. */
export const isNuban = (n: string) => /^\d{10}$/.test(n.trim());

/* ─────────────── Staff (created in STANLEY — none were in the legacy export) ─────────────── */

export type StaffStatus = "Active" | "On leave" | "Suspended" | "Left";
export const STAFF_STATUSES: readonly StaffStatus[] = ["Active", "On leave", "Suspended", "Left"];

/** The branch head. Each branch has at most one active manager; every other staff member reports to them. */
export const MANAGER_ROLE = "Branch Manager";

/**
 * STANLEY's only staff roles (owner, 2026-11-22). The system runs branch
 * operations, billing and PR-agent management — so its users are the Branch
 * Manager and the front-desk attendants. Everyone else at a branch (lab,
 * imaging, finance, security, drivers…) is managed by the manager outside the
 * app; e.g. reports for an accountant are created and printed by the manager.
 */
export const FRONT_DESK_ROLE = "Front Desk";
export const STAFF_ROLES: readonly { value: string; access: string; permissions: string[] }[] = [
  { value: MANAGER_ROLE, access: "Runs the branch: billing, PR agents, staff, expenses, reports and settings", permissions: ["Register patients and create bills", "Change prices and give discounts", "Approve expenses and balances", "Manage front-desk staff", "Manage PR agents and hospitals", "Every branch report", "Branch settings, audit and trash"] },
  { value: FRONT_DESK_ROLE, access: "Front-desk attendant: patients, billing and payments", permissions: ["Register patients and create bills", "Take payments and print receipts", "Save and continue drafts", "Record expenses (approved by the manager)", "Payment, balance and price-list reports"] },
];

export const EMPLOYMENT_TYPES: readonly string[] = ["Full-time", "Part-time", "Contract", "Locum"];

export interface StaffRecord {
  id: string;
  name: string;
  role: string;
  branchId: string;
  status: StaffStatus;
  email: string;
  phone: string;
  employment: string;
  /** yyyy-mm-dd */
  startDate: string;
  address?: string;
  notes?: string;
  /** Default profile photo (URL). The person's own upload in Settings replaces it. */
  photo?: string;
  /** Assignment history: transfers, role and status changes (newest first). */
  history?: { at: string; by: string; action: string }[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * MOCK STAFF (owner request, 2026-11-22; trimmed to the manager + 3) — a sample team for the Abuja branch so
 * Staff Management (branch and company admin) isn't empty and each role's
 * workspace can be tried with "Switch account" (e.g. the Front Desk dashboard).
 * Not real people: no staff were in the legacy export. Emails use the reserved
 * example.com domain and phone numbers are left blank rather than invented.
 * The manager uses the same name as the placeholder manager, so the branch
 * dashboard greeting is unchanged.
 */
const MOCK_NOTE = "Sample staff record (mock data) — replace with the real team.";
/** Bundled sample photo (works offline, and from a sub-path / file://). */
export const mockPhoto = (slug: string) => `${import.meta.env.BASE_URL}mock-photos/${slug}.jpg`;
const MOCK_CREATED = "2026-11-22T08:00:00.000Z";
export const MOCK_STAFF: readonly StaffRecord[] = Object.freeze(
  (
    [
      ["STF-0001", "Chioma Okafor", MANAGER_ROLE, "Active", "Full-time", "2023-02-01"],
      ["STF-0002", "Amina Bello", "Front Desk", "Active", "Full-time", "2024-03-11"],
      ["STF-0003", "Ngozi Eze", "Front Desk", "Active", "Full-time", "2023-09-18"],
      ["STF-0004", "Emeka Nwosu", "Front Desk", "Active", "Part-time", "2023-05-22"],
    ] as const
  ).map(([id, name, role, status, employment, startDate]) => ({
    id,
    name,
    role,
    branchId: LEGACY_BRANCH_ID,
    status: status as StaffStatus,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    phone: "",
    employment,
    startDate,
    notes: MOCK_NOTE,
    // Stock headshots (Pexels, see public/mock-photos/CREDITS.md) so the demo shows profile photos.
    photo: mockPhoto(name.toLowerCase().replace(/\s+/g, "-")),
    createdAt: MOCK_CREATED,
  })),
);

export const isManager = (s: Pick<StaffRecord, "role">) => s.role === MANAGER_ROLE;

/** The branch's current manager (active or on leave), if any. */
export const managerOf = (staff: readonly StaffRecord[], branchId: string) => staff.find((s) => s.branchId === branchId && isManager(s) && s.status !== "Left");

export function nextStaffId(staff: readonly StaffRecord[]): string {
  const max = staff.reduce((m, s) => Math.max(m, Number(s.id.replace(/\D/g, "")) || 0), 0);
  return `STF-${String(max + 1).padStart(4, "0")}`;
}
