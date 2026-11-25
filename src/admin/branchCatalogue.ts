/**
 * Branch inventory (owner, 2026-11-25). Branches do not all offer the same
 * tests at the same prices (Abuja, Port Harcourt, Lagos and Calabar each
 * charge their own). The company keeps ONE master catalogue (Inventory on
 * the admin side); each branch has its own price list built from it:
 *
 *   • Import: a new branch can import the company catalogue (every test,
 *     category and price) and then tailor it. Or start empty and add tests.
 *   • Branch price: a test can cost a different amount at this branch; the
 *     company price stays the same and the other branches are not affected.
 *   • Not offered here: a test the branch does not do is hidden from its
 *     billing and price list (and can be offered again).
 *   • Branch only tests: added at the branch, shown only there.
 *
 * PR agents and hospitals are never imported: each branch has its own.
 * Branches that existed before this rule use the company list as it is
 * (imported, no changes). Kept on this device until the cloud connection.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { buildItems, type Item } from './pages/Inventory';

export interface BranchService {
  id: number;
  name: string;
  category: string;
  price: number | null;
}
export interface BranchCatalogue {
  /** false: the branch started empty (only its own tests). */
  imported: boolean;
  importedAt?: string;
  importedBy?: string;
  /** Branch prices, by test id (the company price when missing). */
  prices: Record<number, number | null>;
  /** Tests the branch does not offer. */
  off: number[];
  /** Tests only this branch does. */
  added: BranchService[];
}

const KEY = 'stanley.branch.catalogue.v1';
/** Branch only tests get ids from here, never clashing with the company catalogue. */
const BRANCH_ID_START = 900_000;
const DEFAULT: BranchCatalogue = { imported: true, prices: {}, off: [], added: [] };

const listeners = new Set<() => void>();
let cache: Record<string, BranchCatalogue> = load();
function load(): Record<string, BranchCatalogue> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, BranchCatalogue>;
  } catch {
    return {};
  }
}
function commit(next: Record<string, BranchCatalogue>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
}
const patch = (branchId: string, fn: (c: BranchCatalogue) => BranchCatalogue) => commit({ ...cache, [branchId]: fn(cache[branchId] ?? DEFAULT) });

export const catalogueOf = (branchId: string): BranchCatalogue => cache[branchId] ?? DEFAULT;
export function useBranchCatalogue(branchId: string): BranchCatalogue {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache[branchId] ?? DEFAULT,
  );
}

/** A new branch: import the company catalogue, or start with nothing. */
export function setupBranchCatalogue(branchId: string, branchName: string, mode: 'import' | 'empty', by: string) {
  commit({ ...cache, [branchId]: mode === 'import' ? { imported: true, importedAt: new Date().toISOString(), importedBy: by, prices: {}, off: [], added: [] } : { imported: false, prices: {}, off: [], added: [] } });
  logAudit({ category: 'Catalogue', action: mode === 'import' ? 'Company inventory imported to a branch' : 'Branch started with an empty inventory', record: `${branchName} branch`, details: mode === 'import' ? 'Every test, category and company price; adjust the branch prices next' : 'Tests are added at the branch', branchId });
}
/** Import later (a branch that started empty). Its own tests stay. */
export function importCompanyCatalogue(branchId: string, branchName: string, by: string) {
  patch(branchId, (c) => ({ ...c, imported: true, importedAt: new Date().toISOString(), importedBy: by }));
  logAudit({ category: 'Catalogue', action: 'Company inventory imported to a branch', record: `${branchName} branch`, details: 'Every test, category and company price', branchId });
}
export function setBranchPrice(branchId: string, item: { id: number; name: string }, price: number | null, companyPrice: number | null) {
  patch(branchId, (c) => {
    const prices = { ...c.prices };
    if (price === companyPrice) delete prices[item.id];
    else prices[item.id] = price;
    return { ...c, prices, added: c.added.map((a) => (a.id === item.id ? { ...a, price } : a)) };
  });
  logAudit({ category: 'Catalogue', action: 'Branch price changed', record: `${item.name} (#${item.id})`, details: `${price === null ? 'no price' : `₦${price.toLocaleString('en-NG')}`} at this branch · company price ${companyPrice === null ? 'none' : `₦${companyPrice.toLocaleString('en-NG')}`}`, branchId });
}
export function setOffered(branchId: string, item: { id: number; name: string }, offered: boolean) {
  patch(branchId, (c) => ({ ...c, off: offered ? c.off.filter((x) => x !== item.id) : [...new Set([...c.off, item.id])] }));
  logAudit({ category: 'Catalogue', action: offered ? 'Test offered again at a branch' : 'Test not offered at a branch', record: `${item.name} (#${item.id})`, details: offered ? 'Back on the branch price list' : 'Hidden from the branch billing and price list', branchId });
}
export function addBranchService(branchId: string, s: Omit<BranchService, 'id'>): number {
  const all = Object.values(cache).flatMap((c) => c.added.map((a) => a.id));
  const id = Math.max(BRANCH_ID_START - 1, ...all) + 1;
  patch(branchId, (c) => ({ ...c, added: [...c.added, { ...s, id }] }));
  logAudit({ category: 'Catalogue', action: 'Branch only test added', record: `${s.name} (#${id})`, details: `${s.category} · ${s.price === null ? 'no price yet' : `₦${s.price.toLocaleString('en-NG')}`}`, branchId });
  return id;
}

export interface BranchItem extends Item {
  /** The company price (null when the test is not in the company catalogue). */
  companyPrice: number | null;
  /** The branch charges a different price. */
  branchPrice: boolean;
  /** Added at this branch only. */
  branchOnly: boolean;
  /** Not offered at this branch (only listed when asked for). */
  off: boolean;
}

/** The branch's price list: the imported company tests with branch prices, plus its own tests. */
export function branchItems(company: Item[], c: BranchCatalogue, includeOff = false): BranchItem[] {
  const off = new Set(c.off);
  const base: BranchItem[] = c.imported
    ? company
        .filter((i) => includeOff || !off.has(i.id))
        .map((i) => {
          const has = Object.prototype.hasOwnProperty.call(c.prices, i.id);
          return { ...i, price: has ? c.prices[i.id]! : i.price, companyPrice: i.price, branchPrice: has && c.prices[i.id] !== i.price, branchOnly: false, off: off.has(i.id) };
        })
    : [];
  const own: BranchItem[] = c.added
    .filter((a) => includeOff || !off.has(a.id))
    .map((a, k) => ({ id: a.id, name: a.name, price: a.price, category: a.category, rawCategory: a.category, order: 200_000 + k, source: 'user', edited: false, companyPrice: null, branchPrice: false, branchOnly: true, off: off.has(a.id) }));
  return [...base, ...own];
}

/** Billing, the price calculator and referrals use the branch's list. */
export function useBranchItems(branchId: string, includeOff = false): BranchItem[] {
  const { inventory } = useCompany();
  const c = useBranchCatalogue(branchId);
  const company = useMemo(() => buildItems(inventory), [inventory]);
  return useMemo(() => branchItems(company, c, includeOff), [company, c, includeOff]);
}

/** What to check after importing (shown on the branch's Inventory). */
export const AFTER_IMPORT = [
  'Prices: change any test this branch charges differently (the company price stays as it is for the others).',
  'Tests this branch does not do: mark them Not offered here, so they never show in billing.',
  'Tests only this branch does: add them here; they stay on this branch only.',
  'Categories and names come from the company list; ask the Company Admin to change them for everyone.',
  'PR agents and hospitals are not imported: each branch adds its own in PR Management.',
];
