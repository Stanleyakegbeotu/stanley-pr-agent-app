// GENERATED from the STANLEY desktop app (src/data/legacy/index.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Legacy baseline — the application's real foundational data.
 *
 * The raw modules (inventory.ts, pr-agents.ts, hospitals.ts) are immutable and
 * hold the export verbatim. Everything here is a *derived, non-destructive*
 * view: normalised keys for search/grouping are computed alongside the
 * original values, never written over them.
 */
import { LEGACY_INVENTORY } from "./inventory";
import { LEGACY_PR_AGENTS } from "./pr-agents";
import { LEGACY_HOSPITALS } from "./hospitals";
import { LEGACY_META } from "./meta";
import type { LegacyInventoryItem, LegacyPrAgent } from "./types";

export { LEGACY_INVENTORY, LEGACY_PR_AGENTS, LEGACY_HOSPITALS, LEGACY_META };
export type { LegacyInventoryItem, LegacyPrAgent, LegacyHospitalSummary, LegacyMeta } from "./types";

/** The real branch the legacy data belongs to. */
export const LEGACY_BRANCH_ID = "br001-abuja";

/* ─────────────── Normalisation (lookup keys only) ─────────────── */

/** Hospital codes are grouped case-insensitively (README note 1). Whitespace is kept as-is. */
export const hospitalKey = (raw: string) => raw.trim().toUpperCase();
export const categoryKey = (raw: string) => raw.trim().toUpperCase();
export const hasPhone = (phone: string) => phone.trim() !== "" && phone.trim().toUpperCase() !== "N/A";

/** Lower-cased, punctuation-light text for forgiving search. */
export function searchText(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined)
    .join(" ")
    .toLowerCase()
    .replace(/[().,]/g, " ")
    .replace(/\s+/g, " ");
}
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "");

/* ─────────────── Known data-quality issues (README-FOR-IMPORT.md) ─────────────── */

export const INVENTORY_NOTES: Readonly<Record<number, string>> = {
  16: "No price on file in the legacy system — must be priced before it can be billed.",
  17: "No price on file in the legacy system — must be priced before it can be billed.",
  53: "Same name and category as #108 with a different price (₦30,000 vs ₦25,000). Confirm the current price with the owner.",
  108: "Same name and category as #53 with a different price (₦25,000 vs ₦30,000). Confirm the current price with the owner.",
  255: "Shares its name with #326 (MRI). Different service — the modality is in the category.",
  326: "Shares its name with #255 (CT SCAN). Different service — the modality is in the category.",
  289: "Billing adjustment line (category BALANCE PAYMENT), not a diagnostic service.",
  303: "Category \"35000\" looks like a price typed into the category field; likely LAB (compare #80 INSULIN). Left unchanged.",
};

export const AGENT_NOTES: Readonly<Record<number, string>> = {
  336: "Shares the name \"DR USMAN\" with agent #637 (different hospital). Likely two different doctors.",
  637: "Shares the name \"DR USMAN\" with agent #336 (different hospital). Likely two different doctors.",
};

/** Agents whose legacy `hospital_present` flag was set but whose hospital is empty (correctly unassigned). */
export const AGENTS_FLAGGED_EMPTY_HOSPITAL: readonly number[] = [18, 81, 350, 351, 481, 510, 658, 674];

/** Likely typo duplicates — flagged for the owner to confirm; never merged automatically. */
export const POSSIBLE_DUPLICATE_HOSPITALS: readonly (readonly string[])[] = [
  ["MEDFORD", "MEDFORF"],
  ["FEREPOD", "FEREPROD"],
  ["CITIZEN", "CITIZENS"],
  ["FMC KEFFI", "FMC   KEFFI", "FMC KEFI", "KEFFI"],
  ["POLICE", "POLICE HOSPITAL"],
  ["LONA", "LONA CITY"],
  ["FAITHMEDI", "FAITHMEDIPLEX"],
  ["ASH", "ASHER"],
  ["MBPH", "MBP4"],
  ["WDH", "WDG"],
  ["UATH", "UAGH"],
];

