/**
 * Staff chat (owner, 2026-11-25): the branch side of the admin chat. A
 * Branch Manager or Front Desk messages
 *   • the Company Admin;
 *   • the branch team (Front Desk: the Branch Manager; Manager: the shared
 *     Front Desk inbox, read by whoever is on duty);
 *   • any PR agent who refers to the branch.
 * Same chat screens, encryption and storage as the PR agent app and the
 * admin (screens/chat, domain/chat). Delivery between devices comes with the
 * cloud connection; until then messages stay on this phone.
 */
import { useMemo } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import { CURRENT_USER, getBranch } from '@company/data/company';
import { registerConversations, type Conversation, type Person } from '@/data/team';
import { useRole } from '@/domain/role';
import { photoOf, useTeam, type Who } from '@/admin/people';
import { useAgentPhotos } from '@/admin/agentPhotos';

export const STAFF_AGENT_PREFIX = 'st-pr-';
export const staffAdminId = (branchId: string, role: string) => `st-admin-${branchId}-${role}`;
export const staffTeamId = (branchId: string, role: string) => `st-team-${branchId}-${role}`;
export const staffAgentId = (agentId: number) => `${STAFF_AGENT_PREFIX}${agentId}`;

const person = (w: Who): Person => ({ id: w.name, name: w.name, role: w.role, photo: w.photo });

export function useStaffConversations(branchId: string) {
  const team = useTeam();
  const role = useRole();
  const { agents } = useCompany();
  const photos = useAgentPhotos();
  return useMemo(() => {
    const b = getBranch(branchId);
    const name = b?.name ?? '';
    const admin: Person = { id: 'company-admin', name: CURRENT_USER.name, role: CURRENT_USER.role, photo: CURRENT_USER.photo };
    const fixed: Conversation[] = [
      {
        id: staffAdminId(branchId, role),
        kind: 'admin',
        name: 'Company Admin',
        role: `${CURRENT_USER.name}. Approvals, prices, anything for head office`,
        face: admin,
        members: [admin],
        shared: false,
        messages: [{ from: 'them', text: `Good morning ${name} team. Message me here for anything that needs head office.`, time: '07:30' }],
      },
    ];
    if (role === 'frontdesk') {
      const mgr = team.manager(branchId);
      fixed.push({
        id: staffTeamId(branchId, role),
        kind: 'manager',
        name: mgr?.name ?? `Branch Manager, ${name}`,
        role: mgr ? `Branch Manager, ${name} branch` : `Branch Manager, ${name} (not assigned yet)`,
        face: mgr ? person(mgr) : undefined,
        members: mgr ? [person(mgr)] : [],
        shared: false,
        messages: mgr ? [{ from: 'them', text: 'Good morning. Tell me here if anything needs my approval today.', time: '07:45' }] : [],
      });
    } else {
      const desk = team.frontDesk(branchId);
      fixed.push({
        id: staffTeamId(branchId, role),
        kind: 'frontdesk',
        name: `Front Desk, ${name}`,
        get role() {
          const p = team.onDuty(branchId);
          return p ? `On duty now: ${p.name}` : 'No one on front desk duty right now';
        },
        get face() {
          const p = team.onDuty(branchId);
          return p ? person(p) : undefined;
        },
        members: desk.map((s) => ({ id: s.id, name: s.name, role: s.role, photo: photoOf(s) })),
        shared: true,
        messages: [],
      });
    }
    const agentConvs: Conversation[] = agents.map((a) => ({
      id: staffAgentId(a.id),
      kind: 'agent',
      name: a.name,
      role: ['PR agent', a.hospital.trim().toUpperCase()].filter(Boolean).join(', '),
      face: { id: String(a.id), name: a.name, role: 'PR agent', photo: photos.photoOf(a.id, a.phone) },
      members: [{ id: String(a.id), name: a.name, role: 'PR agent' }],
      shared: false,
      messages: [],
    }));
    registerConversations([...fixed, ...agentConvs]);
    return { fixed, agentConvs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, agents, photos, branchId, role]);
}
