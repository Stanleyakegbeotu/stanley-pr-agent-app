/**
 * One app, two workspaces (owner, 2026-11-25): the Company Admin dashboard
 * (desktop logic, including commission and payouts) and the referring
 * clinician portal (compliant: no money for the clinician). They share
 * nothing on screen. Until login exists, the role comes from the developer
 * switch in the menu (domain/role); later the signed-in account decides.
 */
import { useRole } from '@/domain/role';
import { AdminApp } from '@/admin/AdminApp';
import { StaffApp } from '@/staff/StaffApp';
import { App } from './App';
import { AppStoreProvider } from './store';
import { PrivacyGuard } from '@/ui/privacy';
import { agentKey, useAccountAccess } from '@company/services/accountAccess';
import { MY_AGENT_ID } from '@/domain/agentIdentity';
import { AccountOff } from './AccountOff';

export function Root() {
  const role = useRole();
  const agentOff = !!useAccountAccess()[agentKey(MY_AGENT_ID)]?.off;
  // View only on the phone for the PR agent portal and the branch staff workspace (privacy rules in ui/privacy).
  return (
    <>
      <PrivacyGuard on={role !== 'admin'} />
      {role === 'admin' ? (
        <AdminApp key="admin" />
      ) : role === 'manager' || role === 'frontdesk' ? (
        <StaffApp key="staff" />
      ) : agentOff ? (
        <AccountOff />
      ) : (
        <AppStoreProvider key="clinician">
          <App />
        </AppStoreProvider>
      )}
    </>
  );
}
