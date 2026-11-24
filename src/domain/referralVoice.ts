/**
 * Voice notes attached to referrals (owner, 2026-11-24). The recording is a
 * file, so it lives in IndexedDB (not with the referral's text in
 * localStorage). While the referral is being written it is stored under
 * "draft"; sending the referral moves it to the referral's ID.
 */
import { useEffect, useState } from 'react';

export interface StoredVoice {
  blob: Blob;
  duration: number;
}

const DB = 'stanley-pr-referral-voice';
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

const EVENT = 'stanley-referral-voice';
const changed = () => window.dispatchEvent(new Event(EVENT));

export const DRAFT_VOICE = 'draft';
export async function saveVoice(key: string, v: StoredVoice) {
  await run('readwrite', (s) => s.put(v, key));
  changed();
}
export async function deleteVoice(key: string) {
  await run('readwrite', (s) => s.delete(key));
  changed();
}
export const getVoice = (key: string) => run<StoredVoice>('readonly', (s) => s.get(key) as IDBRequest<StoredVoice>);
/** Sending a referral: the draft's recording becomes the referral's. */
export async function moveVoice(from: string, to: string) {
  const v = await getVoice(from);
  if (!v) return;
  await run('readwrite', (s) => {
    s.put(v, to);
    s.delete(from);
  });
  changed();
}

/** The recording for a key (draft or referral ID), kept up to date. */
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
