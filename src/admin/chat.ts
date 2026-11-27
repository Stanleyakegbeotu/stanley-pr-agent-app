/**
 * Admin chat (owner, 2026-11-25): the Company Admin messages, per branch,
 *   • the Front Desk: ONE shared inbox. Front desk staff work in shifts, so the
 *     admin reaches whoever is on duty now (every reply keeps its sender's name);
 *   • the Branch Manager;
 *   • any PR agent of the branch.
 * Same chat screens, encryption and storage as the PR agent app's Inbox
 * (screens/chat, domain/chat). People come from Staff Management and PR
 * Management (src/company), so new staff and agents appear automatically.
 * Delivery between devices comes with the cloud connection; until then
 * messages are kept on this phone (single tick), as in the agent app.
 */
import { useMemo } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID } from '@company/data/legacy';
import { registerConversations, type Conversation, type Person } from '@/data/team';
import { photoOf, useTeam, type Who } from './people';
import { useAgentPhotos } from './agentPhotos';

export const AGENT_PREFIX = 'adm-pr-';
export const frontDeskId = (branchId: string) => `adm-fd-${branchId}`;
export const managerId = (branchId: string) => `adm-mgr-${branchId}`;
export const assistantManagerId = (branchId: string, accountId: string) => `adm-assistant-manager-${branchId}-${accountId}`;
export const agentConvId = (agentId: number) => `${AGENT_PREFIX}${agentId}`;

const person = (w: Who): Person => ({ id: w.name, name: w.name, role: w.role, photo: w.photo });

/** Registers every admin conversation and returns the fixed branch inboxes. */
export function useAdminConversations() {
  const team = useTeam();
  const { agents, staff } = useCompany();
  const photos = useAgentPhotos();
  return useMemo(() => {
    const fixed: Conversation[] = [];
    for (const b of ACTIVE_BRANCHES) {
      const desk = team.frontDesk(b.id);
      const duty = team.onDuty(b.id);
      fixed.push({
        id: frontDeskId(b.id),
        kind: 'frontdesk',
        name: `Front Desk, ${b.name}`,
        get role() {
          const p = team.onDuty(b.id);
          return p ? `On duty now: ${p.name}` : 'No one on front desk duty right now';
        },
        get face() {
          const p = team.onDuty(b.id);
          return p ? person(p) : undefined;
        },
        members: desk.map((s) => ({ id: s.id, name: s.name, role: s.role, photo: photoOf(s) })),
        shared: true,
        messages: duty ? [{ from: 'them', sender: duty.name, text: `Good morning. ${duty.name.split(' ')[0]} is on front desk duty at ${b.name} today.`, time: '08:02' }] : [],
      });
      const mgr = team.manager(b.id);
      fixed.push({
        id: managerId(b.id),
        kind: 'manager',
        name: mgr?.name ?? `Branch Manager, ${b.name}`,
        role: mgr ? `Branch Manager, ${b.name} branch` : `Branch Manager, ${b.name} (not assigned yet)`,
        face: mgr ? person(mgr) : undefined,
        members: mgr ? [person(mgr)] : [],
        shared: false,
        messages: mgr ? [{ from: 'them', text: `Good morning. ${b.name} branch is open and the team is in.`, time: '07:45' }] : [],
      });
      for (const assistant of staff.filter((s) => s.branchId === b.id && s.role === 'Assistant Manager' && s.status === 'Active')) {
        const assistantPerson: Person = { id: assistant.id, name: assistant.name, role: assistant.role, photo: assistant.photo };
        fixed.push({
          id: assistantManagerId(b.id, assistant.id),
          kind: 'manager',
          name: assistant.name,
          role: `Assistant Manager, ${b.name} branch`,
          face: assistantPerson,
          members: [assistantPerson],
          shared: false,
          messages: [],
        });
      }
    }
    // PR agents belong to the branch their referrals go to (the legacy branch until agents carry a branch).
    const home = getBranch(LEGACY_BRANCH_ID) ?? ACTIVE_BRANCHES[0];
    const agentConvs: Conversation[] = agents.map((a) => {
      const hospital = a.hospital.trim().toUpperCase();
      return {
        id: agentConvId(a.id),
        kind: 'agent',
        name: a.name,
        role: ['PR agent', hospital, home ? `${home.name} branch` : ''].filter(Boolean).join(', '),
        face: { id: String(a.id), name: a.name, role: 'PR agent', photo: photos.photoOf(a.id, a.phone) },
        members: [{ id: String(a.id), name: a.name, role: 'PR agent' }],
        shared: false,
        messages: [],
      };
    });
    registerConversations([...fixed, ...agentConvs]);
    return { fixed, agentConvs, home };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, agents, staff, photos]);
}
