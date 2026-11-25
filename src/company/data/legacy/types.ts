// GENERATED from the STANLEY desktop app (src/data/legacy/types.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Types for the legacy Silhouette baseline data (exported from silhouette.db).
 * Field names mirror the export exactly; nothing is renamed or reshaped.
 */

/** One billable diagnostic service/item. `price` is whole NGN; `null` = no price on file. */
export interface LegacyInventoryItem {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly price: number | null;
  readonly order: number;
}

/** A PR agent (referring doctor). `hospital` is a free-text code; "" = unassigned. `phone` may be "N/A". */
export interface LegacyPrAgent {
  readonly id: number;
  readonly name: string;
  readonly phone: string;
  readonly hospital: string;
  readonly order: number;
}

/** Hospital roster derived from agent assignments at export time. */
export interface LegacyHospitalSummary {
  readonly hospital: string;
  readonly agentCount: number;
  readonly rawVariants: readonly string[];
}

export interface LegacyMeta {
  readonly sourceApp: string;
  readonly sourceDatabase: string;
  readonly sourceTables: Readonly<Record<string, string>>;
  readonly branch: string;
  readonly exportedAt: string;
  readonly currency: string;
  readonly counts: Readonly<{
    inventoryItems: number;
    inventoryItemsMissingPrice: number;
    inventoryCategories: number;
    prAgents: number;
    prAgentsWithHospital: number;
    prAgentsWithoutHospital: number;
    distinctHospitals: number;
    prAgentsWithoutPhone: number;
  }>;
  readonly inventoryCategories: readonly { category: string; itemCount: number }[];
}
