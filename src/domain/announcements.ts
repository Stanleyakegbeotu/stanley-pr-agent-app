/**
 * Announcements from the company to PR agents (owner, 2026-11-25).
 *
 * The admin can put a message in a PR agent's announcement bar (the carousel
 * on the Referrer Portal home), e.g. "The Admin sent you a message. Kindly
 * read it and reply", a thank-you, or a notice to every agent of a branch.
 *
 *  • To one agent: shown on that agent's Referrer Portal, matched by the
 *    phone number on their PR agent record and their portal account.
 *  • To a branch: shown to every PR agent of that branch.
 *
 * COMPLIANCE: the Referrer Portal never shows money (commission, payouts,
 * prices). Announcements are checked for money words before they are sent and
 * refused if they contain any (moneyWordsIn).
 *
 * Saved on this device and queued for the cloud, which delivers them to the
 * agents' phones. No patient data belongs in an announcement.
 */
import { useEffect, useState } from 'react';

export type AnnouncementAudience = { kind: 'agent'; agentId: number; name: string; phone: string } | { kind: 'branch'; branchId: string; branchName: string };

export interface AdminAnnouncement {
  id: string;
  at: string;
  from: { name: string; role: string };
  audience: AnnouncementAudience;
  /** message = "you have a new message" · thanks = appreciation · notice = general. */
  kind: 'message' | 'thanks' | 'notice';
  title: string;
  text: string;
  /** Where "Reply" leads on the agent's side (their chat with the admin). */
  replyInChat: boolean;
  status: 'queued' | 'delivered';
}

const KEY = 'stanley.admin.announcements.v1';
const EVENT = 'stanley-announcements-changed';

export function listAnnouncements(): AdminAnnouncement[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as AdminAnnouncement[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function sendAnnouncement(a: Omit<AdminAnnouncement, 'id' | 'at' | 'status'>): AdminAnnouncement {
  const full: AdminAnnouncement = { ...a, id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), status: 'queued' };
  try {
    localStorage.setItem(KEY, JSON.stringify([full, ...listAnnouncements()].slice(0, 200)));
  } catch {
    /* storage full: kept for this session only */
  }
  // TODO(backend): POST to the announcements service, which delivers to the agents' phones.
  window.dispatchEvent(new Event(EVENT));
  return full;
}

export function removeAnnouncement(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listAnnouncements().filter((a) => a.id !== id)));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAnnouncements(): AdminAnnouncement[] {
  const [list, setList] = useState(listAnnouncements);
  useEffect(() => {
    const load = () => setList(listAnnouncements());
    window.addEventListener(EVENT, load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return list;
}

const digits = (p: string) => p.replace(/\D/g, '').replace(/^234/, '0');
/** Announcements a PR agent sees: their own (by phone) and their branch's, newest first, last 30 days. */
export function announcementsFor(list: AdminAnnouncement[], me: { phone?: string; branchId: string }): AdminAnnouncement[] {
  const mine = me.phone ? digits(me.phone) : '';
  const since = Date.now() - 30 * 86_400_000;
  return list.filter((a) => new Date(a.at).getTime() >= since && (a.audience.kind === 'branch' ? a.audience.branchId === me.branchId : !!mine && digits(a.audience.phone) === mine));
}

/** Words that would put money on the Referrer Portal (never allowed there). */
const MONEY = /(₦|naira|\bngn\b|commission|payout|pay ?out|payment|paid|salary|bonus|percent|%|\bcash\b|\bbank\b|account number|transfer|earn|earning|incentive|kickback|reward money|\bmoney\b|\bfee\b|\bprice\b|\bcost\b)/gi;
export function moneyWordsIn(text: string): string[] {
  return [...new Set((text.match(MONEY) ?? []).map((w) => w.toLowerCase()))];
}
