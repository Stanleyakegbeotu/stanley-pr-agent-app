/**
 * Encrypted key-value store for patient data (compliance, 2026-11-24).
 * Values live decrypted in memory while the app runs and are written to the
 * phone ENCRYPTED (domain/vault). initSecureStore() runs before the app
 * renders, so screens can read synchronously.
 *
 * Old plain-text data from earlier versions is encrypted on first start and
 * the plain-text copy is deleted.
 */
import { canEncrypt, openJSON, sealJSON } from './vault';

const PREFIX = 'stanley.sec.';
/** Earlier versions kept these in plain text. */
const LEGACY: Record<string, string> = { 'stanley.pr.v1': 'referrals' };

const cache = new Map<string, unknown>();
const timers = new Map<string, number>();

export async function initSecureStore() {
  if (!canEncrypt) {
    // Nothing may be saved unencrypted: drop any plain-text leftovers.
    Object.keys(LEGACY).forEach((k) => localStorage.removeItem(k));
    return;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    try {
      cache.set(k.slice(PREFIX.length), await openJSON(localStorage.getItem(k)!));
    } catch {
      // Written with a key that no longer exists (signed out): unreadable, remove it.
      localStorage.removeItem(k);
    }
  }
  for (const [old, key] of Object.entries(LEGACY)) {
    const raw = localStorage.getItem(old);
    if (!raw) continue;
    try {
      if (!cache.has(key)) {
        cache.set(key, JSON.parse(raw));
        await persist(key);
      }
    } finally {
      localStorage.removeItem(old);
    }
  }
}

async function persist(key: string) {
  if (!canEncrypt) return; // memory only
  const v = cache.get(key);
  if (v === undefined) localStorage.removeItem(PREFIX + key);
  else localStorage.setItem(PREFIX + key, await sealJSON(v));
}

export function secureGet<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}
/** Update in memory now; encrypt and save shortly after (batched while typing). */
export function secureSet(key: string, value: unknown) {
  cache.set(key, value);
  window.clearTimeout(timers.get(key));
  timers.set(
    key,
    window.setTimeout(() => void persist(key).catch(() => undefined), 250),
  );
}
export function secureRemove(key: string) {
  cache.delete(key);
  localStorage.removeItem(PREFIX + key);
}
/** Sign out of this device: forget every encrypted value. */
export function secureWipe() {
  cache.clear();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
  }
}
