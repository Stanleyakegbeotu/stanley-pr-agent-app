/**
 * Chat messages (owner, 2026-11-23). Logistics only: no results, request forms
 * or ID photos (those go through requests and Results). Everything the clinician sends
 * — text, photos, videos, documents/receipts and voice notes — is saved on the
 * phone (IndexedDB, which can hold files) and shows a single tick until the
 * cloud connection delivers it. Opening messages from the branch come from the
 * branch inboxes (data/team). Each conversation remembers when it was last
 * read on this phone, for the unread counts on the Inbox icon and list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { INBOXES, conversationById } from '@/data/team';
import { canEncrypt, openBlob, openJSON, sealBlob, sealJSON, type SealedBlob } from './vault';

export type MsgKind = 'text' | 'image' | 'video' | 'file' | 'audio';

export interface ReplyRef {
  id: string;
  from: 'me' | 'them';
  preview: string;
  kind: MsgKind;
  /** Who wrote it (team member's name), when known. */
  sender?: string;
}

export interface ChatMsg {
  id: string;
  convId: string;
  from: 'me' | 'them';
  /** Team member who wrote it (shared front desk inbox). */
  sender?: string;
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

/* ─────────────── encrypted storage (compliance, 2026-11-24) ─────────────── */

/**
 * Messages and their media are ENCRYPTED on the phone (domain/vault): each
 * record keeps only its id, chat and time in the clear; the text and any
 * file are AES-GCM ciphertext. Media is never written to the phone gallery.
 * Without a secure connection (no WebCrypto) chat stays in memory only.
 */
interface SecureRecord {
  id: string;
  convId: string;
  at: string;
  sealed: string;
  file?: SealedBlob;
}
const DB = 'stanley-pr-chat-secure';
const LEGACY_DB = 'stanley-pr-chat';
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
const memory = new Map<string, ChatMsg>();

async function putMsg(m: ChatMsg) {
  if (!canEncrypt) return void memory.set(m.id, m);
  const { blob, ...rest } = m;
  const rec: SecureRecord = { id: m.id, convId: m.convId, at: m.at, sealed: await sealJSON(rest), file: blob ? await sealBlob(blob) : undefined };
  await tx('readwrite', (s) => s.put(rec));
}
async function openRec(r: SecureRecord): Promise<ChatMsg | null> {
  try {
    const m = await openJSON<ChatMsg>(r.sealed);
    return r.file ? { ...m, blob: await openBlob(r.file) } : m;
  } catch {
    return null; // the device key was destroyed (signed out)
  }
}
async function getMsgs(convId?: string): Promise<ChatMsg[]> {
  if (!canEncrypt) return [...memory.values()].filter((m) => !convId || m.convId === convId);
  const recs = (await tx<SecureRecord[]>('readonly', (s) => (convId ? s.index('convId').getAll(convId) : s.getAll()) as IDBRequest<SecureRecord[]>)) ?? [];
  return (await Promise.all(recs.map(openRec))).filter((m): m is ChatMsg => !!m);
}
async function deleteMsg(id: string) {
  memory.delete(id);
  if (canEncrypt) await tx('readwrite', (s) => s.delete(id));
}

/** Earlier versions stored chats unencrypted: encrypt them, then delete the old database. */
export async function migrateLegacyChat() {
  if (typeof indexedDB === 'undefined') return;
  const old = await new Promise<IDBDatabase | null>((res) => {
    const r = indexedDB.open(LEGACY_DB);
    r.onupgradeneeded = () => (r.transaction?.abort(), res(null));
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
  if (!old) return;
  try {
    if (canEncrypt && old.objectStoreNames.contains('messages')) {
      const MOVE: Record<string, string> = { branch: 'frontdesk', payments: 'admin', support: 'admin' };
      const all = await new Promise<ChatMsg[]>((res) => {
        const q = old.transaction('messages').objectStore('messages').getAll();
        q.onsuccess = () => res((q.result as ChatMsg[]) ?? []);
        q.onerror = () => res([]);
      });
      for (const m of all) await putMsg({ ...m, convId: MOVE[m.convId] ?? m.convId });
    }
  } finally {
    old.close();
    indexedDB.deleteDatabase(LEGACY_DB);
  }
}
/** Sign out of this device. */
export async function wipeChat() {
  memory.clear();
  dbp = null;
  indexedDB.deleteDatabase(DB);
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
  const c = conversationById(convId);
  if (!c) return [];
  const gone = new Set(deletedSeeds());
  const base = new Date();
  return c.messages.map((m, i) => {
    const at = new Date(base);
    if (m.time === 'Yesterday') at.setDate(at.getDate() - 1);
    else if (/^\d\d:\d\d$/.test(m.time)) at.setHours(Number(m.time.slice(0, 2)), Number(m.time.slice(3)), 0, 0);
    else at.setDate(at.getDate() - 3);
    const id = `seed-${convId}-${i}`;
    return { id, convId, from: m.from, sender: m.sender, at: at.toISOString(), kind: 'text' as const, text: m.text, status: 'delivered' as const, deleted: gone.has(id) };
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
    getMsgs(convId)
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
      await putMsg(msg).catch(() => undefined);
      changed();
      return msg;
    },
    [convId],
  );

  /** Delete for me — the bubble shows "You deleted this message", like WhatsApp. */
  const remove = useCallback(async (id: string) => {
    if (id.startsWith('seed-')) {
      localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedSeeds(), id]));
      setSeedTick((t) => t + 1);
      changed();
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
    if (updated) await putMsg(updated).catch(() => undefined);
    changed();
  }, []);

  const clear = useCallback(async () => {
    for (const m of mine) await deleteMsg(m.id).catch(() => undefined);
    localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedSeeds(), ...seedMessages(convId).map((m) => m.id)]));
    setMine([]);
    setSeedTick((t) => t + 1);
    changed();
  }, [mine, convId]);

  return { messages, send, remove, clear };
}

