/**
 * The agent's own editable details (owner, 2026-11-24): profile photo, phone
 * number, email, NAME (title, first, last) and BANK DETAILS (required:
 * commission can't be paid without them). Partner ID and branch are set by the branch.
 * Saved on this phone; sent to the desktop app once the cloud connection is on.
 */
import { useSyncExternalStore } from 'react';
import { PHOTOS } from '@/assets';
import { AGENT } from '@/config/org';

/** Where commission is paid (same fields as the desktop app's agent record). */
export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  at: string;
  /** When the agent confirmed the purpose: used only to pay their monthly PR commission. */
  agreedAt?: string;
}

export interface ProfileEdits {
  title?: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  bank?: BankDetails;
  phone?: string;
  email?: string;
  updatedAt?: string;
}

const KEY = 'stanley.pr.profile.v1';
const listeners = new Set<() => void>();
let cache: ProfileEdits | null = null;

function read(): ProfileEdits {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as ProfileEdits;
  } catch {
    cache = {};
  }
  return cache;
}

export function saveProfile(patch: ProfileEdits) {
  const next = { ...read(), ...patch, updatedAt: new Date().toISOString() };
  for (const k of Object.keys(next) as (keyof ProfileEdits)[]) if (next[k] === undefined) delete next[k];
  localStorage.setItem(KEY, JSON.stringify(next)); // throws if the phone's storage is full
  cache = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Title (may be empty), first and last name: the agent's edits over the branch record. */
function nameParts(e: ProfileEdits) {
  return { title: e.title ?? AGENT.title, firstName: e.firstName ?? AGENT.firstName, lastName: e.lastName ?? AGENT.lastName };
}
const joinName = (n: { title: string; firstName: string; lastName: string }) => [n.title, n.firstName, n.lastName].filter(Boolean).join(' ');
/** The agent's display name ("Dr. Stanley Okafor"), outside React (e.g. WhatsApp messages). */
export const displayName = () => joinName(nameParts(read()));

/** Current details: the agent's edits over the branch record. */
export function useProfile() {
  const e = useSyncExternalStore(subscribe, read, read);
  const n = nameParts(e);
  return { ...n, name: joinName(n), photo: e.photo ?? PHOTOS.agentAvatar, customPhoto: !!e.photo, phone: e.phone ?? AGENT.phone, email: e.email ?? AGENT.email, bank: e.bank, updatedAt: e.updatedAt };
}

/* ─────────────── checks ─────────────── */

/** Nigerian numbers: 0803 456 7890 or +234 803 456 7890. Returns the tidy form, or null. */
export function tidyPhone(v: string): string | null {
  const d = v.replace(/[^\d+]/g, '');
  const n = d.startsWith('+234') ? d.slice(4) : d.startsWith('234') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d;
  if (!/^[789][01]\d{8}$/.test(n)) return null;
  return `+234 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
/** Tidy a typed name part: "  chukwuemeka  " → "Chukwuemeka"; null if it isn't a name. */
export function tidyName(v: string): string | null {
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length < 2 || !/^[\p{L}][\p{L}' .-]*$/u.test(t)) return null;
  return t.replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}
export const TITLES = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Pharm.', 'Nurse', 'Prof.', ''];
export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Square, small JPEG of a chosen photo (keeps the phone's storage light). */
export async function squarePhoto(file: File, size = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('That file isn’t a photo this phone can open.'));
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
