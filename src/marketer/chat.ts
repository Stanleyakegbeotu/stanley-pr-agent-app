/**
 * Marketer inbox (owner, 2026-11-26): a marketer chats with the PR agents at
 * their own hospitals, and with their Branch Manager. Same chat screens,
 * encryption and storage as the rest of the app (screens/chat, domain/chat).
 * Delivery between phones comes with the cloud connection.
 */
import { useMemo } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { registerConversations, type Conversation, type Person } from '@/data/team';
import { useTeam } from '@/admin/people';
import { useAgentPhotos } from '@/admin/agentPhotos';

export const marketerPrefix = (marketerId: string) => `mk-${marketerId}-pr-`;
export const marketerAgentChat = (marketerId: string, agentId: number) => `${marketerPrefix(marketerId)}${agentId}`;
export const marketerManagerChat = (branchId: string, marketerId: string) => `mk-${marketerId}-mgr-${branchId}`;

export function useMarketerConversations(branchId: string, marketerId: string, agentIds: Set<number>) {
  const team = useTeam();
  const { agents } = useCompany();
  const photos = useAgentPhotos();
  return useMemo(() => {
    const b = getBranch(branchId);
    const mgr = team.manager(branchId);
    const mgrPerson: Person | undefined = mgr ? { id: mgr.name, name: mgr.name, role: mgr.role, photo: mgr.photo } : undefined;
    const fixed: Conversation[] = [
      {
        id: marketerManagerChat(branchId, marketerId),
        kind: 'manager',
        name: mgr?.name ?? `Branch Manager, ${b?.name ?? ''}`,
        role: `Branch Manager, ${b?.name ?? ''} branch`,
        face: mgrPerson,
        members: mgrPerson ? [mgrPerson] : [],
        shared: false,
        messages: mgr ? [{ from: 'them', text: 'Good morning. Tell me here how your hospitals are doing, or if you need anything.', time: '07:45' }] : [],
      },
    ];
    const agentConvs: Conversation[] = agents
      .filter((a) => agentIds.has(a.id))
      .map((a) => ({
        id: marketerAgentChat(marketerId, a.id),
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
  }, [team, agents, photos, branchId, marketerId, agentIds]);
}
