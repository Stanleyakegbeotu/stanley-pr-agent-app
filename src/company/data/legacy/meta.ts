// GENERATED from the STANLEY desktop app (src/data/legacy/meta.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * LEGACY BASELINE DATA — export metadata
 *
 * Source: Silhouette Diagnostic Consultants legacy Electron app (silhouette.db),
 * branch BR001 (Abuja), exported 2026-11-21T08:15:20.173Z.
 * Generated verbatim from the export files. DO NOT EDIT BY HAND — values are the
 * real historical records, including known data-quality issues (see meta.ts).
 */
import type { LegacyMeta } from "./types";

export const LEGACY_META: LegacyMeta = Object.freeze({
  "sourceApp": "Silhouette Diagnostic Consultants (legacy Electron app)",
  "sourceDatabase": "silhouette.db (SQLite)",
  "sourceTables": {
    "inventory": "inventory",
    "prAgents": "pr_contacts"
  },
  "branch": "BR001 (Abuja) - single branch in legacy data",
  "exportedAt": "2026-11-21T08:15:20.173Z",
  "currency": "NGN (Nigerian Naira), whole naira amounts (no kobo); legacy column type is REAL but every value is a whole number",
  "counts": {
    "inventoryItems": 345,
    "inventoryItemsMissingPrice": 2,
    "inventoryCategories": 20,
    "prAgents": 714,
    "prAgentsWithHospital": 496,
    "prAgentsWithoutHospital": 218,
    "distinctHospitals": 95,
    "prAgentsWithoutPhone": 263
  },
  "inventoryCategories": [
    {
      "category": "LAB",
      "itemCount": 198
    },
    {
      "category": "X-RAY",
      "itemCount": 54
    },
    {
      "category": "MRI",
      "itemCount": 31
    },
    {
      "category": "SCAN",
      "itemCount": 27
    },
    {
      "category": "CT SCAN",
      "itemCount": 19
    },
    {
      "category": "ECHO",
      "itemCount": 2
    },
    {
      "category": "35000",
      "itemCount": 1
    },
    {
      "category": "BALANCE PAYMENT",
      "itemCount": 1
    },
    {
      "category": "CARDIOLOGY",
      "itemCount": 1
    },
    {
      "category": "COLONOSCOPY",
      "itemCount": 1
    },
    {
      "category": "ECG",
      "itemCount": 1
    },
    {
      "category": "EEG",
      "itemCount": 1
    },
    {
      "category": "ESOPHAGOSCOPY",
      "itemCount": 1
    },
    {
      "category": "GASTROSCOPY",
      "itemCount": 1
    },
    {
      "category": "HOLTER ECG",
      "itemCount": 1
    },
    {
      "category": "MEDICAL EXAMINATION",
      "itemCount": 1
    },
    {
      "category": "OTHER",
      "itemCount": 1
    },
    {
      "category": "OTHERS",
      "itemCount": 1
    },
    {
      "category": "PHARYNGOSCOPY",
      "itemCount": 1
    },
    {
      "category": "XRAY",
      "itemCount": 1
    }
  ]
});
