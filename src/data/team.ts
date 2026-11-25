/**
 * Branch inboxes (owner, 2026-11-24).
 *
 * The PR agent belongs to one branch, and the agent app and the STANLEY
 * desktop app are one system. So the agent doesn't look up phone contacts:
 * the inbox always has exactly three branch inboxes:
 *   • Front Desk: ONE inbox shared by the front desk staff. They work in
 *     shifts, so the agent never chooses a person; they see and message
 *     whoever is on duty now, and every reply shows who sent it.
 *   • Branch Manager
 *   • Admin (company administrator)
 * The team comes from the desktop app (catalogue.generated.json → team,
 * exported from Staff Management). Until real staff accounts exist those are
 * the dashboard's sample team.
 */
import CATALOGUE from './catalogue.generated.json';
import { BRANCH } from '@/config/org';

export interface Person {
  id: string;
  name: string;
  role: string;
  photo?: string;
  employment?: string;
}

export type InboxKind = 'admin' | 'manager' | 'frontdesk' | 'agent';

export interface SeedMessage {
  from: 'them' | 'me';
  text: string;
  time: string;
  /** Who on the team wrote it (shown in the shared front desk inbox). */
  sender?: string;
}

export interface Conversation {
  id: string;
  kind: InboxKind;
  /** Title shown in the inbox and chat header. */
  name: string;
  /** One line under the title. */
  role: string;
  /** Whose photo shows (front desk: the person on duty). */
  face?: Person;
  members: Person[];
  /** Several people read and reply (front desk). */
  shared: boolean;
  messages: SeedMessage[];
}

const PHOTOS = import.meta.glob('../assets/team/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
const photo = (slug?: string) => (slug ? PHOTOS[`../assets/team/${slug}.jpg`] : undefined);

interface TeamJson {
  admin: { id: string; name: string; role: string; photo?: string };
  staff: { id: string; name: string; role: string; employment: string; status: string; photo?: string }[];
}
const TEAM = (CATALOGUE as unknown as { team: TeamJson }).team;

export const ADMIN: Person = { id: TEAM.admin.id, name: TEAM.admin.name, role: TEAM.admin.role, photo: photo(TEAM.admin.photo) };
const active = TEAM.staff.filter((s) => s.status === 'Active');
const toPerson = (s: TeamJson['staff'][number]): Person => ({ id: s.id, name: s.name, role: s.role, employment: s.employment, photo: photo(s.photo) });
export const MANAGER: Person | undefined = TEAM.staff.filter((s) => s.role === 'Branch Manager' && s.status !== 'Left').map(toPerson)[0];
/** Every front desk staff member (their past replies keep their names). */
export const FRONT_DESK: Person[] = TEAM.staff.filter((s) => s.role === 'Front Desk' && s.status !== 'Left').map(toPerson);
const ROTA = active.filter((s) => s.role === 'Front Desk').map(toPerson);

/**
 * Who is on front desk duty (owner, 2026-11-24). The agent never picks a front
 * desk person: they message the Front Desk and the person on duty replies.
 * The desktop app doesn't record shifts yet, so this is a SAMPLE DAILY ROTA
 * (one person per day, in Staff Management order, starting with the first on
 * 23 Nov 2026). When front desk sign-in exists, the person signed in at the
 * front desk is on duty instead.
 */
const ROTA_START = Date.UTC(2026, 10, 23);
export function frontDeskOnDuty(at = new Date()): Person | undefined {
  if (!ROTA.length) return undefined;
  const day = Math.floor((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - ROTA_START) / 86_400_000);
  return ROTA[((day % ROTA.length) + ROTA.length) % ROTA.length];
}

/** The three inboxes every agent has: Front Desk (whoever is on duty), Branch Manager, Admin. */
export const INBOXES: Conversation[] = [
  {
    id: 'frontdesk',
    kind: 'frontdesk',
    name: 'Front Desk',
    get role() {
      const p = frontDeskOnDuty();
      return p ? `On duty now: ${p.name}` : 'No one on front desk duty right now';
    },
    get face() {
      return frontDeskOnDuty();
    },
    members: FRONT_DESK,
    shared: true,
    messages: [{ from: 'them', sender: frontDeskOnDuty()?.name, text: 'Good morning Dr. Stanley. Mary Okafor has arrived for her ultrasound.', time: '09:12' }],
  },
  {
    id: 'manager',
    kind: 'manager',
    name: MANAGER?.name ?? 'Branch Manager',
    role: MANAGER ? `Branch Manager, ${BRANCH.name}` : 'Branch Manager, not assigned yet',
    face: MANAGER,
    members: MANAGER ? [MANAGER] : [],
    shared: false,
    messages: [],
  },
  {
    id: 'admin',
    kind: 'admin',
    name: 'Admin',
    role: `${ADMIN.name}, ${CATALOGUE.company.shortName}`,
    face: ADMIN,
    members: [ADMIN],
    shared: false,
    messages: [{ from: 'them', text: 'Your account has been verified. Welcome to the Referrer Portal.', time: 'Yesterday' }],
  },
];

/** Conversations of the admin workspace (branch teams and PR agents), registered by src/admin/chat.ts. */
const EXTRA = new Map<string, Conversation>();
export function registerConversations(list: Conversation[]) {
  for (const c of list) EXTRA.set(c.id, c);
}
export const conversationById = (id: string): Conversation | undefined => INBOXES.find((c) => c.id === id) ?? EXTRA.get(id);
