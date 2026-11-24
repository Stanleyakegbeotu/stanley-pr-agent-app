/**
 * Device encryption (compliance, 2026-11-24). Everything stored on the phone
 * that contains patient data is encrypted with AES-GCM 256.
 *
 *  • The key is a NON-EXTRACTABLE WebCrypto CryptoKey kept in IndexedDB: the
 *    app can use it but its bytes can never be read out (not in localStorage,
 *    not in a backup of app storage as plain text).
 *  • "Sign out of this device" destroys the key, so anything left behind on
 *    the phone can no longer be read.
 *  • WebCrypto only exists in a secure context (HTTPS or localhost). Without
 *    it the app keeps patient data in memory only and saves NOTHING on the
 *    phone (see `canEncrypt`), rather than ever writing it unencrypted.
 *
 * React Native build: use the platform keystore (iOS Keychain / Android
 * Keystore, e.g. expo-secure-store) for the key and the same AES-GCM format.
 */

const DB = 'stanley-pr-vault';
const STORE = 'keys';
const KEY_ID = 'device';

export const canEncrypt = typeof crypto !== 'undefined' && !!crypto.subtle && typeof indexedDB !== 'undefined';

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (d) =>
      new Promise<T>((res, rej) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => (res(req.result), d.close());
        t.onerror = () => (rej(t.error), d.close());
      }),
  );
}

let keyP: Promise<CryptoKey> | null = null;
/** The phone's key: created once, never extractable. */
export function deviceKey(): Promise<CryptoKey> {
  if (!canEncrypt) return Promise.reject(new Error('Encryption is not available on this connection.'));
  if (!keyP)
    keyP = (async () => {
      const found = await idb<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID) as IDBRequest<CryptoKey | undefined>).catch(() => undefined);
      if (found) return found;
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idb('readwrite', (s) => s.put(k, KEY_ID));
      return k;
    })();
  return keyP;
}

/** Sign out of this device: the key is destroyed, so stored data can't be read any more. */
export async function destroyDeviceKey() {
  keyP = null;
  if (canEncrypt) await idb('readwrite', (s) => s.delete(KEY_ID)).catch(() => undefined);
}

export interface Sealed {
  iv: Uint8Array;
  data: ArrayBuffer;
}
export async function sealBytes(bytes: ArrayBuffer | Uint8Array): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), bytes as BufferSource);
  return { iv, data };
}
export async function openBytes(s: Sealed): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: s.iv as BufferSource }, await deviceKey(), s.data);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function toB64(buf: ArrayBuffer) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

/** JSON → "v1.<iv>.<ciphertext>" (safe to keep in localStorage: it is encrypted). */
export async function sealJSON(value: unknown): Promise<string> {
  const s = await sealBytes(new TextEncoder().encode(JSON.stringify(value)));
  return `v1.${b64(s.iv)}.${toB64(s.data)}`;
}
export async function openJSON<T>(text: string): Promise<T> {
  const [v, iv, data] = text.split('.');
  if (v !== 'v1' || !iv || !data) throw new Error('Not an encrypted value');
  const plain = await openBytes({ iv: unb64(iv), data: unb64(data).buffer as ArrayBuffer });
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** Files (voice notes, photos): encrypted bytes + their type. */
export interface SealedBlob extends Sealed {
  type: string;
}
export async function sealBlob(blob: Blob): Promise<SealedBlob> {
  return { ...(await sealBytes(await blob.arrayBuffer())), type: blob.type };
}
export async function openBlob(s: SealedBlob): Promise<Blob> {
  return new Blob([await openBytes(s)], { type: s.type });
}
