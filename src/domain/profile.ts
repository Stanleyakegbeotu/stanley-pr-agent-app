/**
 * The clinician's own editable details: photo, title, name, phone and email.
 * Profession, regulator, licence number and workplace are read-only in the
 * app (the company changes them after checking the licence).
 * Compliance (2026-11-24): no bank details are collected or stored.
 */
import { useSyncExternalStore } from 'react';
import { PHOTOS } from '@/assets';
import { getAccount, updateClinician, useAccount } from './account';

const PHOTO_KEY = 'stanley.pr.photo.v1';
const listeners = new Set<() => void>();
let photo: string | null | undefined;
const readPhoto = () => {
  if (photo === undefined) photo = localStorage.getItem(PHOTO_KEY);
  return photo;
};

export interface ProfileEdits {
  title?: string;
  firstName?: string;
  lastName?: string;
  /** Square JPEG data URL, or undefined to remove. */
  photo?: string;
  phone?: string;
  email?: string;
}

export function saveProfile(patch: ProfileEdits) {
  if ('photo' in patch) {
    photo = patch.photo ?? null;
    if (patch.photo) localStorage.setItem(PHOTO_KEY, patch.photo);
    else localStorage.removeItem(PHOTO_KEY);
    listeners.forEach((l) => l());
  }
  const { photo: _p, ...rest } = patch;
  if (Object.keys(rest).length) updateClinician(rest);
}

const joinName = (n: { title: string; firstName: string; lastName: string }) => [n.title, n.firstName, n.lastName].filter(Boolean).join(' ');
/** "Dr. Stanley Okafor", outside React. */
export const displayName = () => {
  const c = getAccount()?.clinician;
  return c ? joinName(c) : '';
};

export function useProfile() {
  const { account } = useAccount();
  const p = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    readPhoto,
    readPhoto,
  );
  const c = account?.clinician;
  const n = { title: c?.title ?? '', firstName: c?.firstName ?? '', lastName: c?.lastName ?? '' };
  return { ...n, name: joinName(n), photo: p ?? PHOTOS.agentAvatar, customPhoto: !!p, phone: c?.phone ?? '', email: c?.email ?? '', clinician: c };
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
export const TITLES = ['Dr.', 'Prof.', 'Pharm.', 'Nurse', 'Mr.', 'Mrs.', 'Ms.', 'Miss', ''];
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
