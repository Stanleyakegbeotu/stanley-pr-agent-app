// GENERATED from the STANLEY desktop app (src/data/serviceGuide/index.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Service guide (owner, 2026-11-23) — for every catalogue service: what it
 * is, what it's used for, how it's done step by step, how to prepare, the
 * sample and the usual time, plus the words people use for it (search).
 *
 * The single source for BOTH apps: the dashboard reads it directly; the PR
 * agent app gets a generated copy with its catalogue. General guidance — the
 * branch and the requesting doctor confirm details for each patient.
 */
import { FAMILIES, type Family } from './families';
import { LAB } from './lab';
import { CT, MRI, SCAN, XRAY } from './imaging';
import { OTHER } from './other';
import type { GuideEntry } from './types';

export type { Family } from './families';
export type { GuideEntry } from './types';
export { FAMILIES } from './families';

export interface TestGuide {
  about: string;
  usedFor: string;
  sample: string;
  procedure: string[];
  preparation: string;
  duration: string;
  keywords: string[];
  family: Family;
  /** False when no specific entry exists yet and the category's general guide is shown. */
  specific: boolean;
}

/** Catalogue names are matched case-insensitively with spacing tidied. */
export const guideKey = (name: string) => name.toUpperCase().replace(/\s+/g, ' ').trim();

const ALL: GuideEntry[] = [...LAB, ...XRAY, ...MRI, ...SCAN, ...CT, ...OTHER];
const BY_NAME = new Map<string, GuideEntry>();
for (const g of ALL) for (const n of g.names) BY_NAME.set(guideKey(n), g);

const CATEGORY_FAMILY: Record<string, Family> = {
  LAB: 'blood',
  'X-RAY': 'xray',
  MRI: 'mri',
  SCAN: 'ultrasound',
  'CT SCAN': 'ct',
  PHARYNGOSCOPY: 'pharyngoscopy',
  DNA: 'dna',
  ECHO: 'echo',
  CARDIOLOGY: 'consultation',
  ECG: 'ecg',
  EEG: 'eeg',
  'HOLTER ECG': 'holter',
  'MEDICAL EXAMINATION': 'medical',
};

export function guideFor(name: string, category: string): TestGuide {
  const g = BY_NAME.get(guideKey(name));
  const family = g?.family ?? CATEGORY_FAMILY[category] ?? 'blood';
  const f = FAMILIES[family];
  return {
    about: g?.about ?? `${name} — a ${category.toLowerCase()} service at the branch.`,
    usedFor: g?.usedFor ?? 'The requesting doctor will explain why this test is needed.',
    sample: f.sample,
    procedure: f.procedure,
    preparation: g?.prep ? `${g.prep} ${f.preparation}` : f.preparation,
    duration: f.duration,
    keywords: g?.keywords ?? [],
    family,
    specific: !!g,
  };
}

/** Catalogue names with no specific entry (should be empty — checked when the catalogue changes). */
export const missingGuides = (items: { name: string }[]) => items.filter((i) => !BY_NAME.has(guideKey(i.name))).map((i) => i.name);

export const GUIDE_SOURCES = ['MedlinePlus (U.S. National Library of Medicine)', 'NHS (UK National Health Service) health A–Z', 'RadiologyInfo.org (RSNA/ACR)', 'Testing.com (formerly Lab Tests Online)'];
