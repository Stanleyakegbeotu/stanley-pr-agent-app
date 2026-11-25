/**
 * PR agent photos (owner, 2026-11-25): wherever the admin sees a PR agent,
 * their photo shows when one exists, so the admin knows who is who.
 *  1. The photo the agent set on their Referrer Portal profile (matched by
 *     the phone number on their PR agent record).
 *  2. Otherwise a photo the admin set from the agent's profile (like staff
 *     photos in Staff Management). Saved on this device, queued for the cloud.
 * Without either, their initials show.
 */
import { useEffect, useMemo, useState } from 'react';
import { getAccount } from '@/domain/account';
import { InitialsAvatar } from '@/ui/kit';

const KEY = 'stanley.admin.agentPhotos.v1';
const EVENT = 'stanley-agent-photos-changed';
const PORTAL_PHOTO = 'stanley.pr.photo.v1';

const read = (): Record<number, string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<number, string>;
  } catch {
    return {};
  }
};

export function setAgentPhoto(id: number, dataUrl: string | null) {
  const all = read();
  if (dataUrl) all[id] = dataUrl;
  else delete all[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full */
  }
  window.dispatchEvent(new Event(EVENT));
}

const digits = (p: string) => p.replace(/\D/g, '').replace(/^234/, '0');
/** The Referrer Portal profile photo of the agent with this phone number, if they have one. */
function portalPhoto(phone?: string): string | undefined {
  if (!phone || phone === 'N/A') return undefined;
  const acc = getAccount();
  if (!acc || digits(acc.clinician.phone) !== digits(phone)) return undefined;
  return localStorage.getItem(PORTAL_PHOTO) ?? undefined;
}

export function useAgentPhotos() {
  const [all, setAll] = useState(read);
  useEffect(() => {
    const load = () => setAll(read());
    window.addEventListener(EVENT, load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return useMemo(() => ({ photoOf: (id: number, phone?: string): string | undefined => portalPhoto(phone) ?? all[id], fromPortal: (phone?: string) => !!portalPhoto(phone), adminSet: (id: number) => !!all[id] }), [all]);
}

export function AgentAvatar({ id, name, phone, size = 44 }: { id: number; name: string; phone?: string; size?: number }) {
  const { photoOf } = useAgentPhotos();
  const src = photoOf(id, phone);
  return src ? <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} /> : <InitialsAvatar name={name} size={size} />;
}
