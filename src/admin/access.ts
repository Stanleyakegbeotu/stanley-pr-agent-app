/**
 * One page, two workspaces (owner, 2026-11-25): the admin pages (Inventory,
 * PR Management, Analysis, Staff, Settings, Audit, Trash) are the SAME pages
 * in the Branch Manager and Front Desk workspace. Two things change there:
 *   • what a person may do follows Settings, Roles and Permissions (can()),
 *     the Company Admin can do everything;
 *   • chats go to the branch side of the conversation (staff/chat), not the
 *     admin's.
 */
import { useApp as useCompany } from '@company/app/AppState';
import { can, usePermissions } from '@company/services/permissions';
import { useRole } from '@/domain/role';
import { useStaffChrome } from '@/staff/chrome';
import { staffAgentId, staffTeamId } from '@/staff/chat';
import { agentConvId, frontDeskId, managerId } from './chat';

/** right('services.edit'): may this person do it? (Company Admin: always.) */
export function useRight() {
  const { user } = useCompany();
  usePermissions();
  return (permission: string) => can(user.role, permission);
}

/** True inside the Branch Manager / Front Desk workspace. */
export const useInBranch = () => !!useStaffChrome().branchId;

/** Where "Chat" goes: the admin's conversations, or the branch side of them. */
export function useChatLink() {
  const { branchId } = useStaffChrome();
  const role = useRole();
  if (!branchId)
    return {
      agent: (id: number) => `/messages/${agentConvId(id)}`,
      manager: (b: string) => `/messages/${managerId(b)}`,
      frontDesk: (b: string) => `/messages/${frontDeskId(b)}`,
    };
  const base = `/branch/${branchId}/messages`;
  // Inside a branch: a Front Desk person's team chat is the manager; a manager's is the shared front desk inbox.
  const team = `${base}/${staffTeamId(branchId, role)}`;
  return {
    agent: (id: number) => `${base}/${staffAgentId(id)}`,
    manager: (_b?: string) => (role === 'frontdesk' ? team : base),
    frontDesk: (_b?: string) => (role === 'manager' ? team : base),
  };
}