/** Send a text message from outside the chat screen (e.g. the admin's "Say thank you"). */
export async function postText(convId: string, text: string) {
  const msg: ChatMsg = { id: uid(), convId, from: 'me', at: new Date().toISOString(), kind: 'text', text, status: 'saved' };
  await putMsg(msg).catch(() => undefined);
  changed();
  return msg;
}

/* ─────────────── read / unread and the inbox list ─────────────── */

const READ_KEY = 'stanley.pr.chat.read';
const EVENT = 'stanley-chat-changed';
const changed = () => window.dispatchEvent(new Event(EVENT));
const readAll = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};
/** Mark a conversation as read up to now. */
export function markRead(convId: string) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify({ ...readAll(), [convId]: new Date().toISOString() }));
  } catch {
    /* this session only */
  }
  changed();
}

export interface InboxRow {
  id: string;
  last?: ChatMsg;
  unread: number;
}

/**
 * Every conversation for the inbox: the branch inboxes plus direct chats already started, newest first.
 * The admin workspace passes its own fixed inboxes and the prefix of its direct chats.
 */
export function useInbox(fixedIds: string[] = INBOXES.map((c) => c.id), directPrefix = 'dm-') {
  const [stored, setStored] = useState<ChatMsg[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      getMsgs()
        .then((r) => alive && setStored(r ?? []))
        .catch(() => undefined);
      setTick((t) => t + 1);
    };
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener('storage', load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return useMemo(() => {
    const read = readAll();
    const ids = [...fixedIds, ...new Set(stored.map((m) => m.convId).filter((id) => id.startsWith(directPrefix) && !fixedIds.includes(id) && conversationById(id)))];
    const rows: InboxRow[] = ids.map((id) => {
      const all = [...seedMessages(id), ...stored.filter((m) => m.convId === id)].sort((a, b) => a.at.localeCompare(b.at));
      const lastMine = [...all].reverse().find((m) => m.from === 'me')?.at ?? '';
      const since = [read[id] ?? '', lastMine].sort().pop()!; // replying counts as reading
      return { id, last: all[all.length - 1], unread: all.filter((m) => m.from === 'them' && !m.deleted && m.at > since).length };
    });
    const fixed = rows.slice(0, fixedIds.length);
    const direct = rows.slice(fixedIds.length).sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
    return { inboxes: fixed, direct, unread: rows.reduce((s, r) => s + r.unread, 0) };
  }, [stored, tick, fixedIds.join(','), directPrefix]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const previewOf = (m: Pick<ChatMsg, 'kind' | 'text' | 'fileName' | 'duration'>) =>
  m.kind === 'text' ? (m.text ?? '') : m.kind === 'image' ? '📷 Photo' : m.kind === 'video' ? '🎥 Video' : m.kind === 'audio' ? `🎤 Voice note${m.duration ? ` (${fmtDuration(m.duration)})` : ''}` : `📄 ${m.fileName ?? 'Document'}`;

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtSize = (b?: number) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
