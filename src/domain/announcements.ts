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
 *  • To chosen agents: shown to each agent the admin picked.
 *
 * COMPLIANCE: the Referrer Portal never shows money (commission, payouts,
 * prices). Announcements are checked for money words before they are sent and
 * refused if they contain any (moneyWordsIn).
 *
 * Saved on this device and queued for the cloud, which delivers them to the
 * agents' phones. No patient data belongs in an announcement.
 *
 * Broadcast announcements (owner, 2026-11-26): the Company Admin or a Branch
 * Manager posts to any mix of PR agents, Front Desk, Branch Managers and the
 * Company Admin, for every branch or one (a manager: their own branch only).
 * Each has a time frame: it shows from its start to its end, never for ever,
 * so it can be scheduled ahead. Everything created is listed as Live,
 * Scheduled or Ended, and can be ended early or deleted.
 */
import { useEffect, useState } from 'react';

export type AnnouncementAudience =
  | { kind: 'agent'; agentId: number; name: string; phone: string }
  | { kind: 'branch'; branchId: string; branchName: string }
  /** Agents the admin picked (e.g. one hospital's agents). */
  | { kind: 'agents'; branchId: string; agents: { id: number; name: string; phone: string }[] }
  /** Everyone in the chosen roles, for every branch ('all') or one. */
  | { kind: 'broadcast'; branchId: string; branchName: string; roles: AnnouncementRole[] };

export type AnnouncementRole = 'agents' | 'frontdesk' | 'manager' | 'admin';
export const ROLE_TEXT: Record<AnnouncementRole, string> = { agents: 'PR agents', frontdesk: 'Front Desk', manager: 'Branch Managers', admin: 'Company Admin' };

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
  /** Time frame (ISO). Older announcements without one show for 30 days. */
  startsAt?: string;
  endsAt?: string;
}

export type LiveState = 'scheduled' | 'live' | 'ended';
export function liveState(a: AdminAnnouncement, now = Date.now()): LiveState {
  const start = new Date(a.startsAt ?? a.at).getTime();
  const end = a.endsAt ? new Date(a.endsAt).getTime() : new Date(a.at).getTime() + 30 * 86_400_000;
  // End first: a scheduled announcement ended early is Ended, not Scheduled.
  return now >= end ? 'ended' : now < start ? 'scheduled' : 'live';
}
/** End an announcement now (it stays in the list as Ended). */
export function endAnnouncement(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listAnnouncements().map((a) => (a.id === id ? { ...a, endsAt: new Date().toISOString() } : a))));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}
/** Live announcements for a staff member (Front Desk, Branch Manager or Company Admin). */
export function staffAnnouncements(list: AdminAnnouncement[], role: AnnouncementRole, branchId: string | null): AdminAnnouncement[] {
  return list.filter((a) => a.audience.kind === 'broadcast' && liveState(a) === 'live' && a.audience.roles.includes(role) && (a.audience.branchId === 'all' || !branchId || a.audience.branchId === branchId));
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
  return list.filter((a) => {
    if (a.endsAt || a.startsAt ? liveState(a) !== 'live' : new Date(a.at).getTime() < since) return false;
    const au = a.audience;
    if (au.kind === 'broadcast') return au.roles.includes('agents') && (au.branchId === 'all' || au.branchId === me.branchId);
    if (au.kind === 'branch') return au.branchId === me.branchId;
    if (!mine) return false;
    return au.kind === 'agent' ? digits(au.phone) === mine : au.agents.some((x) => digits(x.phone) === mine);
  });
}

/** Words that would put money on the Referrer Portal (never allowed there). */
const MONEY = /(₦|naira|\bngn\b|commission|payout|pay ?out|payment|paid|salary|bonus|percent|%|\bcash\b|\bbank\b|account number|transfer|earn|earning|incentive|kickback|reward money|\bmoney\b|\bfee\b|\bprice\b|\bcost\b)/gi;
export function moneyWordsIn(text: string): string[] {
  return [...new Set((text.match(MONEY) ?? []).map((w) => w.toLowerCase()))];
}