export function hospitalNotes(key: string): string[] {
  const notes: string[] = [];
  if (key.length === 1) notes.push("Single-character code — almost certainly a mis-key. Kept as recorded; review before relying on it.");
  if (key === "SILHOUTTE") notes.push("Misspelling of the company's own name — likely an internal/walk-in marker, not a hospital.");
  const group = POSSIBLE_DUPLICATE_HOSPITALS.find((g) => g.includes(key));
  if (group) notes.push(`Possibly the same place as ${group.filter((g) => g !== key).join(" / ")} — confirm with the owner before merging.`);
  return notes;
}

/* ─────────────── Derived views ─────────────── */

export interface HospitalEntry {
  /** Normalised (upper-cased) code used for grouping and filtering. */
  key: string;
  /** Every original spelling seen on agent records. */
  rawVariants: string[];
  agentIds: number[];
  /** Live count derived from current agent assignments. */
  agentCount: number;
  /** Count recorded in the export snapshot, for reconciliation. */
  exportedAgentCount: number | null;
  notes: string[];
}

/** Builds the hospital directory from agent assignments (baseline + any user-created agents). */
export function buildHospitalDirectory(agents: readonly Pick<LegacyPrAgent, "id" | "hospital">[]): HospitalEntry[] {
  const map = new Map<string, { raw: Set<string>; ids: number[] }>();
  for (const a of agents) {
    const key = hospitalKey(a.hospital);
    if (!key) continue;
    const e = map.get(key) ?? { raw: new Set<string>(), ids: [] };
    e.raw.add(a.hospital.trim());
    e.ids.push(a.id);
    map.set(key, e);
  }
  return [...map.entries()]
    .map(([key, e]) => ({
      key,
      rawVariants: [...e.raw].sort(),
      agentIds: e.ids,
      agentCount: e.ids.length,
      exportedAgentCount: LEGACY_HOSPITALS.find((h) => h.hospital === key)?.agentCount ?? null,
      notes: hospitalNotes(key),
    }))
    .sort((a, b) => b.agentCount - a.agentCount || a.key.localeCompare(b.key));
}

export const LEGACY_HOSPITAL_DIRECTORY: readonly HospitalEntry[] = Object.freeze(buildHospitalDirectory(LEGACY_PR_AGENTS));

export interface CategoryEntry {
  key: string;
  rawVariants: string[];
  itemCount: number;
}

export function buildCategories(items: readonly LegacyInventoryItem[]): CategoryEntry[] {
  const map = new Map<string, { raw: Set<string>; n: number }>();
  for (const it of items) {
    const key = categoryKey(it.category);
    const e = map.get(key) ?? { raw: new Set<string>(), n: 0 };
    e.raw.add(it.category);
    e.n += 1;
    map.set(key, e);
  }
  return [...map.entries()]
    .map(([key, e]) => ({ key, rawVariants: [...e.raw].sort(), itemCount: e.n }))
    .sort((a, b) => b.itemCount - a.itemCount || a.key.localeCompare(b.key));
}

export const LEGACY_CATEGORIES: readonly CategoryEntry[] = Object.freeze(buildCategories(LEGACY_INVENTORY));

/* ─────────────── Integrity check against the export metadata ─────────────── */

export interface BaselineCheck {
  label: string;
  expected: number;
  actual: number;
  ok: boolean;
}

export function validateLegacyBaseline(): BaselineCheck[] {
  const c = LEGACY_META.counts;
  const withHospital = LEGACY_PR_AGENTS.filter((a) => hospitalKey(a.hospital) !== "").length;
  const rows: [string, number, number][] = [
    ["Inventory items", c.inventoryItems, LEGACY_INVENTORY.length],
    ["Inventory categories", c.inventoryCategories, LEGACY_CATEGORIES.length],
    ["Inventory items without a price", c.inventoryItemsMissingPrice, LEGACY_INVENTORY.filter((i) => i.price === null).length],
    ["PR agents", c.prAgents, LEGACY_PR_AGENTS.length],
    ["PR agents with a hospital", c.prAgentsWithHospital, withHospital],
    ["PR agents without a hospital", c.prAgentsWithoutHospital, LEGACY_PR_AGENTS.length - withHospital],
    ["Distinct hospitals", c.distinctHospitals, LEGACY_HOSPITAL_DIRECTORY.length],
    ["PR agents with no phone (N/A)", c.prAgentsWithoutPhone, LEGACY_PR_AGENTS.filter((a) => a.phone === "N/A").length],
  ];
  return rows.map(([label, expected, actual]) => ({ label, expected, actual, ok: expected === actual }));
}
