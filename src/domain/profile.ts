/**
 * The agent's own editable details (owner, 2026-11-24): profile photo, phone
 * number, email and BANK DETAILS (required: commission can't be paid without them). Name, partner ID and branch are set by the branch.
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
}

export interface ProfileEdits {
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

/** Current details: the agent's edits over the branch record. */
export function useProfile() {
  const e = useSyncExternalStore(subscribe, read, read);
  return { photo: e.photo ?? PHOTOS.agentAvatar, customPhoto: !!e.photo, phone: e.phone ?? AGENT.phone, email: e.email ?? AGENT.email, bank: e.bank, updatedAt: e.updatedAt };
}

/* ─────────────── checks ─────────────── */

/** Nigerian numbers: 0803 456 7890 or +234 803 456 7890. Returns the tidy form, or null. */
export function tidyPhone(v: string): string | null {
  const d = v.replace(/[^\d+]/g, '');
  const n = d.startsWith('+234') ? d.slice(4) : d.startsWith('234') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d;
  if (!/^[789][01]\d{8}$/.test(n)) return null;
  return `+234 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
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
