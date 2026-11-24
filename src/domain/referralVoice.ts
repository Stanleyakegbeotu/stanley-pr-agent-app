/**
 * Voice notes attached to requests. The recording is ENCRYPTED on the phone
 * (domain/vault, AES-GCM) in IndexedDB. While the request is being written it
 * is stored under "draft"; sending the request moves it to the request's ID.
 * Without a secure connection (no WebCrypto) recordings stay in memory only.
 * TODO(backend): upload with the request, then delete the local copy.
 */
import { useEffect, useState } from 'react';
import { canEncrypt, openBlob, sealBlob, type SealedBlob } from './vault';

export interface StoredVoice {
  blob: Blob;
  duration: number;
}
interface SealedVoice {
  sealed: SealedBlob;
  duration: number;
}

const DB = 'stanley-pr-voice-secure';
const LEGACY_DB = 'stanley-pr-referral-voice';
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('voice');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('voice', mode);
    const req = fn(t.objectStore('voice'));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

/** Memory-only fallback when the phone can't encrypt (plain-HTTP development). */
const memory = new Map<string, StoredVoice>();

const EVENT = 'stanley-referral-voice';
const changed = () => window.dispatchEvent(new Event(EVENT));

export const DRAFT_VOICE = 'draft';
export async function saveVoice(key: string, v: StoredVoice) {
  if (!canEncrypt) memory.set(key, v);
  else {
    const rec: SealedVoice = { sealed: await sealBlob(v.blob), duration: v.duration };
    await run('readwrite', (s) => s.put(rec, key));
  }
  changed();
}
export async function deleteVoice(key: string) {
  memory.delete(key);
  if (canEncrypt) await run('readwrite', (s) => s.delete(key));
  changed();
}
export async function getVoice(key: string): Promise<StoredVoice | undefined> {
  if (!canEncrypt) return memory.get(key);
  const rec = await run<SealedVoice>('readonly', (s) => s.get(key) as IDBRequest<SealedVoice>);
  if (!rec) return undefined;
  try {
    return { blob: await openBlob(rec.sealed), duration: rec.duration };
  } catch {
    return undefined; // the key was destroyed (signed out)
  }
}
/** Sending a request: the draft's recording becomes the request's. */
export async function moveVoice(from: string, to: string) {
  const v = await getVoice(from);
  if (!v) return;
  await saveVoice(to, v);
  await deleteVoice(from);
}

/** Earlier versions stored recordings unencrypted: encrypt them, then delete the old database. */
export async function migrateLegacyVoice() {
  if (typeof indexedDB === 'undefined') return;
  const old = await new Promise<IDBDatabase | null>((res) => {
    const r = indexedDB.open(LEGACY_DB);
    r.onupgradeneeded = () => (r.transaction?.abort(), res(null));
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
  if (!old) return;
  try {
    if (canEncrypt && old.objectStoreNames.contains('voice')) {
      const entries = await new Promise<[IDBValidKey, StoredVoice][]>((res) => {
        const out: [IDBValidKey, StoredVoice][] = [];
        const cur = old.transaction('voice').objectStore('voice').openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return res(out);
          out.push([c.key, c.value as StoredVoice]);
          c.continue();
        };
        cur.onerror = () => res(out);
      });
      for (const [k, v] of entries) if (v?.blob) await saveVoice(String(k), v);
    }
  } finally {
    old.close();
    indexedDB.deleteDatabase(LEGACY_DB);
  }
}

/** Sign out of this device. */
export async function wipeVoice() {
  memory.clear();
  dbp = null;
  indexedDB.deleteDatabase(DB);
}

/** The recording for a key (draft or request ID), kept up to date. */
export function useVoice(key: string) {
  const [v, setV] = useState<StoredVoice | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getVoice(key)
        .then((x) => alive && setV(x ?? null))
        .catch(() => alive && setV(null));
    void load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, [key]);
  return v;
}
