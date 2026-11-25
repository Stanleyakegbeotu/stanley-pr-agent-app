// GENERATED from the STANLEY desktop app (src/data/serviceGuide/types.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
import type { Family } from './families';

/** One test's own guide; the family (families.ts) supplies the procedure. */
export interface GuideEntry {
  /** Catalogue names this entry covers (several spellings of the same test share one entry). */
  names: string[];
  family: Family;
  /** What the test is — one plain sentence. */
  about: string;
  /** What doctors use it for. */
  usedFor: string;
  /** Words people use when describing it (symptoms, conditions, body parts, short names). */
  keywords: string[];
  /** Preparation specific to this test (added to the family's). */
  prep?: string;
}

export const entry = (names: string[], family: Family, about: string, usedFor: string, keywords: string[], prep?: string): GuideEntry => ({ names, family, about, usedFor, keywords, prep });
