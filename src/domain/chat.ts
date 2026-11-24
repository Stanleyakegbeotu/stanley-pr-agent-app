/**
 * Chat messages (owner, 2026-11-23). Offline-first: everything the agent sends
 * — text, photos, videos, documents/receipts and voice notes — is saved on the
 * phone (IndexedDB, which can hold files) and shows a single tick until the
 * cloud connection delivers it. Opening messages from the branch come from the
 * sample conversations (data/content).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONVERSATIONS } from '@/data/content';

export type MsgKind = 'text' | 'image' | 'video' | 'file' | 'audio';

export interface ReplyRef {
  id: string;
  from: 'me' | 'them';
  preview: string;
  kind: MsgKind;
}

export interface ChatMsg {
  id: string;
  convId: string;
  from: 'me' | 'them';
  at: string;
  kind: MsgKind;
  text?: string;
  blob?: Blob;
  fileName?: string;
  mime?: string;
  size?: number;
  /** Seconds (voice notes, videos). */
  duration?: number;
  replyTo?: ReplyRef;
  deleted?: boolean;
  /** saved = on this phone, waiting for the cloud; delivered = reached the other side. */
  status: 'saved' | 'delivered';
}

/* ─────────────── IndexedDB ─────────────── */

const DB = 'stanley-pr-chat';
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const s = r.result.createObjectStore('messages', { keyPath: 'id' });
        s.createIndex('convId', 'convId');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('messages', mode);
    const req = run(t.objectStore('messages'));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

/* Opening messages from the sample conversations (deletable, remembered on this phone). */
const DELETED_KEY = 'stanley.pr.chat.deleted';
const deletedSeeds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};
function seedMessages(convId: string): ChatMsg[] {
  const c = CONVERSATIONS.find((x) => x.id === convId);
  if (!c) return [];
  const gone = new Set(deletedSeeds());
  const base = new Date();
  return c.messages.map((m, i) => {
    const at = new Date(base);
    if (m.time === 'Yesterday') at.setDate(at.getDate() - 1);
    else if (/^\d\d:\d\d$/.test(m.time)) at.setHours(Number(m.time.slice(0, 2)), Number(m.time.slice(3)), 0, 0);
    else at.setDate(at.getDate() - 3);
    const id = `seed-${convId}-${i}`;
    return { id, convId, from: m.from, at: at.toISOString(), kind: 'text', text: m.text, status: 'delivered', deleted: gone.has(id) };
  });
}

/* Chat settings (mute) per conversation. */
const SETTINGS_KEY = 'stanley.pr.chat.settings';
export function chatSettings(convId: string): { muted: boolean } {
  try {
    return (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Record<string, { muted: boolean }>)[convId] ?? { muted: false };
  } catch {
    return { muted: false };
  }
}
export function saveChatSettings(convId: string, s: { muted: boolean }) {
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
    all[convId] = s;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
  } catch {
    /* this session only */
  }
}

const uid = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Everything in one conversation, oldest first, plus actions. */
export function useChat(convId: string) {
  const [mine, setMine] = useState<ChatMsg[]>([]);
  const [seedTick, setSeedTick] = useState(0);
  useEffect(() => {
    let alive = true;
    tx<ChatMsg[]>('readonly', (s) => s.index('convId').getAll(convId) as IDBRequest<ChatMsg[]>)
      .then((r) => alive && setMine(r ?? []))
      .catch(() => alive && setMine([]));
    return () => {
      alive = false;
    };
  }, [convId]);

  const messages = useMemo(() => [...seedMessages(convId), ...mine].sort((a, b) => a.at.localeCompare(b.at)), [convId, mine, seedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(
    async (m: Omit<ChatMsg, 'id' | 'at' | 'convId' | 'from' | 'status'>) => {
      const msg: ChatMsg = { ...m, id: uid(), convId, from: 'me', at: new Date().toISOString(), status: 'saved' };
      setMine((x) => [...x, msg]);
      await tx('readwrite', (s) => s.put(msg)).catch(() => undefined);
      return msg;
    },
    [convId],
  );

  /** Delete for me — the bubble shows "You deleted this message", like WhatsApp. */
  const remove = useCallback(async (id: string) => {
    if (id.startsWith('seed-')) {
      localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedSeeds(), id]));
      setSeedTick((t) => t + 1);
      return;
    }
    let updated: ChatMsg | undefined;
    setMine((x) =>
      x.map((m) => {
        if (m.id !== id) return m;
        updated = { ...m, deleted: true, blob: undefined, text: undefined };
        return updated;
      }),
    );
    if (updated) await tx('readwrite', (s) => s.put(updated!)).catch(() => undefined);
  }, []);

  const clear = useCallback(async () => {
    for (const m of mine) await tx('readwrite', (s) => s.delete(m.id)).catch(() => undefined);
    localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedSeeds(), ...seedMessages(convId).map((m) => m.id)]));
    setMine([]);
    setSeedTick((t) => t + 1);
  }, [mine, convId]);

  return { messages, send, remove, clear };
}

export const previewOf = (m: Pick<ChatMsg, 'kind' | 'text' | 'fileName' | 'duration'>) =>
  m.kind === 'text' ? (m.text ?? '') : m.kind === 'image' ? '📷 Photo' : m.kind === 'video' ? '🎥 Video' : m.kind === 'audio' ? `🎤 Voice note${m.duration ? ` (${fmtDuration(m.duration)})` : ''}` : `📄 ${m.fileName ?? 'Document'}`;

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtSize = (b?: number) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
