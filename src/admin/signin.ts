/**
 * Sign-in details, set by each person themselves (owner, 2026-11-25): from
 * their own Settings everyone (Company Admin now; Branch Manager and Front
 * Desk in their workspaces) sets up and changes the email they sign in with
 * and their password. Nobody else can set or see another person's password;
 * the admin only sees whether someone has set theirs up.
 *
 * Sign-in itself isn't connected yet, so the details are kept on this device
 * for the sign-in to use when it arrives. The password is never stored: only
 * a salted SHA-256 code of it. Every change is written to the Audit Log
 * (never the password).
 */
import { useSyncExternalStore } from 'react';
import { logAudit } from '@company/services/audit';

export interface SignIn {
  email: string;
  salt: string;
  /** Hex SHA-256 of salt + password ("" until a password is set). */
  hash: string;
  passwordSetAt: string | null;
  emailSetAt: string | null;
}
const KEY = 'stanley.signin.v1';
const EVENT = 'stanley-signin-changed';

const read = (): Record<string, SignIn> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, SignIn>;
  } catch {
    return {};
  }
};
let cache = read();
const write = (all: Record<string, SignIn>) => {
  cache = all;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full: kept for this session */
  }
  window.dispatchEvent(new Event(EVENT));
};

export function useSignIn(userKey: string): SignIn | undefined {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener(EVENT, l);
      return () => window.removeEventListener(EVENT, l);
    },
    () => cache[userKey],
    () => cache[userKey],
  );
}
export const signInOf = (userKey: string) => cache[userKey];

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
async function digest(salt: string, password: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)));
}
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer);

export const EMAIL_OK = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** The password rules, with which ones are met (shown as a live checklist). */
export function passwordRules(p: string) {
  return [
    { label: 'At least 8 characters', ok: p.length >= 8 },
    { label: 'A letter', ok: /[A-Za-z]/.test(p) },
    { label: 'A number', ok: /\d/.test(p) },
    { label: 'No spaces', ok: p.length > 0 && !/\s/.test(p) },
  ];
}
export function strength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  const score = (p ? Math.max(1, s) : 0) as 0 | 1 | 2 | 3 | 4;
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score]! };
}

/** Is the email already someone else's sign-in? */
export const emailTaken = (email: string, userKey: string) => Object.entries(cache).some(([k, v]) => k !== userKey && v.email.toLowerCase() === email.trim().toLowerCase());

export function setSignInEmail(userKey: string, who: { name: string; role: string }, email: string) {
  const cur = cache[userKey] ?? { email: '', salt: newSalt(), hash: '', passwordSetAt: null, emailSetAt: null };
  write({ ...cache, [userKey]: { ...cur, email: email.trim(), emailSetAt: new Date().toISOString() } });
  logAudit({ category: 'Settings', action: cur.email ? 'Sign-in email changed' : 'Sign-in email set up', record: `${who.name} (${who.role})`, details: `Signs in with ${email.trim()}`, branchId: null });
}

/** Checks the current password (when one is set) before saving the new one. */
export async function setPassword(userKey: string, who: { name: string; role: string }, next: string, current?: string): Promise<string | null> {
  const cur = cache[userKey] ?? { email: '', salt: newSalt(), hash: '', passwordSetAt: null, emailSetAt: null };
  if (!crypto?.subtle) return 'This browser can’t protect a password here. Open the app over a secure (https) address.';
  if (cur.hash) {
    if (!current) return 'Enter your current password.';
    if ((await digest(cur.salt, current)) !== cur.hash) return 'Your current password is not right.';
  }
  const salt = newSalt();
  write({ ...cache, [userKey]: { ...cur, salt, hash: await digest(salt, next), passwordSetAt: new Date().toISOString() } });
  logAudit({ category: 'Settings', action: cur.hash ? 'Password changed' : 'Password set up', record: `${who.name} (${who.role})`, details: 'Changed by the account holder', branchId: null });
  return null;
}
