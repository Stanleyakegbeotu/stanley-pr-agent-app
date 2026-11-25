// GENERATED from the STANLEY desktop app (src/data/catalogueRules.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Owner decisions about the service catalogue (recorded 21 Nov 2026).
 *
 * The legacy export in ./legacy stays byte-for-byte as recorded; these rules
 * are applied on top of it wherever the catalogue is shown or billed.
 *
 *  • Removed categories — not real diagnostic categories, so they and their
 *    items are hidden from the catalogue and from billing:
 *      OTHERS          #293 PATERNITY (DNA) — except #293, which moves to DNA (below)
 *      OTHER           #331 HOME SERVICE
 *      BALANCE PAYMENT #289 BALANCE (billing adjustment line)
 *      35000           #303 insuline (a price typed into the category field)
 *  • Merged categories — duplicates of / belong under an existing category:
 *      XRAY → X-RAY                   #320 CD
 *      COLONOSCOPY → PHARYNGOSCOPY     (owner: scope procedures sit under PHARYNGOSCOPY)
 *      ESOPHAGOSCOPY → PHARYNGOSCOPY
 *      GASTROSCOPY → PHARYNGOSCOPY
 *  • DNA category (new):
 *      #293 PATERNITY (DNA) → DNA, shown as "FATHER AND CHILD" (₦650,000, as recorded)
 *      EXTRA CHILD — ₦250,000, added by the owner (not in the legacy export)
 */
import { LEGACY_INVENTORY, categoryKey, type LegacyInventoryItem } from "./legacy";

export const REMOVED_CATEGORIES: ReadonlySet<string> = new Set(["OTHERS", "OTHER", "BALANCE PAYMENT", "35000"]);

export const CATEGORY_MERGES: Readonly<Record<string, string>> = {
  XRAY: "X-RAY",
  COLONOSCOPY: "PHARYNGOSCOPY",
  ESOPHAGOSCOPY: "PHARYNGOSCOPY",
  GASTROSCOPY: "PHARYNGOSCOPY",
};

/** Individual legacy items filed under a different category (and display name) by the owner. */
export const ITEM_REASSIGN: Readonly<Record<number, { category: string; name?: string }>> = {
  293: { category: "DNA", name: "FATHER AND CHILD" },
};

/**
 * Services the owner added that were not in the legacy export. Ids start at
 * 500 001 — above every legacy id and below session-created records (1 000 000+).
 */
export const OWNER_SERVICES: readonly LegacyInventoryItem[] = Object.freeze([
  { id: 500_001, name: "EXTRA CHILD", category: "DNA", price: 250_000, order: 293.5 },
]);

/** Catalogue category key for a recorded category, or null when the category was removed. */
export function catalogueCategory(rawCategory: string): string | null {
  const key = categoryKey(rawCategory);
  if (REMOVED_CATEGORIES.has(key)) return null;
  return CATEGORY_MERGES[key] ?? key;
}

export type CatalogueEntry = LegacyInventoryItem & {
  catalogueCategory: string;
  /** "legacy" = from the export; "owner" = added by the owner in OWNER_SERVICES. */
  origin: "legacy" | "owner";
  /** Name as recorded in the export, when the owner gave it a different display name. */
  recordedName?: string;
};

/** Catalogue items after the owner decisions above (category = catalogue key). */
export const CATALOGUE_INVENTORY: readonly CatalogueEntry[] = Object.freeze([
  ...LEGACY_INVENTORY.flatMap<CatalogueEntry>((i) => {
    const re = ITEM_REASSIGN[i.id];
    if (re) return [{ ...i, name: re.name ?? i.name, catalogueCategory: re.category, origin: "legacy", recordedName: re.name && re.name !== i.name ? i.name : undefined }];
    const k = catalogueCategory(i.category);
    return k ? [{ ...i, catalogueCategory: k, origin: "legacy" }] : [];
  }),
  ...OWNER_SERVICES.map<CatalogueEntry>((s) => ({ ...s, catalogueCategory: categoryKey(s.category), origin: "owner" })),
]);

export interface CatalogueCategory {
  key: string;
  /** Every recorded spelling folded into this category. */
  rawVariants: string[];
  itemCount: number;
}

export const CATALOGUE_CATEGORIES: readonly CatalogueCategory[] = Object.freeze(
  (() => {
    const map = new Map<string, { raw: Set<string>; n: number }>();
    for (const i of CATALOGUE_INVENTORY) {
      const e = map.get(i.catalogueCategory) ?? { raw: new Set<string>(), n: 0 };
      e.raw.add(ITEM_REASSIGN[i.id] ? i.catalogueCategory : i.category);
      e.n += 1;
      map.set(i.catalogueCategory, e);
    }
    return [...map.entries()].map(([key, e]) => ({ key, rawVariants: [...e.raw], itemCount: e.n })).sort((a, b) => b.itemCount - a.itemCount || a.key.localeCompare(b.key));
  })(),
);
