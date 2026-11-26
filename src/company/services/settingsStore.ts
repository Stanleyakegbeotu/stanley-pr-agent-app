// GENERATED from the STANLEY desktop app (src/services/settingsStore.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Settings that customise STANLEY — saved on this device (offline-first).
 *
 *  • Company profile & branding (Company Admin): name, short name, phone,
 *    website, registered address, logo. Every page, receipt, quote and report
 *    reads the name and logo from here.
 *  • Branch profile (Branch Manager): branch email, opening hours, notes.
 *    Branch address/phone live in receiptProfile.ts (printed on receipts).
 *  • Personal profiles (everyone): photo and contact details for accounts that
 *    are not staff records (the Company Admin, the placeholder manager). Staff
 *    details live on their StaffRecord; only their photo is kept here.
 *
 * Nothing here is invented: fields the legacy export did not contain start
 * empty. Stored in localStorage (guarded) until the cloud database exists.
 */
import { useSyncExternalStore } from "react";
import { COMPANY } from "@company/data/company";
import type { WeekHours } from "./openingHours";

export interface CompanyProfile {
  name: string;
  shortName: string;
  /** Motto and company email are printed on receipts, so they live in receiptProfile.ts. */
  phone: string;
  website: string;
  address: string;
  owner: string;
  /** Corporate Affairs Commission registration number. */
  rcNumber: string;
  /** Data URL of the uploaded logo (PNG / JPG / WebP / SVG), or "" for the built-in mark. */
  logo: string;
  /** Logo printed on receipts and quotes ("" = use the main logo). */
  receiptLogo: string;
  registeredName: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  description: string;
}

export interface BranchProfile {
  email: string;
  /** Opening hours in words (kept in step with `week`). */
  hours: string;
  notes: string;
  /** Google Maps link to the branch (required): sent to patients by PR agents. */
  mapLink?: string;
  /** Opening hours per day, or 24/7 (owner, 2026-11-26). */
  week?: WeekHours;
}

export interface PersonalProfile {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Data URL (downscaled to at most 320 px). */
  photo?: string;
}

interface SettingsState {
  company: CompanyProfile;
  branches: Record<string, BranchProfile>;
  profiles: Record<string, PersonalProfile>;
}

const KEY = "stanley.settings.v1";

export const DEFAULT_COMPANY: CompanyProfile = {
  name: COMPANY.name,
  shortName: COMPANY.shortName,
  phone: "",
  website: "",
  address: "",
  owner: "",
  rcNumber: "",
  logo: "",
  receiptLogo: "",
  registeredName: "",
  city: "",
  state: "",
  country: "Nigeria",
  postalCode: "",
  contactPerson: "",
  description: "",
};

function load(): SettingsState {
  const empty: SettingsState = { company: { ...DEFAULT_COMPANY }, branches: {}, profiles: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return { company: { ...DEFAULT_COMPANY, ...(parsed.company ?? {}) }, branches: parsed.branches ?? {}, profiles: parsed.profiles ?? {} };
  } catch {
    return empty;
  }
}

let state: SettingsState = load();
const listeners = new Set<() => void>();

function commit(next: SettingsState): boolean {
  state = next;
  listeners.forEach((l) => l());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // Storage full or blocked — the change still applies for this session.
    return false;
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useSettings(): SettingsState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}


/* ── Company ── */
export const useCompanyProfile = () => useSettings().company;
/** For non-React code (PDF export, report specs). */
export const companyName = () => state.company.name.trim() || COMPANY.name;
export function updateCompany(patch: Partial<CompanyProfile>): boolean {
  return commit({ ...state, company: { ...state.company, ...patch } });
}

/* ── Branch ── */
export const EMPTY_BRANCH_PROFILE: BranchProfile = { email: "", hours: "", notes: "" };
export const useBranchProfile = (branchId: string): BranchProfile => useSettings().branches[branchId] ?? EMPTY_BRANCH_PROFILE;
export function updateBranchProfile(branchId: string, patch: Partial<BranchProfile>): boolean {
  const cur = state.branches[branchId] ?? EMPTY_BRANCH_PROFILE;
  return commit({ ...state, branches: { ...state.branches, [branchId]: { ...cur, ...patch } } });
}

/* ── Personal profiles ── */
export const useProfile = (key: string): PersonalProfile => useSettings().profiles[key] ?? {};
export function updateProfile(key: string, patch: Partial<PersonalProfile>): boolean {
  const cur = state.profiles[key] ?? {};
  const next = { ...cur, ...patch };
  (Object.keys(next) as (keyof PersonalProfile)[]).forEach((k) => next[k] === undefined && delete next[k]);
  return commit({ ...state, profiles: { ...state.profiles, [key]: next } });
}
export const profileOf = (key: string): PersonalProfile => state.profiles[key] ?? {};

/**
 * The photo to show for someone: their own upload, else their default (mock)
 * photo. An empty string means they removed their photo — show initials.
 */
export function resolvePhoto(profiles: Record<string, PersonalProfile>, key: string, fallback?: string): string | undefined {
  const p = profiles[key]?.photo;
  if (p === undefined) return fallback;
  return p || undefined;
}

/* ── Images ── */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const MAX_IMAGE_MB = 5;

/**
 * Read an image the user picked and return a data URL no larger than `max`
 * pixels on its longest side (so photos stay small on the device). SVGs are
 * kept as they are. Rejects with a plain-words message on a bad file.
 */
export function readImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!IMAGE_TYPES.includes(file.type)) return reject(new Error("Choose a PNG, JPG, WebP or SVG image."));
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return reject(new Error(`That image is larger than ${MAX_IMAGE_MB} MB — choose a smaller one.`));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read. Try another file."));
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === "image/svg+xml") return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error("The image could not be opened. Try another file."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, w, h);
        // Keep transparency for logos (PNG); photos as JPEG.
        resolve(file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
